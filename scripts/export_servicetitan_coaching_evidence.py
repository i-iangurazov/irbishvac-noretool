from __future__ import annotations

import argparse
import csv
import json
import re
import signal
import socket
import sys
import time as time_module
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Iterable
from zoneinfo import ZoneInfo


MARKETING_REPO = Path(__file__).resolve().parents[2] / "irbishvac-marketing"
sys.path.insert(0, str(MARKETING_REPO))

from marketing_os_agent.clients.servicetitan import ServiceTitanClient
from marketing_os_agent.clients.http import HttpClient
from marketing_os_agent.config import Settings


BUSINESS_TIMEZONE = ZoneInfo("America/Los_Angeles")
HHR_FORM_KEYWORDS = ("home health report", "home health card", "hhr", "report card")
HHR_JOB_TYPES = {
    "hvac diagnostic",
    "plumbing diagnostic",
    "water heater diagnostic",
    "water heater repair",
}


class ReportHttpClient(HttpClient):
    def request_json(self, *args: Any, **kwargs: Any):
        previous_handler = signal.getsignal(signal.SIGALRM)

        def deadline_handler(_signum: int, _frame: Any) -> None:
            raise TimeoutError("ServiceTitan response exceeded the wall-clock deadline")

        for attempt in range(3):
            try:
                signal.signal(signal.SIGALRM, deadline_handler)
                signal.setitimer(signal.ITIMER_REAL, 35)
                return super().request_json(*args, **kwargs)
            except (TimeoutError, socket.timeout):
                if attempt == 2:
                    raise
                time_module.sleep(1.5 * (2**attempt))
            finally:
                signal.setitimer(signal.ITIMER_REAL, 0)
                signal.signal(signal.SIGALRM, previous_handler)
        raise RuntimeError("ServiceTitan report request retry loop exhausted")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export ServiceTitan evidence for technician coaching reports."
    )
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--reviews-dir", required=True)
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--to-date", required=True)
    parser.add_argument("--hhr-effective-date", default="2026-07-23")
    parser.add_argument("--form-submissions-cache")
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    start_date = date.fromisoformat(args.from_date)
    end_date = date.fromisoformat(args.to_date)
    hhr_effective_date = date.fromisoformat(args.hhr_effective_date)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    snapshot = json.loads(Path(args.snapshot).read_text(encoding="utf-8"))
    roster = [row for row in snapshot.get("technicians", []) if row.get("technicianId")]
    if not roster:
        raise ValueError("The delivery snapshot does not contain technician IDs")

    client = ServiceTitanClient(
        Settings.from_env(),
        http=ReportHttpClient(timeout_seconds=30, retries=0),
    )
    tenant = client.settings.servicetitan_tenant_id
    window_start = datetime.combine(start_date, time.min, BUSINESS_TIMEZONE).astimezone(timezone.utc)
    window_end = datetime.combine(end_date + timedelta(days=1), time.min, BUSINESS_TIMEZONE).astimezone(timezone.utc)

    technicians: dict[str, dict[str, Any]] = {}
    appointment_records: list[dict[str, Any]] = []
    for roster_row in roster:
        technician_id = str(roster_row["technicianId"])
        appointments = client._get_paginated(
            f"/jpm/v2/tenant/{tenant}/appointments",
            {
                "technicianId": technician_id,
                "startsOnOrAfter": _iso(window_start),
                "startsBefore": _iso(window_end),
                "active": "Any",
                "pageSize": "200",
                "includeTotal": "true",
            },
        )
        appointments = [
            row
            for row in appointments
            if row.get("active", True)
            and str(row.get("status") or "").lower() not in {"canceled", "cancelled"}
            and not row.get("unused", False)
        ]
        for appointment in appointments:
            appointment["_rosterTechnicianId"] = technician_id
            appointment["_rosterTechnician"] = roster_row["technician"]
        appointment_records.extend(appointments)
        technicians[technician_id] = {
            "slug": roster_row["slug"],
            "technician": roster_row["technician"],
            "technicianId": technician_id,
            "department": roster_row["department"],
            "appointments": appointments,
        }
        print(f"appointments {roster_row['technician']}: {len(appointments)}", flush=True)

    appointment_by_id = {
        str(row["id"]): row for row in appointment_records if row.get("id") is not None
    }
    job_ids = sorted({str(row["jobId"]) for row in appointment_records if row.get("jobId")})
    timesheets = _fetch_paginated_batches(
        client,
        f"/payroll/v2/tenant/{tenant}/jobs/timesheets",
        "jobIds",
        job_ids,
    )
    timesheets = [row for row in timesheets if row.get("active", True)]
    timesheets_by_appointment: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in timesheets:
        if row.get("appointmentId") is not None:
            timesheets_by_appointment[str(row["appointmentId"])].append(row)

    jobs = _fetch_paginated_batches(
        client,
        f"/jpm/v2/tenant/{tenant}/jobs",
        "ids",
        job_ids,
    )
    jobs_by_id = {str(row["id"]): row for row in jobs if row.get("id") is not None}
    job_types = client._get_paginated(
        f"/jpm/v2/tenant/{tenant}/job-types",
        {"active": "Any", "pageSize": "200", "includeTotal": "true"},
    )
    job_type_names = {
        str(row["id"]): str(row.get("name") or "")
        for row in job_types
        if row.get("id") is not None
    }

    job_evidence = []
    for appointment in appointment_records:
        job_id = str(appointment.get("jobId") or "")
        job = jobs_by_id.get(job_id, {})
        job_type_name = job_type_names.get(str(job.get("jobTypeId") or ""), "")
        job_evidence.append(
            {
                "technician": appointment.get("_rosterTechnician"),
                "technicianId": str(appointment.get("_rosterTechnicianId") or ""),
                "appointmentId": str(appointment.get("id") or ""),
                "appointmentStart": appointment.get("start"),
                "appointmentStatus": appointment.get("status"),
                "jobId": job_id,
                "jobStatus": job.get("status") or job.get("jobStatus"),
                "jobTypeId": str(job.get("jobTypeId") or ""),
                "jobType": job_type_name,
                "businessUnitId": str(job.get("businessUnitId") or ""),
            }
        )

    hhr_eligible_by_technician: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for row in job_evidence:
        technician_id = row["technicianId"]
        job_id = row["jobId"]
        appointment_day = _local_date(_datetime_value(row["appointmentStart"]))
        if (
            technician_id
            and job_id
            and appointment_day is not None
            and appointment_day >= hhr_effective_date
            and str(row["jobStatus"] or "").lower() == "completed"
            and _is_hhr_eligible_job_type(row["jobType"])
        ):
            hhr_eligible_by_technician[technician_id][job_id] = {
                "jobId": job_id,
                "jobType": row["jobType"],
                "appointmentDate": appointment_day.isoformat(),
            }
    print(
        "hhr eligible jobs: "
        + ", ".join(
            f"{technicians[technician_id]['technician']}={len(rows)}"
            for technician_id, rows in hhr_eligible_by_technician.items()
        ),
        flush=True,
    )

    candidate_hhr_job_ids = {
        job_id
        for rows in hhr_eligible_by_technician.values()
        for job_id in rows
    }
    form_window_start = datetime.combine(
        max(start_date, hhr_effective_date), time.min, BUSINESS_TIMEZONE
    ).astimezone(timezone.utc)
    hhr_forms = client._get_paginated(
        f"/forms/v2/tenant/{tenant}/forms",
        {
            "active": "Any",
            "status": "Published",
            "pageSize": "200",
            "includeTotal": "false",
        },
    )
    hhr_form_ids = sorted(
        {
            str(row["id"])
            for row in hhr_forms
            if row.get("id") is not None
            and _contains_any(str(row.get("name") or ""), HHR_FORM_KEYWORDS)
        }
    )
    if not hhr_form_ids:
        raise ValueError("No published Home Health Report/Card forms were found")
    print(f"hhr forms: {','.join(hhr_form_ids)}", flush=True)
    recent_form_submissions = (
        _load_cached_form_submissions(
            Path(args.form_submissions_cache), form_window_start, window_end
        )
        if args.form_submissions_cache
        else _fetch_recent_form_submissions(
            client,
            f"/forms/v2/tenant/{tenant}/submissions",
            form_window_start,
            window_end,
            hhr_form_ids,
            sorted(candidate_hhr_job_ids),
        )
    )
    hhr_submissions_by_job: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for submission in recent_form_submissions:
        for owner_job_id in _submission_job_ids(submission):
            if owner_job_id in candidate_hhr_job_ids:
                hhr_submissions_by_job[owner_job_id].append(submission)

    reviews = _review_evidence(Path(args.reviews_dir), roster)
    detailed_appointments: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []

    for technician_id, technician in technicians.items():
        timing_rows: list[dict[str, Any]] = []
        hhr_eligible = hhr_eligible_by_technician[technician_id]
        for appointment in technician["appointments"]:
            appointment_id = str(appointment.get("id") or "")
            job_id = str(appointment.get("jobId") or "")
            own_timesheets = [
                row
                for row in timesheets_by_appointment.get(appointment_id, [])
                if str(row.get("technicianId") or "") == technician_id
            ]
            timesheet = _best_timesheet(own_timesheets)
            arrived_on = _datetime_value(timesheet.get("arrivedOn") if timesheet else None)
            done_on = _datetime_value(timesheet.get("doneOn") if timesheet else None)
            window_from = _datetime_value(appointment.get("arrivalWindowStart"))
            window_to = _datetime_value(appointment.get("arrivalWindowEnd"))
            first_half_end = (
                window_from + (window_to - window_from) / 2
                if window_from and window_to and window_to >= window_from
                else None
            )
            on_time = arrived_on <= first_half_end if arrived_on and first_half_end else None
            onsite_minutes = (
                (done_on - arrived_on).total_seconds() / 60
                if arrived_on and done_on and done_on > arrived_on
                else None
            )
            if onsite_minutes is not None and onsite_minutes > 24 * 60:
                onsite_minutes = None

            detail = {
                "technicianId": technician_id,
                "technician": technician["technician"],
                "appointmentId": appointment_id,
                "jobId": job_id,
                "appointmentStatus": appointment.get("status"),
                "arrivalWindowStart": _iso_or_none(window_from),
                "arrivalWindowEnd": _iso_or_none(window_to),
                "firstHalfEnd": _iso_or_none(first_half_end),
                "arrivedOn": _iso_or_none(arrived_on),
                "doneOn": _iso_or_none(done_on),
                "onTimeFirstHalf": on_time,
                "onsiteMinutes": round(onsite_minutes, 1) if onsite_minutes is not None else None,
            }
            detailed_appointments.append(detail)
            timing_rows.append(detail)

        for job_id, eligible in hhr_eligible.items():
            submissions = hhr_submissions_by_job.get(job_id, [])
            matching = [row for row in submissions if _is_completed_hhr_submission(row)]
            eligible["completed"] = bool(matching)
            eligible["submissionIds"] = [str(row.get("id")) for row in matching if row.get("id")]
            eligible["formNames"] = sorted({str(row.get("formName") or "") for row in matching})

        on_time_rows = [row for row in timing_rows if row["onTimeFirstHalf"] is not None]
        onsite_rows = [row["onsiteMinutes"] for row in timing_rows if row["onsiteMinutes"] is not None]
        hhr_jobs = list(hhr_eligible.values())
        hhr_completed = sum(1 for row in hhr_jobs if row.get("completed"))
        review = reviews.get(_identity(technician["technician"]), _empty_reviews())
        result = {
            "slug": technician["slug"],
            "technician": technician["technician"],
            "technicianId": technician_id,
            "department": technician["department"],
            "timing": {
                "assignedAppointments": len(timing_rows),
                "arrivalEligibleAppointments": len(on_time_rows),
                "onTimeFirstHalfAppointments": sum(1 for row in on_time_rows if row["onTimeFirstHalf"]),
                "onTimeArrivalRate": (
                    sum(1 for row in on_time_rows if row["onTimeFirstHalf"]) / len(on_time_rows)
                    if on_time_rows
                    else None
                ),
                "onsiteEligibleAppointments": len(onsite_rows),
                "averageTimeOnSiteMinutes": round(mean(onsite_rows), 1) if onsite_rows else None,
            },
            "homeHealthReport": {
                "effectiveDate": hhr_effective_date.isoformat(),
                "eligibleJobs": len(hhr_jobs),
                "completedJobs": hhr_completed,
                "completionRate": hhr_completed / len(hhr_jobs) if hhr_jobs else None,
                "jobs": sorted(hhr_jobs, key=lambda row: (row["appointmentDate"], row["jobId"])),
            },
            "reviews": review,
        }
        results.append(result)
        print(
            f"evidence {technician['technician']}: "
            f"arrival={len(on_time_rows)} onsite={len(onsite_rows)} hhr={hhr_completed}/{len(hhr_jobs)} "
            f"reviews={review['totalEvidenceReviews']}",
            flush=True,
        )

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "periodFrom": start_date.isoformat(),
        "cutoffDate": end_date.isoformat(),
        "hhrEffectiveDate": hhr_effective_date.isoformat(),
        "methodology": {
            "onTimeArrival": "arrivedOn at or before the midpoint of the ServiceTitan arrival window",
            "averageTimeOnSite": "mean(doneOn - arrivedOn) for valid positive technician timesheets, excluding values over 24 hours",
            "homeHealthReport": "completed Home Health Report/Card form submissions on completed diagnostic or water-heater-repair jobs since the form effective date",
            "reviews": "ServiceTitan technician assignment plus exact technician-name mentions in unassigned review text; duplicate reviews counted once",
        },
        "technicians": sorted(results, key=lambda row: (row["department"], row["technician"])),
    }
    (output_dir / "coaching_evidence.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output_dir / "appointments_evidence.json").write_text(
        json.dumps(detailed_appointments, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output_dir / "jobs_evidence.json").write_text(
        json.dumps(job_evidence, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    _write_summary_csv(output_dir / "coaching_evidence.csv", payload["technicians"])
    print(f"wrote={output_dir / 'coaching_evidence.json'}", flush=True)
    return 0


def _fetch_paginated_batches(
    client: ServiceTitanClient,
    path: str,
    parameter: str,
    values: list[str],
    batch_size: int = 50,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for batch in _chunks(values, batch_size):
        records.extend(
            client._get_paginated(
                path,
                {
                    parameter: ",".join(batch),
                    "active": "Any",
                    "pageSize": "200",
                    "includeTotal": "true",
                },
            )
        )
    return records


def _fetch_recent_form_submissions(
    client: ServiceTitanClient,
    path: str,
    from_datetime: datetime,
    before_datetime: datetime,
    form_ids: list[str],
    job_ids: list[str],
) -> list[dict[str, Any]]:
    if not job_ids:
        return []
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    pages_scanned = 0
    for job_batch in _chunks(job_ids, 5):
        page = 1
        while page <= 20:
            params = {
                "status": "Completed",
                "formIds": ",".join(form_ids),
                "ownerType": "Job",
                "submittedOnOrAfter": _iso(from_datetime),
                "submittedBefore": _iso(before_datetime),
                "sort": "-SubmittedOn",
                "page": str(page),
                "pageSize": "5",
                "includeTotal": "false",
            }
            for index, job_id in enumerate(job_batch):
                params[f"owners[{index}].type"] = "Job"
                params[f"owners[{index}].id"] = job_id
            payload = client._get(path, params)
            pages_scanned += 1
            page_records = [
                row for row in payload.get("data", []) if isinstance(row, dict)
            ]
            if not page_records:
                break
            for row in page_records:
                submitted_on = _datetime_value(row.get("submittedOn"))
                record_id = str(row.get("id") or "")
                if (
                    submitted_on is not None
                    and from_datetime <= submitted_on < before_datetime
                    and record_id not in seen
                ):
                    seen.add(record_id)
                    records.append(row)
            if not payload.get("hasMore"):
                break
            page += 1
        print(
            f"hhr form submissions jobs {job_batch[0]}..{job_batch[-1]}: "
            f"{len(records)} unique total",
            flush=True,
        )
    print(
        f"recent HHR form submissions scanned: {len(records)} across "
        f"{pages_scanned} targeted page(s)",
        flush=True,
    )
    return records


def _load_cached_form_submissions(
    path: Path,
    from_datetime: datetime,
    before_datetime: datetime,
) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for page in payload.values():
        if not isinstance(page, dict):
            continue
        for row in page.get("data", []):
            if not isinstance(row, dict):
                continue
            submitted_on = _datetime_value(row.get("submittedOn"))
            record_id = str(row.get("id") or "")
            if (
                submitted_on is None
                or not (from_datetime <= submitted_on < before_datetime)
                or record_id in seen
            ):
                continue
            seen.add(record_id)
            records.append(row)
    print(f"recent form submissions loaded from cache: {len(records)}", flush=True)
    return records


def _submission_job_ids(submission: dict[str, Any]) -> set[str]:
    owners = submission.get("owners")
    if not isinstance(owners, list):
        return set()
    return {
        str(owner.get("id"))
        for owner in owners
        if isinstance(owner, dict)
        and str(owner.get("type") or "").lower() == "job"
        and owner.get("id") is not None
    }


def _is_hhr_eligible_job_type(job_type: str) -> bool:
    return " ".join(job_type.lower().replace("-", " ").split()) in HHR_JOB_TYPES


def _best_timesheet(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    return max(
        rows,
        key=lambda row: (
            bool(row.get("arrivedOn")),
            bool(row.get("doneOn")),
            str(row.get("modifiedOn") or ""),
        ),
    )


def _review_evidence(reviews_dir: Path, roster: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    summary_rows = _csv_rows(reviews_dir / "reviews.csv")
    detail_rows = _csv_rows(reviews_dir / "review.csv")
    source_available = bool(summary_rows or detail_rows)
    summary_by_name = {_identity(row.get("TechnicianName")): row for row in summary_rows}
    roster_first_names: dict[str, int] = defaultdict(int)
    for row in roster:
        first_name = str(row.get("technician") or "").split()[0].lower()
        roster_first_names[first_name] += 1

    evidence: dict[str, dict[str, Any]] = {}
    for technician in roster:
        name = str(technician["technician"])
        identity = _identity(name)
        summary = summary_by_name.get(identity, {})
        matched: list[dict[str, Any]] = []
        seen: set[str] = set()
        for row in detail_rows:
            review_text = str(row.get("Review") or "")
            assigned_identity = _identity(row.get("TechnicianFullName"))
            match_type: str | None = None
            if assigned_identity == identity:
                match_type = "ServiceTitan assigned"
            elif not assigned_identity and _name_in_review(name, review_text, roster_first_names):
                match_type = "name matched in review text"
            if match_type is None:
                continue
            key = "|".join((str(row.get("PublishDate") or ""), str(row.get("AuthorName") or ""), review_text))
            if key in seen:
                continue
            seen.add(key)
            matched.append(
                {
                    "publishDate": row.get("PublishDate"),
                    "author": row.get("AuthorName"),
                    "rating": _float(row.get("Rating")),
                    "matchType": match_type,
                }
            )
        assigned_count = sum(1 for row in matched if row["matchType"] == "ServiceTitan assigned")
        inferred_count = len(matched) - assigned_count
        evidence[identity] = {
            "sourceAvailable": source_available,
            "serviceTitanAssignedReviews": int(_float(summary.get("TotalReviews")) or assigned_count),
            "textMatchedReviews": inferred_count,
            "totalEvidenceReviews": len(matched),
            "eligibleJobs": _integer(summary.get("TotalJobs")),
            "serviceTitanReviewRate": _float(summary.get("ReviewRate")),
            "averageRating": _float(summary.get("AverageRating"))
            if summary
            else (round(mean([row["rating"] for row in matched if row["rating"] is not None]), 2) if matched else None),
            "reviews": matched,
        }
    return evidence


def _name_in_review(name: str, review_text: str, first_name_counts: dict[str, int]) -> bool:
    parts = [part for part in re.findall(r"[a-z]+", name.lower()) if len(part) >= 3]
    normalized = " ".join(re.findall(r"[a-z]+", review_text.lower()))
    if len(parts) >= 2 and " ".join(parts) in normalized:
        return True
    first_name = parts[0] if parts else ""
    return bool(
        len(first_name) >= 4
        and first_name_counts.get(first_name) == 1
        and re.search(rf"\b{re.escape(first_name)}\b", normalized)
    )


def _is_completed_hhr_submission(row: dict[str, Any]) -> bool:
    form_name = str(row.get("formName") or "")
    status = str(row.get("status") or "").lower()
    return _contains_any(form_name, HHR_FORM_KEYWORDS) and status not in {"", "draft", "incomplete"}


def _write_summary_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fields = [
        "Technician",
        "Department",
        "AssignedAppointments",
        "ArrivalEligibleAppointments",
        "OnTimeFirstHalfAppointments",
        "OnTimeArrivalRate",
        "OnsiteEligibleAppointments",
        "AverageTimeOnSiteMinutes",
        "HHREligibleJobs",
        "HHRCompletedJobs",
        "HHRCompletionRate",
        "Reviews",
        "ServiceTitanAssignedReviews",
        "TextMatchedReviews",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            timing = row["timing"]
            hhr = row["homeHealthReport"]
            reviews = row["reviews"]
            writer.writerow(
                {
                    "Technician": row["technician"],
                    "Department": row["department"],
                    "AssignedAppointments": timing["assignedAppointments"],
                    "ArrivalEligibleAppointments": timing["arrivalEligibleAppointments"],
                    "OnTimeFirstHalfAppointments": timing["onTimeFirstHalfAppointments"],
                    "OnTimeArrivalRate": timing["onTimeArrivalRate"],
                    "OnsiteEligibleAppointments": timing["onsiteEligibleAppointments"],
                    "AverageTimeOnSiteMinutes": timing["averageTimeOnSiteMinutes"],
                    "HHREligibleJobs": hhr["eligibleJobs"],
                    "HHRCompletedJobs": hhr["completedJobs"],
                    "HHRCompletionRate": hhr["completionRate"],
                    "Reviews": reviews["totalEvidenceReviews"],
                    "ServiceTitanAssignedReviews": reviews["serviceTitanAssignedReviews"],
                    "TextMatchedReviews": reviews["textMatchedReviews"],
                }
            )


def _empty_reviews() -> dict[str, Any]:
    return {
        "serviceTitanAssignedReviews": 0,
        "textMatchedReviews": 0,
        "totalEvidenceReviews": 0,
        "eligibleJobs": None,
        "serviceTitanReviewRate": None,
        "averageRating": None,
        "reviews": [],
    }


def _chunks(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def _csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _identity(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _contains_any(value: str, keywords: Iterable[str]) -> bool:
    normalized = value.lower()
    return any(keyword.lower() in normalized for keyword in keywords)


def _datetime_value(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    match = re.match(r"^(.*\.)(\d+)([+-]\d\d:\d\d)$", text)
    if match:
        fraction = (match.group(2) + "000000")[:6]
        text = f"{match.group(1)}{fraction}{match.group(3)}"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _local_date(value: datetime | None) -> date | None:
    return value.astimezone(BUSINESS_TIMEZONE).date() if value else None


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def _iso_or_none(value: datetime | None) -> str | None:
    return _iso(value) if value else None


def _float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _integer(value: Any) -> int | None:
    parsed = _float(value)
    return int(parsed) if parsed is not None else None


if __name__ == "__main__":
    raise SystemExit(main())
