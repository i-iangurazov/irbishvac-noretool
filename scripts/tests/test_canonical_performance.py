from __future__ import annotations
import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from apply_canonical_performance import apply_canonical


class CanonicalPerformanceTests(unittest.TestCase):
    def setUp(self):
        self.goal = dict(month="2026-11", report_department="HVAC Service", approval_status="ACTIVE", monthly_sales_goal=1000,
                         membership_monthly_goal=None, review_monthly_goal=None, working_days=None, source_note="Approved",
                         target_opportunities_monthly=75, target_rate=.5, target_average=100)
        self.snapshot = dict(periodFrom="2026-11-01", cutoffDate="2026-11-04", technicians=[dict(
            technicianId="1", department="HVAC Service", actual={}, plan={}, personalizedTargets={})])
        row = dict(technicianId="1", totalSales=250, totalInfluencedRevenue=900, salesOpportunity=10,
                   closedOpportunities=5, closeRate=.5, avgSaleFromOpps=50, membershipsSold=2, membershipOpportunities=8,
                   techMembershipConvPct=.25, leadsSet=3, replacementOpportunity=4, replacementLeadConvRate=.75, totalTechLeadSales=100)
        self.canonical = dict(periodFrom="2026-11-01", cutoffDate="2026-11-04", sourceKind="technician",
                              dashboard=dict(rows=[row], snapshotTime="2026-11-05T08:00:00Z"),
                              directory=dict(fetchedAt="2026-11-05T08:00:00Z", staff=[dict(technicianId="1", email="a@example.com", goal=self.goal)]))

    def test_uses_the_same_sales_metric_as_the_dashboard_sales_goal(self):
        report = apply_canonical(self.snapshot, self.canonical)
        self.assertEqual(report["technicians"][0]["actual"]["revenue"], 250)
        self.assertEqual(report["technicians"][0]["personalizedTargets"]["targetRate"], .5)
        self.assertTrue(report["canonicalSource"])

    def test_uses_complete_matching_recordings_by_employee_id_without_turning_missing_durations_into_zero(self):
        self.canonical["fieldProRecordings"]={"status":"available","from":"2026-11-01","to":"2026-11-04","rows":[
            {"technicianId":"1","jobId":"10","durationMinutes":5.9},
            {"technicianId":"1","jobId":"11","durationMinutes":None},
            {"technicianId":"2","jobId":"12","durationMinutes":999}]}
        result=apply_canonical(self.snapshot,self.canonical)["technicians"][0]["fieldPro"]
        self.assertEqual(result["longestRecordingMinutes"],5.9)
        self.assertEqual(result["averageRecordingMinutes"],5.9)
        self.assertEqual(len(result["recordedJobs"]),2)

    def test_rejects_a_different_period_or_employee_roster(self):
        other = copy.deepcopy(self.canonical)
        other["cutoffDate"] = "2026-11-03"
        with self.assertRaisesRegex(ValueError, "periods differ"):
            apply_canonical(self.snapshot, other)
        other = copy.deepcopy(self.canonical)
        other["dashboard"]["rows"][0]["technicianId"] = "2"
        with self.assertRaisesRegex(ValueError, "employee IDs differ"):
            apply_canonical(self.snapshot, other)

    def test_rejects_previous_department_and_previous_month_goals(self):
        for field, value in [("month", "2026-10"), ("report_department", "Plumbing Service")]:
            other = copy.deepcopy(self.canonical)
            other["directory"]["staff"][0]["goal"][field] = value
            with self.assertRaisesRegex(ValueError, "goal month or department"):
                apply_canonical(self.snapshot, other)


if __name__ == "__main__":
    unittest.main()
