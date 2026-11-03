"""Use the same normalized metrics and approved goals as the dashboard in a frozen PDF package."""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def apply_canonical(snapshot: dict, canonical: dict) -> dict:
    if (snapshot["periodFrom"], snapshot["cutoffDate"]) != (canonical["periodFrom"], canonical["cutoffDate"]):
        raise ValueError("Canonical dashboard and PDF periods differ")
    rows = canonical["dashboard"]["rows"]
    by_id = {str(row["technicianId"]): row for row in rows}
    if len(by_id) != len(rows) or set(by_id) != {str(row["technicianId"]) for row in snapshot["technicians"]}:
        raise ValueError("Canonical dashboard and PDF employee IDs differ")
    staff = {person["technicianId"]: person for person in canonical["directory"]["staff"]}
    cycle = canonical["sourceKind"]
    for report in snapshot["technicians"]:
        key = str(report["technicianId"])
        row = by_id[key]
        person = staff[key]
        goal = person["goal"]
        if goal["month"] != snapshot["cutoffDate"][:7] or goal["report_department"] != report["department"]:
            raise ValueError("Canonical PDF goal month or department differs")
        report["email"] = person["email"]
        report["actualSourceAvailable"] = row.get("actualSourceAvailable", True)
        actual = report["actual"]
        if cycle == "advisor":
            actual.update(revenue=row["totalSales"], opportunities=row["salesOpportunitiesCount"],
                          closedOpportunities=row["closedOpportunitiesCount"], rate=row["closeRateRolling"], averageSale=row["closedAverageSale"])
        else:
            actual.update(revenue=row["totalSales"], opportunities=row["salesOpportunity"],
                          closedOpportunities=row["closedOpportunities"], rate=row["closeRate"], averageSale=row["avgSaleFromOpps"],
                          membershipsSold=row["membershipsSold"], membershipOpportunities=row["membershipOpportunities"],
                          membershipConversionRate=row["techMembershipConvPct"], leadsSet=row["leadsSet"],
                          replacementOpportunities=row["replacementOpportunity"], replacementLeadConversionRate=row["replacementLeadConvRate"],
                          totalLeadSales=row["totalTechLeadSales"])
        report["plan"].update(sourceMonth=goal["month"], approvalStatus=goal["approval_status"],
                              monthlySalesGoal=goal["monthly_sales_goal"], membershipMonthlyGoal=goal["membership_monthly_goal"],
                              reviewMonthlyGoal=goal["review_monthly_goal"], workingDaysMonthly=goal["working_days"], sourceNote=goal["source_note"])
        report.setdefault("personalizedTargets", {}).update(targetOpportunitiesMonthly=goal["target_opportunities_monthly"],
                                                            targetRate=goal["target_rate"], targetAverage=goal["target_average"])
    snapshot.update(canonicalSource=True, canonicalMetricBasis="total-sales", serviceTitanSnapshotTime=canonical["dashboard"]["snapshotTime"],
                    rosterFetchedAt=canonical["directory"]["fetchedAt"], sourceKind=cycle)
    return snapshot


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--canonical", required=True)
    args = parser.parse_args()
    target = Path(args.snapshot)
    result = apply_canonical(json.loads(target.read_text()), json.loads(Path(args.canonical).read_text()))
    target.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
