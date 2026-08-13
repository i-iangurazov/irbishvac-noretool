from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.request import urlopen


SERVICE_BUSINESS_UNITS = {
    "HVAC - Service",
    "HVAC - Maintenance",
    "Plumbing - Service",
}

# Current dispatch roster confirmed by Marketing on 2026-07-27. Bahruz Brian
# Rasulov and Le'Jhavani De La Cruz-Robello were explicitly marked as exclusions.
DELIVERY_ROSTER = {
    "christianlopez": "HVAC Service",
    "eduardoloeragaeta": "HVAC Service",
    "jonathancamargo": "HVAC Service",
    "ivanavila": "HVAC Service",
    "ethanpeters": "HVAC Maintenance",
    "almazshamsharbek": "HVAC Maintenance",
    "kennethcox": "Commercial Service / Sales",
    "christianvasquez": "Plumbing Service",
    "azatakynov": "Plumbing Service",
    "bekbolkenzheev": "Plumbing Service",
}

DELIVERY_BUSINESS_UNITS = {
    "HVAC Service": "HVAC - Service",
    "HVAC Maintenance": "HVAC - Maintenance",
    "Commercial Service / Sales": "HVAC - Service",
    "Plumbing Service": "Plumbing - Service",
}

DELIVERY_EMAIL_FALLBACKS = {
    "bekbolkenzheev": "bekbol@irbishvac.com",
}

SLUGS = {
    "almazshamsharbek": "almaz-shamsharbek",
    "azatakynov": "azat-akynov",
    "bahruzbrianrasulov": "bahruz-brian-rasulov",
    "bekbolkenzheev": "bekbol-kenzheev",
    "christianlopez": "christian-lopez",
    "christianvasquez": "christian-vasquez",
    "christianvazquez": "christian-vasquez",
    "eduardoloeragaeta": "eduardo-loera-gaeta",
    "ethanpeters": "ethan-peters",
    "ivanavila": "ivan-avila",
    "jonathancamargo": "jonathan-camargo",
    "kennethcox": "kenneth-cox",
    "lejhavanidelacruzrobello": "le-jhavani-de-la-cruz-robello",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a frozen MTD delivery snapshot for HVAC and Plumbing service reports."
    )
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--baseline-source-dir")
    parser.add_argument("--baseline-from-date")
    parser.add_argument("--baseline-to-date")
    parser.add_argument("--coaching-evidence")
    parser.add_argument("--goals", default="docs/august-2026-performance-goals.csv")
    parser.add_argument("--api-base", default="http://localhost:3001/api")
    parser.add_argument("--skip-api", action="store_true")
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--cutoff-date", required=True)
    parser.add_argument("--output", default="generated/service-tech-mtd-delivery.tmp.json")
    parser.add_argument("--audit-cycle-at")
    parser.add_argument("--report-version", default="V4")
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    goals = _rows(Path(args.goals))
    board = _rows(source_dir / "technician_performance_board.csv")
    productivity = _by_name(_rows(source_dir / "technician_dashboard_productivity.csv"), "Name")
    activity = _by_name(_rows(source_dir / "fieldpro_technician_recording_activity.csv"), "Technicians_Name")
    recordings = _by_name(_rows(source_dir / "fieldpro_recordings_per_technician.csv"), "Technician_Name")
    operations = _by_name(_rows(source_dir / "operations_performance.csv"), "Name")
    conversion = _by_name(_rows(source_dir / "field_conversion_report.csv"), "Name")
    vadim_scorecard = _by_name(
        _rows(source_dir / "technician_performance_scorecard_vadim.csv"), "Name"
    )
    for lookup in (productivity, activity, recordings, operations, conversion, vadim_scorecard):
        lookup["christianvasquez"] = lookup.get("christianvasquez") or lookup.get("christianvazquez", {})
    baseline_by_name: dict[str, dict[str, str]] = {}
    if args.baseline_source_dir:
        baseline_dir = Path(args.baseline_source_dir)
        baseline_scorecard = baseline_dir / "technician_performance_scorecard_vadim.csv"
        baseline_source = (
            baseline_scorecard
            if baseline_scorecard.exists()
            else baseline_dir / "technician_performance_board.csv"
        )
        baseline_by_name = _by_name(
            _rows(baseline_source),
            "Name",
        )
        baseline_by_name["christianvasquez"] = baseline_by_name.get("christianvazquez", {})
    coaching_evidence_by_slug: dict[str, dict[str, Any]] = {}
    coaching_evidence_generated_at: str | None = None
    if args.coaching_evidence:
        coaching_evidence = json.loads(Path(args.coaching_evidence).read_text(encoding="utf-8"))
        coaching_evidence_generated_at = coaching_evidence.get("generatedAt")
        coaching_evidence_by_slug = {
            row["slug"]: row for row in coaching_evidence.get("technicians", [])
        }
    goals_by_name = {_identity(row.get("technician")): row for row in goals}
    goals_by_name["christianvazquez"] = goals_by_name["christianvasquez"]
    current_board_identities = {
        "christianvasquez" if _identity(row.get("Name")) == "christianvazquez" else _identity(row.get("Name"))
        for row in board
    }
    for identity, department in DELIVERY_ROSTER.items():
        if identity in current_board_identities:
            continue
        goal = goals_by_name.get(identity)
        baseline_row = baseline_by_name.get(identity, {})
        if not goal:
            continue
        board.append(
            {
                "Name": _text(goal.get("technician")),
                "TechnicianBusinessUnit": _text(
                    baseline_row.get("TechnicianBusinessUnit")
                )
                or DELIVERY_BUSINESS_UNITS[department],
                "TechnicianId": _text(baseline_row.get("TechnicianId")),
            }
        )

    dashboard: dict[str, Any] = {"rowsRanked": [], "snapshotTime": None}
    if not args.skip_api:
        with urlopen(f"{args.api_base}/dashboard/performance/technicians?preset=mtd", timeout=30) as response:
            dashboard = json.load(response)
    actuals_by_name = {_identity(row.get("name")): row for row in dashboard.get("rowsRanked", [])}

    technicians: list[dict[str, Any]] = []
    for board_row in board:
        business_unit = _text(board_row.get("TechnicianBusinessUnit"))
        if business_unit not in SERVICE_BUSINESS_UNITS:
            continue

        identity = _identity(board_row.get("Name"))
        if identity == "christianvazquez":
            identity = "christianvasquez"
        if identity not in DELIVERY_ROSTER:
            continue
        goal = goals_by_name.get(identity)
        slug = SLUGS.get(identity)
        if not goal or not slug:
            continue
        if goal.get("report_department") == "Plumbing Sales":
            continue
        _validate_active_goal(goal, _text(board_row.get("Name")), args.cutoff_date)

        productivity_row = productivity.get(identity, {})
        activity_row = activity.get(identity, {})
        recordings_row = recordings.get(identity, {})
        operations_row = operations.get(identity, {})
        conversion_row = conversion.get(identity, {})
        scorecard_row = vadim_scorecard.get(identity, {})
        baseline_row = baseline_by_name.get(identity, {})
        coaching_evidence_row = coaching_evidence_by_slug.get(slug, {})
        timing_evidence = coaching_evidence_row.get("timing", {})
        hhr_evidence = coaching_evidence_row.get("homeHealthReport", {})
        review_evidence = coaching_evidence_row.get("reviews", {})
        dashboard_row = actuals_by_name.get(identity)
        current_source_available = identity in current_board_identities

        completed_jobs = _integer(board_row.get("CompletedJobs")) or 0
        total_recordings = _integer(
            activity_row.get("FieldProTechnicianRecordingPerformance_Total_Recordings")
        ) or 0
        quality_recordings = _integer(
            activity_row.get("FieldProTechnicianRecordingPerformance_Quality_Recordings")
        ) or 0

        if scorecard_row:
            actual = {
                "revenue": _number(scorecard_row.get("TotalSales")) or 0,
                "opportunities": _integer(scorecard_row.get("SalesOpportunity")) or 0,
                "closedOpportunities": _integer(scorecard_row.get("ClosedOpportunities")) or 0,
                "rate": _number(scorecard_row.get("CloseRate")) or 0,
                "averageSale": _number(scorecard_row.get("OpportunityAverageSale")) or 0,
                "membershipsSold": _integer(scorecard_row.get("MembershipsSold")) or 0,
                "membershipOpportunities": _integer(scorecard_row.get("MembershipOpportunities")) or 0,
                "membershipConversionRate": _number(scorecard_row.get("MembershipConversionRate")) or 0,
                "leadsSet": _integer(scorecard_row.get("LeadsSet")) or 0,
                "replacementOpportunities": _integer(scorecard_row.get("ReplacementOpportunity")) or 0,
                "replacementLeadConversionRate": _number(scorecard_row.get("ReplacementLeadConversionRate")) or 0,
                "totalLeadSales": _number(scorecard_row.get("TotalLeadSales")) or 0,
            }
        elif dashboard_row:
            actual = {
                "revenue": _number(dashboard_row.get("totalInfluencedRevenue")) or 0,
                "opportunities": _integer(dashboard_row.get("salesOpportunity")) or 0,
                "closedOpportunities": _integer(dashboard_row.get("closedOpportunities")) or 0,
                "rate": _number(dashboard_row.get("closeRate")) or 0,
                "averageSale": _number(dashboard_row.get("avgSaleFromOpps")) or 0,
                "membershipsSold": _integer(dashboard_row.get("membershipsSold")) or 0,
                "membershipOpportunities": _integer(operations_row.get("MembershipOpportunities")) or 0,
                "membershipConversionRate": _number(operations_row.get("MembershipConversionRate")) or 0,
                "leadsSet": _integer(operations_row.get("LeadsSet")) or 0,
                "replacementOpportunities": _integer(conversion_row.get("ReplacementOpportunity")) or 0,
                "replacementLeadConversionRate": _number(conversion_row.get("ReplacementLeadConversionRate")) or 0,
                "totalLeadSales": _number(operations_row.get("TotalLeadSales")) or 0,
            }
        else:
            actual = {
                "revenue": _number(board_row.get("CompletedRevenue")) or 0,
                "opportunities": _integer(board_row.get("Opportunity")) or 0,
                "closedOpportunities": _integer(activity_row.get("Technicians_ClosedOpportunities")) or 0,
                "rate": _number(board_row.get("OpportunityConversionRate")) or 0,
                "averageSale": _number(board_row.get("OpportunityJobAverage")) or 0,
                "membershipsSold": _integer(operations_row.get("MembershipsSold")) or 0,
                "membershipOpportunities": _integer(operations_row.get("MembershipOpportunities")) or 0,
                "membershipConversionRate": _number(operations_row.get("MembershipConversionRate")) or 0,
                "leadsSet": _integer(operations_row.get("LeadsSet")) or 0,
                "replacementOpportunities": _integer(conversion_row.get("ReplacementOpportunity")) or 0,
                "replacementLeadConversionRate": _number(conversion_row.get("ReplacementLeadConversionRate")) or 0,
                "totalLeadSales": _number(operations_row.get("TotalLeadSales")) or 0,
            }
        install_sales_source = _text(goal.get("install_sales_actual_source")) or None
        actual["installSales"] = (
            actual["revenue"]
            if install_sales_source == "total_sales"
            else actual["totalLeadSales"]
            if install_sales_source == "total_lead_sales"
            else None
        )

        department = DELIVERY_ROSTER[identity]
        audit_status, audit_alerts, audit_coverage = _audit_evidence(
            timing_evidence,
            hhr_evidence,
            args.from_date,
            args.cutoff_date,
        )
        baseline_opportunities = _integer(
            baseline_row.get("SalesOpportunity") or baseline_row.get("Opportunity")
        )
        baseline_rate = _number(
            baseline_row.get("CloseRate") or baseline_row.get("OpportunityConversionRate")
        )
        baseline_average = _number(
            baseline_row.get("OpportunityAverageSale") or baseline_row.get("OpportunityJobAverage")
        )

        technicians.append(
            {
                "slug": slug,
                "technician": _text(goal.get("technician")),
                "department": department,
                "businessUnit": business_unit,
                "technicianId": _text(board_row.get("TechnicianId")) or None,
                "email": _text(activity_row.get("Technicians_Email"))
                or _text(conversion_row.get("Email"))
                or DELIVERY_EMAIL_FALLBACKS.get(identity)
                or None,
                "actualSourceAvailable": current_source_available,
                "plan": {
                    "sourceMonth": _text(goal.get("month")),
                    "approvalStatus": _text(goal.get("approval_status")) or "DRAFT",
                    "monthlySalesGoal": _number(goal.get("monthly_sales_goal")),
                    "membershipMonthlyGoal": _integer(goal.get("membership_monthly_goal")),
                    "membershipConversionGoal": _number(goal.get("membership_conversion_goal")),
                    "reviewMonthlyGoal": _integer(goal.get("review_monthly_goal")),
                    "leadsSetGoal": _integer(goal.get("leads_set_goal")),
                    "installSalesGoal": _number(goal.get("install_sales_goal")),
                    "installSalesActualSource": install_sales_source,
                    "workingDaysMonthly": _integer(goal.get("working_days")),
                    "sourceNote": _text(goal.get("source_note")),
                },
                "actual": actual,
                "execution": {
                    "completedJobs": completed_jobs,
                    "optionsPerOpportunity": _number(productivity_row.get("OptionsPerOpportunity")),
                    "recallsCaused": _integer(board_row.get("RecallsCaused")) or 0,
                    "arrivalEligibleAppointments": timing_evidence.get("arrivalEligibleAppointments"),
                    "onTimeFirstHalfAppointments": timing_evidence.get("onTimeFirstHalfAppointments"),
                    "onTimeArrivalRate": timing_evidence.get("onTimeArrivalRate"),
                    "onsiteEligibleAppointments": timing_evidence.get("onsiteEligibleAppointments"),
                    "averageTimeOnSiteMinutes": timing_evidence.get("averageTimeOnSiteMinutes"),
                    "hhrEffectiveDate": hhr_evidence.get("effectiveDate"),
                    "hhrEligibleJobs": hhr_evidence.get("eligibleJobs"),
                    "hhrCompletedJobs": hhr_evidence.get("completedJobs"),
                    "hhrCompletionRate": hhr_evidence.get("completionRate"),
                    "reviewsReceived": (
                        review_evidence.get("totalEvidenceReviews")
                        if review_evidence.get("sourceAvailable")
                        else None
                    ),
                    "serviceTitanAssignedReviews": (
                        review_evidence.get("serviceTitanAssignedReviews")
                        if review_evidence.get("sourceAvailable")
                        else None
                    ),
                    "textMatchedReviews": (
                        review_evidence.get("textMatchedReviews")
                        if review_evidence.get("sourceAvailable")
                        else None
                    ),
                    "averageReviewRating": (
                        review_evidence.get("averageRating")
                        if review_evidence.get("sourceAvailable")
                        else None
                    ),
                },
                "personalizedTargets": {
                    "baselineFromDate": args.baseline_from_date,
                    "baselineToDate": args.baseline_to_date,
                    "baselineOpportunities": baseline_opportunities,
                    "baselineRate": baseline_rate,
                    "baselineAverageSale": baseline_average,
                    "targetOpportunitiesMonthly": _integer(
                        goal.get("target_opportunities_monthly")
                    ),
                    "dailyOpportunityGoal": _number(goal.get("daily_opportunity_goal")),
                    "targetRate": _number(goal.get("target_rate"))
                    if _number(goal.get("target_rate")) is not None
                    else _personalized_rate_target(baseline_rate),
                    "targetRateType": _text(goal.get("target_rate_type")) or "close",
                    "targetAverage": _number(goal.get("target_average"))
                    if _number(goal.get("target_average")) is not None
                    else (round(baseline_average * 1.10) if baseline_average is not None else None),
                    "rateBenchmark": 0.70,
                    "rateStep": 0.05,
                    "averageLift": 0.10,
                },
                "fieldPro": {
                    "completedJobs": completed_jobs,
                    "totalRecordings": total_recordings,
                    "qualityRecordings": quality_recordings,
                    "recordingCoverage": total_recordings / completed_jobs if completed_jobs else None,
                    "qualityRecordingRate": (
                        _number(activity_row.get("FieldProTechnicianRecordingPerformance_Quality_Recordings_Rate"))
                        if total_recordings
                        else None
                    ),
                    "averageRecordingMinutes": _number(recordings_row.get("Avg_Recording_Duration_Minutes")),
                    "longestRecordingMinutes": None,
                    "recordedJobs": [],
                },
                "audit": {
                    "status": audit_status,
                    "matchedAlerts": audit_alerts,
                    "coverageNote": audit_coverage,
                },
            }
        )

    output = {
        "schemaVersion": 4,
        "reportVersion": args.report_version,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "periodFrom": args.from_date,
        "cutoffDate": args.cutoff_date,
        "serviceTitanSnapshotTime": dashboard.get("snapshotTime"),
        "auditCycleAt": args.audit_cycle_at or coaching_evidence_generated_at,
        "auditSource": "MTD ServiceTitan appointments and form submissions evaluated with Dispatcher Auditor criteria",
        "technicians": sorted(technicians, key=lambda row: (row["department"], row["technician"])),
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")

    missing_email = [row["technician"] for row in technicians if not row["email"]]
    built_roster = {_identity(row["technician"]) for row in technicians}
    missing_roster = sorted(set(DELIVERY_ROSTER) - built_roster)
    if missing_roster:
        raise ValueError(
            "Delivery roster is missing from the generated snapshot: " + ", ".join(missing_roster)
        )
    if missing_email:
        raise ValueError("Technician email is missing: " + ", ".join(missing_email))
    print(f"technicians={len(technicians)}")
    print("missing_email=none")
    print(f"wrote={output_path}")
    return 0


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _audit_evidence(
    timing: dict[str, Any],
    hhr: dict[str, Any],
    from_date: str,
    cutoff_date: str,
) -> tuple[str, list[dict[str, str]], str]:
    eligible_arrivals = timing.get("arrivalEligibleAppointments")
    on_time_arrivals = timing.get("onTimeFirstHalfAppointments")
    if not isinstance(eligible_arrivals, int) or not isinstance(on_time_arrivals, int):
        return (
            "coverage_unavailable",
            [],
            "ServiceTitan appointment evidence was unavailable; no audit result is reported as zero.",
        )

    alerts: list[dict[str, str]] = []
    late_arrivals = max(0, eligible_arrivals - on_time_arrivals)
    if late_arrivals:
        alerts.append(
            {
                "jobId": "",
                "ruleId": "arrival_after_first_half",
                "severity": "medium",
                "title": f"{late_arrivals} of {eligible_arrivals} arrivals were after the first half of the window",
            }
        )

    eligible_hhr = hhr.get("eligibleJobs")
    completed_hhr = hhr.get("completedJobs")
    if isinstance(eligible_hhr, int) and isinstance(completed_hhr, int):
        missing_hhr = max(0, eligible_hhr - completed_hhr)
        if missing_hhr:
            alerts.append(
                {
                    "jobId": "",
                    "ruleId": "required_home_health_card_missing",
                    "severity": "medium",
                    "title": f"{missing_hhr} of {eligible_hhr} eligible jobs was missing a Home Health Card",
                }
            )

    coverage = (
        f"MTD audit checks covered {eligible_arrivals} assigned appointments from {from_date} through {cutoff_date}."
    )
    return ("has_alerts" if alerts else "no_matched_alerts", alerts, coverage)


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


def _validate_active_goal(goal: dict[str, str], technician: str, cutoff_date: str) -> None:
    status = _text(goal.get("approval_status"))
    if status not in {"ACTIVE", "UPDATED_GOAL_PENDING"}:
        raise ValueError(
            f"{technician} goal status must be ACTIVE or UPDATED_GOAL_PENDING, found {status or 'blank'}"
        )
    expected_month = cutoff_date[:7]
    if _text(goal.get("month")) != expected_month:
        raise ValueError(
            f"{technician} goal month must be {expected_month}, found {_text(goal.get('month')) or 'blank'}"
        )

    common_positive_fields = (
        "review_monthly_goal",
        "working_days",
    )
    missing_common = [field for field in common_positive_fields if _number(goal.get(field)) is None]
    if missing_common:
        raise ValueError(f"{technician} goal is missing: {', '.join(missing_common)}")
    if status == "UPDATED_GOAL_PENDING":
        return

    positive_fields = (
        "monthly_sales_goal",
        "target_opportunities_monthly",
        "daily_opportunity_goal",
        "target_rate",
        "target_average",
        "membership_conversion_goal",
        "install_sales_goal",
    )
    missing = [field for field in positive_fields if _number(goal.get(field)) is None]
    if missing:
        raise ValueError(f"{technician} active goal is missing: {', '.join(missing)}")
    invalid = [field for field in positive_fields if (_number(goal.get(field)) or 0) <= 0]
    if invalid:
        raise ValueError(f"{technician} active goal must be positive: {', '.join(invalid)}")
    rate = _number(goal.get("target_rate"))
    if rate is None or rate > 1:
        raise ValueError(f"{technician} target_rate must be a decimal between 0 and 1")
    if _text(goal.get("target_rate_type")) != "close":
        raise ValueError(f"{technician} target_rate_type must be close")


def _personalized_rate_target(baseline: float | None) -> float | None:
    if baseline is None:
        return None
    if baseline >= 0.70:
        return baseline
    return min(0.70, baseline + 0.05)


if __name__ == "__main__":
    raise SystemExit(main())
