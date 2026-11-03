"""Shared live personnel, identity and monthly-goal policy for both report cycles."""
from __future__ import annotations

import argparse
import csv
import fcntl
import json
import re
import sys
import subprocess
import tempfile
from urllib.request import Request, urlopen
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Any

SCHEDULE_TIMEZONE = "Asia/Bishkek"
SERVICE_UNITS = {"HVAC - Service": "HVAC Service", "HVAC - Maintenance": "HVAC Maintenance", "Plumbing - Service": "Plumbing Service"}
ADVISOR_UNITS = {"HVAC - Sales": "HVAC Sales"}
# Source spelling compatibility, keyed by immutable ServiceTitan ID; never membership.
REPORT_ALIASES = {"128947018": ["Christian Vasquez"]}


def window_closed_at(cutoff: str) -> datetime:
    day = datetime.strptime(cutoff, "%Y-%m-%d") + timedelta(days=1)
    return day.replace(tzinfo=ZoneInfo("America/Los_Angeles")).astimezone(timezone.utc)


def assert_send_ready(snapshot: dict, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(ZoneInfo(SCHEDULE_TIMEZONE))
    if (local.hour, local.minute) >= (19, 45):
        raise ValueError("Delivery deadline passed: 19:45 Asia/Bishkek; no automatic late send")
    if (local.hour, local.minute) < (19, 35):
        raise ValueError("Delivery window starts at 19:35 Asia/Bishkek")
    weekday = {"technician": 3, "advisor": 4}.get(snapshot.get("sourceKind"))
    if weekday is None or local.weekday() != weekday:
        raise ValueError("Delivery cycle does not match its authorized weekday")
    if not snapshot.get("sourceExportStartedAt"):
        raise ValueError("Source export timestamp is missing; regenerate a verifiable package")
    generated = datetime.fromisoformat(snapshot["sourceExportStartedAt"])
    if generated < window_closed_at(snapshot["cutoffDate"]):
        raise ValueError("Report was prepared before the Pacific cutoff day closed; regenerate fresh data")
    if snapshot.get("cutoffDate") != (local.date() - timedelta(days=1)).isoformat():
        raise ValueError("Prepared report is not for yesterday's cutoff in Asia/Bishkek")
    return (local.replace(hour=19, minute=45, second=0, microsecond=0) - local).total_seconds()


def verify_live_personnel(snapshot: dict, env_files: list[str]) -> None:
    from run_service_tech_thursday_delivery import _load_environment
    env = _load_environment([Path(value) for value in env_files])
    directory = central_personnel(env, snapshot["cutoffDate"][:7], refresh=True)
    staff = [p for p in directory["staff"] if p["cycle"] == snapshot["sourceKind"] and p.get("active") is True]
    current = {p["technicianId"]: (p["email"], p["department"]) for p in staff}
    prepared = {str(p["technicianId"]): (p.get("email"), p["department"]) for p in snapshot["technicians"]}
    if current != prepared:
        raise ValueError("ServiceTitan staff, department or email changed since preparation; regenerate before sending")
    if snapshot.get("canonicalSource"):
        current_goals = {person["technicianId"]: person["goal"] for person in staff}
        for person in snapshot["technicians"]:
            goal = current_goals[str(person["technicianId"])]
            plan, targets = person["plan"], person["personalizedTargets"]
            expected = (plan["sourceMonth"], plan["approvalStatus"], plan["monthlySalesGoal"],
                        plan["membershipMonthlyGoal"], plan["reviewMonthlyGoal"], plan["workingDaysMonthly"],
                        targets["targetOpportunitiesMonthly"], targets["targetRate"], targets["targetAverage"])
            actual = tuple(goal[key] for key in ("month", "approval_status", "monthly_sales_goal",
                           "membership_monthly_goal", "review_monthly_goal", "working_days",
                           "target_opportunities_monthly", "target_rate", "target_average"))
            if expected != actual:
                raise ValueError("Approved goals changed since preparation; regenerate before sending")


def export_started(source: Path) -> str | None:
    path = source / "export-manifest.json"
    return json.loads(path.read_text())["startedAt"] if path.exists() else None


def source_window_complete(source: Path, cutoff: str) -> bool:
    started = export_started(source)
    return bool(started and datetime.fromisoformat(started) >= window_closed_at(cutoff))


def preparation_complete(path: Path) -> bool:
    if not path.exists():
        return False
    data = json.loads(path.read_text())
    return data.get("status") == "ready" and data.get("dataWindowComplete") is True


def automatic_send_due(now: datetime, env: dict, cycle: str) -> bool:
    local = now.astimezone(ZoneInfo(SCHEDULE_TIMEZONE))
    enabled = str(env.get("PERFORMANCE_REPORT_AUTO_SEND", "false")).lower() in {"1", "true", "yes", "on"}
    weekday = {"technician": 3, "advisor": 4}[cycle]
    return enabled and local.weekday() == weekday and (19, 40) <= (local.hour, local.minute) < (19, 45)


def run_automatic_delivery(repo: Path, output_root: Path, now: datetime, env: dict, cycle: str, run) -> bool:
    """19:40 local fallback; only send an already prepared and QA-passed package."""
    if not automatic_send_due(now, env, cycle):
        return False
    output_root.mkdir(parents=True, exist_ok=True)
    with (output_root / ".delivery.lock").open("a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("automatic_delivery_noop=preparation or delivery still running")
            return True
        package = output_root / now.astimezone(ZoneInfo(SCHEDULE_TIMEZONE)).date().isoformat()
        state_path = package / "delivery/delivery-state.json"
        plan_path = package / "delivery/delivery-plan.json"
        if state_path.exists() and plan_path.exists():
            state = json.loads(state_path.read_text())
            plan = json.loads(plan_path.read_text())
            sent = state.get("reports", {})
            expected = {row["slug"] for row in plan.get("reports", [])}
            if expected and set(sent) == expected and state.get("deliveryKey") == plan.get("deliveryKey") and all(row.get("status") == "sent" for row in sent.values()):
                print("automatic_delivery_noop=already sent")
                return True
        if not preparation_complete(package / "preparation-state.json"):
            raise ValueError("Automatic delivery blocked: today's package is not ready; no preview or unvalidated send")
        run([sys.executable, str(repo / "scripts/deliver_prepared_performance_reports.py"), "--cycle", cycle, "--mode", "send", "--output-root", str(output_root)], repo)
    return True


def record_preparation(package: Path, snapshot: Path) -> None:
    data = json.loads(snapshot.read_text())
    started = data.get("sourceExportStartedAt")
    complete = bool(started and datetime.fromisoformat(started) >= window_closed_at(data["cutoffDate"]))
    result = {
        "status": "ready" if complete else "preview",
        "dataWindowComplete": complete,
        "periodFrom": data["periodFrom"], "cutoffDate": data["cutoffDate"],
        "preparedAt": datetime.now(timezone.utc).isoformat(),
        "staffCount": len(data["technicians"]),
        "goalsPending": [p["technician"] for p in data["technicians"] if p["plan"]["approvalStatus"] == "UPDATED_GOAL_PENDING"],
        "deliveryIssues": [p["technician"] for p in data["technicians"] if not p.get("email")],
    }
    path = package / "preparation-state.json"
    path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("preparation_status=" + result["status"], flush=True)


def identity(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def select_staff(technicians: list[dict], units: list[dict]) -> dict:
    unit_map = {str(row["id"]): row for row in units}
    selected, excluded = [], []
    seen: set[str] = set()
    for row in technicians:
        identifier = str(row.get("id") or "")
        if not identifier or identifier in seen:
            raise ValueError("ServiceTitan personnel contains a missing or duplicate ID")
        seen.add(identifier)
        unit = unit_map.get(str(row.get("businessUnitId")), {})
        unit_name = str(unit.get("name") or "")
        reason = None
        if row.get("active") is not True:
            reason = "inactive_or_unconfirmed_status"
        elif row.get("isManagedTech") is not True:
            reason = "not_managed_field_staff"
        elif unit.get("active") is not True:
            reason = "inactive_or_unknown_business_unit"
        elif unit_name not in SERVICE_UNITS and unit_name not in ADVISOR_UNITS:
            reason = "outside_service_and_hvac_sales_scope"
        if reason:
            excluded.append({"technicianId": identifier, "name": row.get("name"), "reason": reason})
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            raise ValueError(f"Active technician {identifier} has no name")
        cycle = "advisor" if unit_name in ADVISOR_UNITS else "technician"
        selected.append({"technicianId": identifier, "technician": name, "slug": f"staff-{identifier}", "email": str(row.get("email") or "").strip() or None, "active": True, "isManagedTech": True, "businessUnitId": str(unit["id"]), "businessUnit": unit_name, "department": {**SERVICE_UNITS, **ADVISOR_UNITS}[unit_name], "cycle": cycle, "reportAliases": REPORT_ALIASES.get(identifier, []), "startedOn": row.get("startDate") or row.get("createdOn")})
    if not selected:
        raise ValueError("No eligible active field staff; refusing an empty directory")
    names = [identity(person["technician"]) for person in selected]
    if len(set(names)) != len(names):
        raise ValueError("Duplicate active personnel names; name-only upstream reports require identity reconciliation")
    return {"schemaVersion": 1, "source": "ServiceTitan settings technicians + business-units", "fetchedAt": datetime.now(timezone.utc).isoformat(), "selectionPolicy": "active AND isManagedTech AND active supported business unit", "staff": sorted(selected, key=lambda r: (r["cycle"], r["technician"])), "excluded": excluded}


def load_staff(path: Path, cycle: str, *, max_age_hours: float = 24) -> tuple[dict, list[dict]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    fetched = datetime.fromisoformat(payload["fetchedAt"])
    if fetched.tzinfo is None or not (-300 <= (datetime.now(timezone.utc) - fetched).total_seconds() <= max_age_hours * 3600):
        raise ValueError("Personnel directory is stale or has no valid timestamp; refresh ServiceTitan")
    staff = [row for row in payload["staff"] if row["cycle"] == cycle and row.get("active") is True]
    if not staff:
        raise ValueError(f"No active {cycle} staff in current ServiceTitan directory")
    return payload, staff


def match_row(rows: list[dict], staff: dict, name_key: str = "Name") -> dict:
    identifier = staff["technicianId"]
    id_keys = ("TechnicianId", "Technicians_Id", "Technicians_TechnicianId", "technicianId")
    by_id = [r for r in rows if any(str(r.get(k) or "") == identifier for k in id_keys)]
    if len(by_id) > 1:
        raise ValueError(f"Duplicate report rows for ServiceTitan ID {identifier}")
    if by_id:
        return by_id[0]
    names = {identity(staff["technician"]), *(identity(n) for n in staff.get("reportAliases", []))}
    # Name-only reports exist upstream. Never override a conflicting explicit ID.
    named = [r for r in rows if identity(r.get(name_key)) in names and not any(r.get(k) for k in id_keys)]
    if len(named) > 1:
        raise ValueError(f"Ambiguous name-only report rows for {staff['technician']}")
    return named[0] if named else {}


def lookup_by_identity(rows: list[dict], staff: list[dict], name_key: str = "Name") -> dict:
    return {identity(person["technician"]): match_row(rows, person, name_key) for person in staff}


def monthly_goals(repo: Path, month: str, env: dict, cycle: str) -> Path | None:
    key = "ADVISOR_REPORT_GOALS_FILE" if cycle == "advisor" else "TECH_REPORT_GOALS_FILE"
    explicit = env.get(key)
    candidates = [Path(explicit)] if explicit else []
    label = datetime.strptime(month, "%Y-%m").strftime("%B").lower()
    candidates.append(repo / "docs" / f"{label}-{month[:4]}-performance-goals.csv")
    for path in candidates:
        if path.is_file():
            with path.open(newline="", encoding="utf-8-sig") as handle:
                rows = list(csv.DictReader(handle))
            if rows and all(r.get("month") == month for r in rows):
                return path
    return None


def goal_for(staff: dict, rows: list[dict], month: str) -> dict:
    matched = match_row(rows, staff, "technician")
    transferred = bool(matched and matched.get("report_department") != staff["department"])
    if matched and matched.get("month") == month and not transferred:
        goal = dict(matched)
    else:
        goal = {"month": month, "approval_status": "UPDATED_GOAL_PENDING", "source_note": "Monthly goals not provided; actuals remain visible. No prior-month target inferred."}
        if transferred:
            goal["source_note"] = f"Current department is {staff['department']}; goals for {matched.get('report_department') or 'an unspecified department'} are not carried across a transfer. Confirm current-role goals."
    goal.update({"technicianId": staff["technicianId"], "technician": staff["technician"], "report_department": staff["department"], "role": "HVAC Comfort Advisor" if staff["cycle"] == "advisor" else "Service Technician"})
    if staff["cycle"] == "advisor" and month >= "2026-11":
        goal.update({"target_opportunities_monthly": "75", "daily_opportunity_goal": "3", "working_days": "25"})
    return goal


def write_goals(path: Path, source: Path | None, staff: list[dict], month: str) -> None:
    rows = []
    if source:
        with source.open(newline="", encoding="utf-8-sig") as handle:
            rows = list(csv.DictReader(handle))
    goals = [goal_for(person, rows, month) for person in staff]
    fields = sorted({k for row in rows + goals for k in row} | {"monthly_sales_goal", "target_opportunities_monthly", "daily_opportunity_goal", "target_rate", "target_rate_type", "target_average", "membership_monthly_goal", "membership_conversion_goal", "review_monthly_goal", "working_days", "leads_set_goal", "install_sales_goal", "install_sales_actual_source"})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(goals)


def calculate_advisor_proposal(months: list[dict], close_lift_mode: str | None = None) -> dict:
    """Raymond's ten-month formula; +15% means relative growth (x 1.15)."""
    close_lift_mode = close_lift_mode or "relative"
    if close_lift_mode not in ("relative", "percentage_points"):
        raise ValueError("Unknown close-rate lift mode")
    eligible = [m for m in months if m.get("employed", True) and m.get("complete", False)]
    if not eligible:
        return {"approvalStatus": "UPDATED_GOAL_PENDING", "reason": "No completed employment history"}
    sales = sum(float(m["sales"]) for m in eligible)
    opportunities = sum(float(m["opportunities"]) for m in eligible)
    closed = sum(float(m["closedOpportunities"]) for m in eligible)
    rate = closed / opportunities if opportunities else None
    target_rate = (rate * 1.15 if close_lift_mode == "relative" else rate + .15 if close_lift_mode == "percentage_points" else None) if rate is not None else None
    sales_goal = round(sales / len(eligible) * 1.5, 2)
    ticket = round(sales / closed * 1.5, 2) if closed else None
    implied = round(75 * target_rate * ticket, 2) if target_rate is not None and ticket is not None else None
    return {"approvalStatus": "DRAFT", "historyMonths": len(eligible), "targetOpportunitiesMonthly": 75, "monthlySalesGoal": sales_goal, "targetAverage": ticket, "targetRate": target_rate, "requiresCloseRateClarification": False, "rateOutOfRange": target_rate is not None and target_rate > 1, "salesImpliedByDials": implied, "salesGoalDifference": round(sales_goal - implied, 2) if implied is not None else None}


def central_personnel(env: dict, month: str, *, refresh: bool = False) -> dict:
    base = str(env.get("API_BASE_URL") or "").rstrip("/")
    token = str(env.get("AUTH_COOKIE_SECRET") or "")
    if not base or not token:
        raise ValueError("Central personnel API and server access token are required")
    route = "/api/dashboard/personnel/refresh" if refresh else "/api/dashboard/personnel"
    request = Request(f"{base}{route}?month={month}", method="POST" if refresh else "GET", headers={
        "x-dashboard-access-token": token, "x-dashboard-write-token": token,
    })
    with urlopen(request, timeout=120) as response:
        directory = json.load(response)
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(directory["fetchedAt"])).total_seconds()
    if not -300 <= age <= 3600:
        raise ValueError("Central personnel directory exceeds the agreed one-hour freshness limit")
    return directory


def prepare_personnel(repo: Path, marketing_env: Path, env: dict, source: Path, month: str, cycle: str, run, *, build_proposals: bool = True) -> Path:
    directory = central_personnel(env, month, refresh=True)
    staff = [person for person in directory["staff"] if person["cycle"] == cycle and person.get("active") is True]
    roster = source / "personnel.json"
    roster.parent.mkdir(parents=True, exist_ok=True)
    roster.write_text(json.dumps(directory, indent=2), encoding="utf-8")
    goals = []
    for person in staff:
        goal = dict(person["goal"])
        goal.update(role="HVAC Comfort Advisor" if cycle == "advisor" else "Service Technician", target_rate_type="close")
        goals.append(goal)
    fields = sorted({key for goal in goals for key in goal} | {"technicianId", "technician", "month", "report_department", "approval_status"})
    with (source / "performance-goals.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(goals)
    print(f"active_{cycle}_roster={len(staff)}", flush=True)
    return roster


def refresh_personnel_if_due(repo: Path, marketing_env: Path, env: dict, run) -> None:
    """Check the server-owned directory without launching a second source synchronizer."""
    folder = repo / "var/performance-personnel"
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / ".refresh.lock").open("a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        generated = folder / "personnel.json"
        if generated.exists():
            fetched = datetime.fromisoformat(json.loads(generated.read_text())["fetchedAt"])
            if 0 <= (datetime.now(timezone.utc) - fetched).total_seconds() < 15 * 60:
                return
        month = datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m")
        directory = central_personnel(env, month)
        temporary = generated.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(directory), encoding="utf-8")
        temporary.replace(generated)


def report_export_options(cycle: str) -> list[str]:
    slugs = ["fieldpro_recordings_per_technician", "fieldpro_technician_recording_activity", "technician_dashboard_productivity", "technician_performance_board", "technician_performance_scorecard_vadim", "field_conversion_report", "operations_performance"]
    if cycle == "advisor":
        slugs.append("comfort_advisor_performance_scorecard")
    return ["--skip-catalog", "--fail-on-missing-selected", "--timeout-seconds", "300", *[arg for slug in slugs for arg in ("--report-slug", slug)]]


def main() -> int:
    from run_service_tech_thursday_delivery import _load_environment
    parser = argparse.ArgumentParser(description="Export the shared central personnel directory; no external messages")
    parser.add_argument("--output", required=True)
    parser.add_argument("--month", default=datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m"))
    args = parser.parse_args()
    env = _load_environment([Path(__file__).resolve().parents[1] / ".env"])
    payload = central_personnel(env, args.month, refresh=True)
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("personnel=" + str(len(payload["staff"])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
