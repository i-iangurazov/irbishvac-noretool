from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import sys


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

import run_service_tech_thursday_delivery as runner
import send_service_tech_reports as sender
import build_service_tech_delivery_snapshot as snapshot_builder
import build_advisor_delivery_snapshot as advisor_snapshot_builder


class ScheduleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env = {
            "TECH_REPORT_SEND_WEEKDAY": "THU",
            "TECH_REPORT_SEND_HOUR": "6",
            "TECH_REPORT_SEND_MINUTE": "30",
            "TECH_REPORT_SEND_WINDOW_MINUTES": "20",
        }
        self.zone = ZoneInfo("Asia/Bishkek")
        self.env.update({"TECH_REPORT_SEND_HOUR": "18", "TECH_REPORT_SEND_MINUTE": "30", "TECH_REPORT_SEND_WINDOW_MINUTES": "75"})

    def test_thursday_window_is_inclusive_at_start(self) -> None:
        now = datetime(2026, 8, 6, 18, 30, tzinfo=self.zone)
        self.assertTrue(runner._inside_delivery_window(now, self.env))

    def test_thursday_window_is_exclusive_at_end(self) -> None:
        now = datetime(2026, 8, 6, 19, 45, tzinfo=self.zone)
        self.assertFalse(runner._inside_delivery_window(now, self.env))

    def test_other_weekday_is_rejected(self) -> None:
        now = datetime(2026, 8, 7, 6, 30, tzinfo=self.zone)
        self.assertFalse(runner._inside_delivery_window(now, self.env))


class PackageValidationTests(unittest.TestCase):
    def test_valid_package_requires_matching_passed_qa(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            pdf = root / "hvac-tech-mtd-through-2026-08-05.pdf"
            pdf.write_bytes(b"%PDF-1.7\n" + b"0" * 10_000)
            (root / "qa-results.json").write_text(
                json.dumps([{"slug": "tech", "ok": True}]), encoding="utf-8"
            )
            manifest = {
                "periodFrom": "2026-08-01",
                "cutoffDate": "2026-08-05",
                "reportVersion": "V6-DRAFT",
                "reports": [
                    {
                        "slug": "tech",
                        "technician": "Test Tech",
                        "department": "HVAC Service",
                        "email": "tech@example.com",
                        "fileName": pdf.name,
                    }
                ],
            }
            snapshot = {
                "periodFrom": "2026-08-01",
                "cutoffDate": "2026-08-05",
                "reportVersion": "V6-DRAFT",
                "technicians": [{"slug": "tech", "technician": "Test Tech", "department": "HVAC Service", "email": "tech@example.com"}],
            }
            reports = sender._validate_package(manifest, snapshot, root)
            self.assertEqual(len(reports), 1)
            manifest["reports"][0]["email"] = "wrong@example.com"
            with self.assertRaisesRegex(ValueError, "Manifest email differs"):
                sender._validate_package(manifest, snapshot, root)

    def test_failed_qa_blocks_delivery(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            pdf = root / "hvac-tech-mtd-through-2026-08-05.pdf"
            pdf.write_bytes(b"%PDF-1.7\n" + b"0" * 10_000)
            (root / "qa-results.json").write_text(
                json.dumps([{"slug": "tech", "ok": False}]), encoding="utf-8"
            )
            manifest = {
                "periodFrom": "2026-08-01",
                "cutoffDate": "2026-08-05",
                "reportVersion": "V6-DRAFT",
                "reports": [
                    {
                        "slug": "tech",
                        "technician": "Test Tech",
                        "department": "HVAC Service",
                        "email": "tech@example.com",
                        "fileName": pdf.name,
                    }
                ],
            }
            snapshot = {
                "periodFrom": "2026-08-01",
                "cutoffDate": "2026-08-05",
                "reportVersion": "V6-DRAFT",
                "technicians": [{"slug": "tech"}],
            }
            with self.assertRaisesRegex(ValueError, "failed visual QA"):
                sender._validate_package(manifest, snapshot, root)


class RoutingTests(unittest.TestCase):
    def test_unique_emails_excludes_technician_from_cc(self) -> None:
        result = sender._unique_emails(
            ["tim@example.com", "manager@example.com", "tim@example.com"],
            excluded="tech@example.com",
        )
        self.assertEqual(result, ["tim@example.com", "manager@example.com"])

    def test_message_omits_cc_header_when_route_has_no_cc(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            attachment = Path(temporary) / "report.pdf"
            attachment.write_bytes(b"%PDF-1.7\nexample")
            row = {
                "kind": "individual",
                "technician": "Test Advisor",
                "subject": "Test report",
                "to": ["advisor@example.com"],
                "cc": [],
                "attachment": str(attachment),
            }
            message = sender._message(
                row, "reports@example.com", "2026-08-13", "<test@example.com>"
            )
            self.assertNotIn("Cc", message)

    def test_department_management_message_has_group_recipients_without_cc(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            attachment = Path(temporary) / "combined.pdf"
            attachment.write_bytes(b"%PDF-1.7\nexample")
            row = {
                "kind": "management",
                "recipientName": "HVAC Service leadership team",
                "managementDepartment": "HVAC Service",
                "includedTechnicians": ["Tech One", "Tech Two"],
                "technician": "HVAC Service",
                "subject": "HVAC reports",
                "to": ["ben@example.com", "vadim@example.com", "tim@example.com"],
                "cc": [],
                "attachment": str(attachment),
            }
            message = sender._message(
                row, "reports@example.com", "2026-08-19", "<test@example.com>"
            )
            self.assertEqual(
                message["To"],
                "ben@example.com, vadim@example.com, tim@example.com",
            )
            self.assertNotIn("Cc", message)
            self.assertIn(
                "combined IRBIS HVAC Service",
                message.get_body().get_content(),
            )
            self.assertIn(
                "Each technician is receiving",
                message.get_body().get_content(),
            )

    def test_management_message_describes_combined_sales_packet(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            attachment = Path(temporary) / "combined.pdf"
            attachment.write_bytes(b"%PDF-1.7\nexample")
            row = {
                "kind": "management",
                "recipientName": "Tim",
                "technician": "Tim",
                "subject": "Sales reports",
                "to": ["tim@example.com"],
                "cc": [],
                "attachment": str(attachment),
            }
            message = sender._message(
                row, "reports@example.com", "2026-08-13", "<test@example.com>"
            )
            self.assertIn("combined IRBIS Sales Department", message.get_body().get_content())
            self.assertNotIn("Cc", message)


class AugustGoalsTests(unittest.TestCase):
    def test_every_delivery_technician_has_an_august_goal_record(self) -> None:
        goals_path = SCRIPTS_DIR.parent / "docs" / "august-2026-performance-goals.csv"
        rows = snapshot_builder._rows(goals_path)
        by_name = {snapshot_builder._identity(row["technician"]): row for row in rows}

        for identity in [key for key, row in by_name.items() if row["role"] != "HVAC Comfort Advisor"]:
            self.assertIn(identity, by_name)
            goal = by_name[identity]
            snapshot_builder._validate_active_goal(goal, goal["technician"], "2026-08-05")
            self.assertIn(goal["approval_status"], {"ACTIVE", "UPDATED_GOAL_PENDING"})
            self.assertEqual(int(goal["review_monthly_goal"]), 10)

    def test_vadim_goal_values_and_bekbol_pending_status_are_preserved(self) -> None:
        goals_path = SCRIPTS_DIR.parent / "docs" / "august-2026-performance-goals.csv"
        by_name = {
            snapshot_builder._identity(row["technician"]): row
            for row in snapshot_builder._rows(goals_path)
        }

        self.assertEqual(float(by_name["ethanpeters"]["monthly_sales_goal"]), 15000)
        self.assertEqual(int(by_name["ethanpeters"]["target_opportunities_monthly"]), 25)
        self.assertEqual(float(by_name["ethanpeters"]["target_rate"]), 0.60)
        self.assertEqual(float(by_name["ethanpeters"]["target_average"]), 600)
        self.assertEqual(by_name["bekbolkenzheev"]["approval_status"], "UPDATED_GOAL_PENDING")
        self.assertEqual(by_name["bekbolkenzheev"]["monthly_sales_goal"], "")
        self.assertEqual(by_name["bekbolkenzheev"]["target_rate"], "")

    def test_explicit_written_close_rate_goals_are_not_silently_capped(self) -> None:
        goals_path = SCRIPTS_DIR.parent / "docs" / "august-2026-performance-goals.csv"
        by_name = {
            snapshot_builder._identity(row["technician"]): row
            for row in snapshot_builder._rows(goals_path)
        }

        self.assertEqual(float(by_name["ivanavila"]["target_rate"]), 0.87)
        self.assertEqual(float(by_name["almazshamsharbek"]["target_rate"]), 0.81)


class SeptemberActualsOnlyTests(unittest.TestCase):
    def setUp(self) -> None:
        # Missing-goal behavior is independent of a private historical staff CSV.
        blank = {key: "" for key in ("monthly_sales_goal", "target_opportunities_monthly", "daily_opportunity_goal", "target_rate", "target_average", "membership_conversion_goal", "membership_monthly_goal", "install_sales_goal")}
        self.rows = [
            {**blank, "technician": "Example Technician", "month": "2026-09", "report_department": "HVAC Service", "role": "Service Technician", "approval_status": "UPDATED_GOAL_PENDING"},
            {**blank, "technician": "Example Advisor", "month": "2026-09", "report_department": "HVAC Sales", "role": "HVAC Comfort Advisor", "approval_status": "UPDATED_GOAL_PENDING"},
        ]
        self.by_name = {
            snapshot_builder._identity(row["technician"]): row for row in self.rows
        }

    def test_service_roster_accepts_pending_rows_without_targets(self) -> None:
        goal_fields = (
            "monthly_sales_goal",
            "target_opportunities_monthly",
            "daily_opportunity_goal",
            "target_rate",
            "target_average",
            "membership_conversion_goal",
            "membership_monthly_goal",
            "install_sales_goal",
        )
        pending_goals = [
            self.by_name[identity]
            for identity in self.by_name
            if self.by_name[identity]["role"] != "HVAC Comfort Advisor"
            if self.by_name[identity]["approval_status"] == "UPDATED_GOAL_PENDING"
        ]
        self.assertTrue(pending_goals)
        for goal in pending_goals:
            snapshot_builder._validate_active_goal(
                goal, goal["technician"], "2026-09-02"
            )
            self.assertEqual(goal["approval_status"], "UPDATED_GOAL_PENDING")
            self.assertTrue(all(goal[field] == "" for field in goal_fields))

    def test_advisor_roster_accepts_pending_rows_without_targets(self) -> None:
        for identity in [key for key, row in self.by_name.items() if row["role"] == "HVAC Comfort Advisor"]:
            goal = self.by_name[identity]
            advisor_snapshot_builder._validate_goal(
                goal, goal["technician"], "2026-09-03"
            )
            self.assertEqual(goal["approval_status"], "UPDATED_GOAL_PENDING")
            self.assertEqual(goal["monthly_sales_goal"], "")

if __name__ == "__main__":
    unittest.main()
