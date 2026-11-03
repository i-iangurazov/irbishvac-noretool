from __future__ import annotations
import csv
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import performance_reporting as policy
import run_service_tech_thursday_delivery as technician
import run_advisor_friday_delivery as advisor
import build_advisor_delivery_snapshot as advisor_builder
import build_service_tech_delivery_snapshot as technician_builder

UNITS = [{"id": 1, "name": "HVAC - Service", "active": True}, {"id": 2, "name": "HVAC - Sales", "active": True}, {"id": 3, "name": "HVAC - Maintenance", "active": True}]

def person(identifier=1, name="New Advisor", unit=2, **extra):
    return {"id": identifier, "name": name, "businessUnitId": unit, "active": True, "isManagedTech": True, "email": "new@irbishvac.com", **extra}

class PersonnelTests(unittest.TestCase):
    def test_new_active_staff_appears_without_goal_or_static_name(self):
        directory = policy.select_staff([person()], UNITS)
        self.assertEqual(directory["staff"][0]["technicianId"], "1")
        self.assertEqual(directory["staff"][0]["cycle"], "advisor")

    def test_inactive_and_unmanaged_are_excluded(self):
        directory = policy.select_staff([person(), person(2, active=False), person(3, isManagedTech=False)], UNITS)
        self.assertEqual(len(directory["staff"]), 1)
        self.assertEqual(len(directory["excluded"]), 2)

    def test_transfer_uses_current_business_unit(self):
        row = policy.select_staff([person(unit=1)], UNITS)["staff"][0]
        self.assertEqual(row["department"], "HVAC Service")
        self.assertEqual(row["cycle"], "technician")

    def test_missing_email_keeps_management_report(self):
        self.assertIsNone(policy.select_staff([person(email=None)], UNITS)["staff"][0]["email"])

    def test_duplicate_id_refuses_untrustworthy_directory(self):
        with self.assertRaisesRegex(ValueError, "duplicate ID"):
            policy.select_staff([person(), person()], UNITS)

    def test_duplicate_display_names_do_not_silently_merge_people(self):
        with self.assertRaisesRegex(ValueError, "Duplicate active personnel names"):
            policy.select_staff([person(), person(2)], UNITS)

    def test_live_send_check_blocks_changed_recipient(self):
        directory = policy.select_staff([person()], UNITS)
        snapshot = {"sourceKind": "advisor", "cutoffDate": "2026-11-03", "technicians": directory["staff"]}
        updated = policy.select_staff([person(email="changed@irbishvac.com")], UNITS)
        with patch.object(policy, "central_personnel", return_value=updated):
            with self.assertRaisesRegex(ValueError, "changed since preparation"):
                policy.verify_live_personnel(snapshot, ["example.env"])

    def test_identity_join_survives_name_change_and_does_not_cross_ids(self):
        staff = policy.select_staff([person()], UNITS)["staff"][0]
        row = {"TechnicianId": "1", "Name": "Old Name", "TotalSales": "12"}
        self.assertEqual(policy.match_row([row], staff), row)
        self.assertEqual(policy.match_row([{"TechnicianId": "2", "Name": "New Advisor"}], staff), {})

    def test_ambiguous_name_only_source_blocks(self):
        staff = policy.select_staff([person()], UNITS)["staff"][0]
        with self.assertRaisesRegex(ValueError, "Ambiguous"):
            policy.match_row([{"Name": "New Advisor"}, {"Name": "New Advisor"}], staff)

    def test_stale_directory_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/"staff.json"
            data = policy.select_staff([person()], UNITS)
            data["fetchedAt"] = "2026-01-01T00:00:00+00:00"
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "stale"):
                policy.load_staff(path, "advisor")

    def test_directory_refresh_is_bounded_between_weekly_runs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); (root/"generated").mkdir()
            directory=policy.select_staff([person()], UNITS)
            directory["fetchedAt"]=(datetime.now(timezone.utc)-timedelta(hours=7)).isoformat()
            (root/"generated/performance-personnel.json").write_text(json.dumps(directory))
            # The browser now reads the central API; this local guard only checks the source.
            fresh = policy.select_staff([person()], UNITS)
            with patch.object(policy, "central_personnel", return_value=fresh) as fetch:
                policy.refresh_personnel_if_due(root,root/"example.env",{},lambda *args: None)
                policy.refresh_personnel_if_due(root,root/"example.env",{},lambda *args: None)
                self.assertEqual(fetch.call_count, 1)

class GoalTests(unittest.TestCase):
    def test_previous_department_goal_does_not_follow_a_transfer(self):
        staff=policy.select_staff([person(unit=1)],UNITS)["staff"][0]
        old={"month":"2026-11","technicianId":"1","technician":"Previous Name","report_department":"Plumbing Service","approval_status":"ACTIVE","monthly_sales_goal":"30000"}
        goal=policy.goal_for(staff,[old],"2026-11")
        self.assertEqual(goal["approval_status"],"UPDATED_GOAL_PENDING")
        self.assertEqual(goal["report_department"],"HVAC Service")
        self.assertNotIn("monthly_sales_goal",goal)

    def test_75_is_november_standard_without_invented_sales_targets(self):
        staff = policy.select_staff([person()], UNITS)["staff"][0]
        goal = policy.goal_for(staff, [], "2026-11")
        self.assertEqual(goal["target_opportunities_monthly"], "75")
        self.assertEqual(goal["approval_status"], "UPDATED_GOAL_PENDING")
        self.assertNotIn("monthly_sales_goal", goal)
        self.assertNotIn("target_opportunities_monthly", policy.goal_for(staff, [], "2026-10"))

    def test_month_resolver_ignores_stale_explicit_env(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/"docs").mkdir()
            stale = root/"docs/september-2026-performance-goals.csv"
            stale.write_text("month,technician\n2026-09,New Advisor\n")
            self.assertIsNone(policy.monthly_goals(root, "2026-11", {"ADVISOR_REPORT_GOALS_FILE": str(stale)}, "advisor"))

    def test_weighted_raymond_proposal_uses_relative_15_percent_by_default(self):
        months = [{"sales": 100, "opportunities": 10, "closedOpportunities": 2, "complete": True}, {"sales": 900, "opportunities": 90, "closedOpportunities": 18, "complete": True}, {"sales": 0, "opportunities": 0, "closedOpportunities": 0, "complete": True, "employed": False}]
        draft = policy.calculate_advisor_proposal(months)
        self.assertEqual(draft["monthlySalesGoal"], 750)
        self.assertEqual(draft["targetAverage"], 75)
        self.assertAlmostEqual(draft["targetRate"], .23)
        self.assertFalse(draft["requiresCloseRateClarification"])
        self.assertEqual(draft["historyMonths"], 2)
        self.assertAlmostEqual(policy.calculate_advisor_proposal(months,"relative")["targetRate"], .23)
        self.assertAlmostEqual(policy.calculate_advisor_proposal(months,"percentage_points")["targetRate"], .35)

class TimingTests(unittest.TestCase):
    def test_automatic_send_slot_is_bishkek_only_and_explicitly_enabled(self):
        env={"PERFORMANCE_REPORT_AUTO_SEND":"true"}
        self.assertTrue(policy.automatic_send_due(datetime.fromisoformat("2026-11-05T19:40:00+06:00").astimezone(ZoneInfo("America/Los_Angeles")),env,"technician"))
        self.assertTrue(policy.automatic_send_due(datetime.fromisoformat("2026-11-06T19:44:59+06:00"),env,"advisor"))
        for stamp in ["2026-11-05T19:39:59+06:00","2026-11-05T19:45:00+06:00","2026-11-06T19:40:00+06:00"]:
            self.assertFalse(policy.automatic_send_due(datetime.fromisoformat(stamp),env,"technician"))
        self.assertFalse(policy.automatic_send_due(datetime.fromisoformat("2026-11-05T19:40:00+06:00"),{},"technician"))

    def test_automatic_send_requires_ready_package_and_skips_already_sent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); now=datetime.fromisoformat("2026-11-06T19:40:00+06:00")
            package=root/"2026-11-06"; package.mkdir()
            calls=[]
            def run(command,cwd): calls.append(command)
            env={"PERFORMANCE_REPORT_AUTO_SEND":"true"}
            with self.assertRaisesRegex(ValueError,"not ready"):
                policy.run_automatic_delivery(root,root,now,env,"advisor",run)
            (package/"preparation-state.json").write_text(json.dumps({"status":"ready","dataWindowComplete":True}))
            self.assertTrue(policy.run_automatic_delivery(root,root,now,env,"advisor",run))
            self.assertEqual(len(calls),1)
            self.assertIn("send",calls[0])
            (package/"delivery").mkdir()
            (package/"delivery/delivery-plan.json").write_text(json.dumps({"deliveryKey":"2026-11-05","reports":[{"slug":"staff-1"}]}))
            (package/"delivery/delivery-state.json").write_text(json.dumps({"deliveryKey":"2026-11-05","reports":{"staff-1":{"status":"sent"}}}))
            policy.run_automatic_delivery(root,root,now,env,"advisor",run)
            self.assertEqual(len(calls),1)

    def test_preparation_window_stays_bishkek_across_dst(self):
        for day in ("2026-10-29", "2026-11-05"):
            now=datetime.fromisoformat(day+"T18:30:00+06:00")
            self.assertTrue(technician._inside_delivery_window(now.astimezone(ZoneInfo("America/Los_Angeles")), {}))
        self.assertTrue(advisor._inside_delivery_window(datetime.fromisoformat("2026-11-06T18:30:00+06:00"), {}))
        self.assertFalse(advisor._inside_delivery_window(datetime.fromisoformat("2026-11-06T19:45:00+06:00"), {}))

    def test_early_partial_day_and_late_send_blocked(self):
        snapshot={"cutoffDate":"2026-10-29", "generatedAt":"2026-10-30T12:00:00+00:00", "sourceExportStartedAt":"2026-10-30T06:00:00+00:00"}
        with self.assertRaisesRegex(ValueError,"before"):
            policy.assert_send_ready(snapshot, datetime.fromisoformat("2026-10-30T13:30:00+00:00"))
        snapshot["sourceExportStartedAt"]="2026-10-30T12:00:00+00:00"
        policy.assert_send_ready(snapshot, datetime.fromisoformat("2026-10-30T13:30:00+00:00"))
        policy.assert_send_ready(snapshot, datetime.fromisoformat("2026-10-30T13:44:59+00:00"))
        with self.assertRaisesRegex(ValueError,"deadline"):
            policy.assert_send_ready(snapshot, datetime.fromisoformat("2026-10-30T13:45:00+00:00"))

class AdvisorBuilderTests(unittest.TestCase):
    def test_fourth_advisor_without_metrics_or_goals_is_renderable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            staff=policy.select_staff([person(i, f"Advisor {i}") for i in range(1,5)], UNITS)
            (root/"personnel.json").write_text(json.dumps(staff))
            for name in ["comfort_advisor_performance_scorecard", "fieldpro_technician_recording_activity", "fieldpro_recordings_per_technician", "technician_dashboard_productivity", "operations_performance"]:
                (root/(name+".csv")).write_text("Name,TechnicianId,TotalSales\nOld Name,1,100\n")
            policy.write_goals(root/"goals.csv", None, staff["staff"], "2026-11")
            argv=["builder", "--source-dir", str(root), "--baseline-source-dir", str(root), "--baseline-from-date", "2026-08-01", "--baseline-to-date", "2026-10-31", "--roster", str(root/"personnel.json"), "--goals", str(root/"goals.csv"), "--from-date", "2026-11-01", "--cutoff-date", "2026-11-05", "--output", str(root/"snapshot.json")]
            with patch.object(sys, "argv", argv):
                advisor_builder.main()
            result=json.loads((root/"snapshot.json").read_text())
            self.assertEqual(len(result["technicians"]), 4)
            self.assertEqual(result["technicians"][0]["actual"]["revenue"], 100)
            self.assertFalse(result["technicians"][3]["actualSourceAvailable"])
            self.assertEqual(result["technicians"][3]["personalizedTargets"]["targetOpportunitiesMonthly"], 75)

class TechnicianBuilderTests(unittest.TestCase):
    def test_next_thursday_new_employee_and_department_transfer_without_old_goals(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            directory = policy.select_staff([person(1, "New Tech", unit=1), person(2, "Transferred Tech", unit=3), person(3, "Inactive Tech", unit=1, active=False)], UNITS)
            (root/"personnel.json").write_text(json.dumps(directory))
            for name in ["technician_performance_board", "technician_performance_scorecard_vadim", "fieldpro_technician_recording_activity", "fieldpro_recordings_per_technician", "technician_dashboard_productivity", "field_conversion_report", "operations_performance"]:
                (root/(name+".csv")).write_text("Name,TechnicianId,TotalSales\nOld Tech Name,1,100\n")
            policy.write_goals(root/"goals.csv", None, directory["staff"], "2026-11")
            argv=["builder", "--source-dir", str(root), "--baseline-source-dir", str(root), "--roster", str(root/"personnel.json"), "--goals", str(root/"goals.csv"), "--from-date", "2026-11-01", "--cutoff-date", "2026-11-04", "--skip-api", "--output", str(root/"snapshot.json")]
            with patch.object(sys, "argv", argv):
                technician_builder.main()
            result=json.loads((root/"snapshot.json").read_text())
            self.assertEqual(len(result["technicians"]), 2)
            by_id={p["technicianId"]:p for p in result["technicians"]}
            self.assertEqual(by_id["1"]["actual"]["revenue"], 100)
            self.assertFalse(by_id["2"]["actualSourceAvailable"])
            self.assertEqual(by_id["2"]["department"], "HVAC Maintenance")
            self.assertEqual(by_id["2"]["plan"]["sourceMonth"], "2026-11")
            self.assertIsNone(by_id["2"]["personalizedTargets"]["targetAverage"])

if __name__ == "__main__":
    unittest.main()
