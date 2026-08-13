from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ADVISOR_ROSTER = {
    "raymondporras": "raymond-porras",
    "rudynoelzapien": "rudy-noel-zapien",
    "matthewstalcup": "matthew-stalcup",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the frozen Friday Comfort Advisor coaching snapshot."
    )
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--baseline-source-dir", required=True)
    parser.add_argument("--baseline-from-date", required=True)
    parser.add_argument("--baseline-to-date", required=True)
    parser.add_argument("--coaching-evidence")
    parser.add_argument("--goals", required=True)
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--cutoff-date", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report-version", default="V1")
    args = parser.parse_args()

    source = Path(args.source_dir)
    baseline_source = Path(args.baseline_source_dir)
    scorecard = _by_name(_rows(source / "comfort_advisor_performance_scorecard.csv"), "Name")
    baseline = _by_name(
        _rows(baseline_source / "comfort_advisor_performance_scorecard.csv"), "Name"
    )
    activity = _by_name(
        _rows(source / "fieldpro_technician_recording_activity.csv"),
        "Technicians_Name",
    )
    recordings = _by_name(
        _rows(source / "fieldpro_recordings_per_technician.csv"), "Technician_Name"
    )
    productivity = _by_name(
        _rows(source / "technician_dashboard_productivity.csv"), "Name"
    )
    operations = _by_name(_rows(source / "operations_performance.csv"), "Name")
    goals = {
        _identity(row.get("technician")): row
        for row in _rows(Path(args.goals))
        if _text(row.get("role")) == "HVAC Comfort Advisor"
    }

    evidence_by_slug: dict[str, dict[str, Any]] = {}
    evidence_generated_at: str | None = None
    if args.coaching_evidence:
        evidence = json.loads(Path(args.coaching_evidence).read_text(encoding="utf-8"))
        evidence_generated_at = evidence.get("generatedAt")
        evidence_by_slug = {
            str(row.get("slug")): row for row in evidence.get("technicians", [])
        }

    missing = sorted(set(ADVISOR_ROSTER) - set(scorecard))
    if missing:
        raise ValueError(
            "Advisor roster is missing from the current scorecard: " + ", ".join(missing)
        )

    technicians: list[dict[str, Any]] = []
    for identity, slug in ADVISOR_ROSTER.items():
        row = scorecard[identity]
        baseline_row = baseline.get(identity, {})
        activity_row = activity.get(identity, {})
        recording_row = recordings.get(identity, {})
        productivity_row = productivity.get(identity, {})
        operations_row = operations.get(identity, {})
        goal = goals.get(identity)
        if not goal:
            raise ValueError(f"Advisor goal is missing: {_text(row.get('Name'))}")
        _validate_goal(goal, _text(row.get("Name")), args.cutoff_date)

        evidence = evidence_by_slug.get(slug, {})
        timing = evidence.get("timing", {})
        reviews = evidence.get("reviews", {})
        completed_jobs = _integer(activity_row.get("Technicians_CompletedJobs")) or 0
        total_recordings = _integer(
            activity_row.get("FieldProTechnicianRecordingPerformance_Total_Recordings")
        ) or 0
        quality_recordings = _integer(
            activity_row.get("FieldProTechnicianRecordingPerformance_Quality_Recordings")
        ) or 0
        sales_opportunities = _integer(row.get("SalesOpportunity")) or 0
        close_rate = _number(row.get("CloseRateRolling")) or 0
        memberships_sold = _integer(operations_row.get("MembershipsSold")) or 0
        membership_opportunities = (
            _integer(operations_row.get("MembershipOpportunities")) or 0
        )

        technicians.append(
            {
                "slug": slug,
                "technician": _text(goal.get("technician")),
                "department": "HVAC Sales",
                "businessUnit": "HVAC - Sales",
                "technicianId": _text(row.get("TechnicianId")) or None,
                "email": _text(activity_row.get("Technicians_Email")) or None,
                "actualSourceAvailable": True,
                "plan": {
                    "sourceMonth": _text(goal.get("month")),
                    "approvalStatus": _text(goal.get("approval_status")),
                    "monthlySalesGoal": _number(goal.get("monthly_sales_goal")),
                    "membershipMonthlyGoal": _integer(
                        goal.get("membership_monthly_goal")
                    ),
                    "membershipConversionGoal": _number(
                        goal.get("membership_conversion_goal")
                    ),
                    "reviewMonthlyGoal": _integer(goal.get("review_monthly_goal")),
                    "leadsSetGoal": None,
                    "installSalesGoal": None,
                    "installSalesActualSource": None,
                    "workingDaysMonthly": _integer(goal.get("working_days")),
                    "sourceNote": _text(goal.get("source_note")),
                },
                "actual": {
                    "revenue": _number(row.get("TotalSales")) or 0,
                    "opportunities": sales_opportunities,
                    "closedOpportunities": round(sales_opportunities * close_rate),
                    "rate": close_rate,
                    "averageSale": _number(row.get("ClosedAverageSale")) or 0,
                    "membershipsSold": memberships_sold,
                    "membershipOpportunities": membership_opportunities,
                    "membershipConversionRate": (
                        memberships_sold / membership_opportunities
                        if membership_opportunities
                        else 0
                    ),
                    "leadsSet": _integer(row.get("TechLeadJobs")) or 0,
                    "replacementOpportunities": 0,
                    "replacementLeadConversionRate": 0,
                    "totalLeadSales": _number(row.get("TotalSalesFromTgl")) or 0,
                    "installSales": None,
                    "techLeadJobs": _integer(row.get("TechLeadJobs")) or 0,
                    "closeRateFromTgl": _number(row.get("CloseRateFromTgl")),
                    "totalSalesFromTgl": _number(row.get("TotalSalesFromTgl")) or 0,
                    "closeRateFromMarketingLeads": _number(
                        row.get("CloseRateFromMarketingLeads")
                    ),
                    "totalSalesFromMarketingLeads": _number(
                        row.get("TotalSalesFromMarketingLeads")
                    )
                    or 0,
                },
                "execution": {
                    "completedJobs": completed_jobs,
                    "optionsPerOpportunity": _number(
                        productivity_row.get("OptionsPerOpportunity")
                    ),
                    "recallsCaused": 0,
                    "arrivalEligibleAppointments": timing.get(
                        "arrivalEligibleAppointments"
                    ),
                    "onTimeFirstHalfAppointments": timing.get(
                        "onTimeFirstHalfAppointments"
                    ),
                    "onTimeArrivalRate": timing.get("onTimeArrivalRate"),
                    "onsiteEligibleAppointments": timing.get(
                        "onsiteEligibleAppointments"
                    ),
                    "averageTimeOnSiteMinutes": timing.get(
                        "averageTimeOnSiteMinutes"
                    ),
                    "hhrEffectiveDate": None,
                    "hhrEligibleJobs": None,
                    "hhrCompletedJobs": None,
                    "hhrCompletionRate": None,
                    "reviewsReceived": (
                        reviews.get("totalEvidenceReviews")
                        if reviews.get("sourceAvailable")
                        else None
                    ),
                    "serviceTitanAssignedReviews": (
                        reviews.get("serviceTitanAssignedReviews")
                        if reviews.get("sourceAvailable")
                        else None
                    ),
                    "textMatchedReviews": (
                        reviews.get("textMatchedReviews")
                        if reviews.get("sourceAvailable")
                        else None
                    ),
                    "averageReviewRating": (
                        reviews.get("averageRating")
                        if reviews.get("sourceAvailable")
                        else None
                    ),
                },
                "personalizedTargets": {
                    "baselineFromDate": args.baseline_from_date,
                    "baselineToDate": args.baseline_to_date,
                    "baselineOpportunities": _integer(
                        baseline_row.get("SalesOpportunity")
                    ),
                    "baselineRate": _number(baseline_row.get("CloseRateRolling")),
                    "baselineAverageSale": _number(
                        baseline_row.get("ClosedAverageSale")
                    ),
                    "targetOpportunitiesMonthly": _integer(
                        goal.get("target_opportunities_monthly")
                    ),
                    "dailyOpportunityGoal": _number(
                        goal.get("daily_opportunity_goal")
                    ),
                    "targetRate": _number(goal.get("target_rate")),
                    "targetRateType": "close",
                    "targetAverage": _number(goal.get("target_average")),
                    "rateBenchmark": 0.70,
                    "rateStep": 0.05,
                    "averageLift": 0.10,
                },
                "fieldPro": {
                    "completedJobs": completed_jobs,
                    "totalRecordings": total_recordings,
                    "qualityRecordings": quality_recordings,
                    "recordingCoverage": (
                        total_recordings / completed_jobs if completed_jobs else None
                    ),
                    "qualityRecordingRate": (
                        _number(
                            activity_row.get(
                                "FieldProTechnicianRecordingPerformance_Quality_Recordings_Rate"
                            )
                        )
                        if total_recordings
                        else None
                    ),
                    "averageRecordingMinutes": _number(
                        recording_row.get("Avg_Recording_Duration_Minutes")
                    ),
                    "longestRecordingMinutes": None,
                    "recordedJobs": [],
                },
                "audit": _audit(timing, args.from_date, args.cutoff_date),
            }
        )

    missing_email = [row["technician"] for row in technicians if not row["email"]]
    if missing_email:
        raise ValueError("Advisor email is missing: " + ", ".join(missing_email))

    output = {
        "schemaVersion": 4,
        "reportVersion": args.report_version,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "periodFrom": args.from_date,
        "cutoffDate": args.cutoff_date,
        "serviceTitanSnapshotTime": None,
        "auditCycleAt": evidence_generated_at,
        "auditSource": "MTD ServiceTitan appointments evaluated with Dispatcher Auditor timing criteria",
        "technicians": sorted(technicians, key=lambda item: item["technician"]),
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"advisors={len(technicians)}")
    print("missing_email=none")
    print(f"wrote={output_path}")
    return 0


def _audit(timing: dict[str, Any], from_date: str, cutoff_date: str) -> dict[str, Any]:
    eligible = timing.get("arrivalEligibleAppointments")
    on_time = timing.get("onTimeFirstHalfAppointments")
    if not isinstance(eligible, int) or not isinstance(on_time, int):
        return {
            "status": "coverage_unavailable",
            "matchedAlerts": [],
            "coverageNote": "ServiceTitan appointment evidence was unavailable; no audit result is reported as zero.",
        }
    late = max(0, eligible - on_time)
    alerts = []
    if late:
        alerts.append(
            {
                "jobId": "",
                "ruleId": "arrival_after_first_half",
                "severity": "medium",
                "title": f"{late} of {eligible} arrivals were after the first half of the window",
            }
        )
    return {
        "status": "has_alerts" if alerts else "no_matched_alerts",
        "matchedAlerts": alerts,
        "coverageNote": f"MTD timing checks covered {eligible} assigned appointments from {from_date} through {cutoff_date}.",
    }


def _validate_goal(goal: dict[str, str], name: str, cutoff_date: str) -> None:
    if _text(goal.get("approval_status")) != "ACTIVE":
        raise ValueError(f"{name} advisor goal must be ACTIVE")
    if _text(goal.get("month")) != cutoff_date[:7]:
        raise ValueError(f"{name} advisor goal month must be {cutoff_date[:7]}")
    required = (
        "monthly_sales_goal",
        "target_opportunities_monthly",
        "daily_opportunity_goal",
        "target_rate",
        "target_average",
        "membership_monthly_goal",
        "review_monthly_goal",
        "working_days",
    )
    missing = [field for field in required if _number(goal.get(field)) is None]
    if missing:
        raise ValueError(f"{name} advisor goal is missing: {', '.join(missing)}")


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _by_name(rows: list[dict[str, str]], key: str) -> dict[str, dict[str, str]]:
    return {_identity(row.get(key)): row for row in rows if _identity(row.get(key))}


def _identity(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", _text(value).lower())


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float | None:
    text = _text(value)
    if not text:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _integer(value: Any) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None


if __name__ == "__main__":
    raise SystemExit(main())
