"""Persistent, single-host scheduler for the two approved coaching cycles.

The delivery library owns recipient validation, frozen attachments and per-message
SMTP state. This process owns durable scheduling, retries and owner alerts.
"""
from __future__ import annotations
import argparse
import fcntl
import json
import os
import signal
import subprocess
import sys
import threading
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from zoneinfo import ZoneInfo
from performance_reporting import central_personnel, preparation_complete, SCHEDULE_TIMEZONE
from run_service_tech_thursday_delivery import _load_environment
from send_service_tech_reports import _smtp, _email, _atomic_json

REPO = Path(__file__).resolve().parents[1]
STOP = threading.Event()
CYCLES = {"technician": (3, "run_service_tech_thursday_delivery.py", "service-tech-report-delivery"),
          "advisor": (4, "run_advisor_friday_delivery.py", "advisor-report-delivery")}


def phase(now: datetime, cycle: str, state: dict) -> str:
    local = now.astimezone(ZoneInfo(SCHEDULE_TIMEZONE))
    if local.weekday() != CYCLES[cycle][0] or state.get("status") in {"sent", "skipped_no_active_staff", "missed_deadline"}:
        return "idle"
    minute = local.hour * 60 + local.minute
    if minute >= 19 * 60 + 45:
        return "missed_deadline" if minute < 20 * 60 else "idle"
    if minute < 18 * 60:
        return "idle"
    if state.get("status") != "ready":
        # Leave time to finish a package; never regenerate one after SMTP began.
        if state.get("smtpStarted") or minute >= 19 * 60 + 35:
            return "send" if state.get("smtpStarted") and minute >= 19 * 60 + 40 else "idle"
        return "prepare"
    return "send" if minute >= 19 * 60 + 40 else "idle"


def has_smtp_started(package: Path) -> bool:
    path = package / "delivery/delivery-state.json"
    return path.exists() and bool(json.loads(path.read_text()).get("reports"))


def alert(env: dict, state: dict, key: str, detail: str) -> None:
    if state.get("alertedKey") == key:
        return
    try:
        owner = _email(env.get("PERFORMANCE_REPORT_ALERT_EMAIL", "it@irbishvac.com"), "report owner")
        message = EmailMessage()
        message["From"] = _email(env.get("EMAIL_FROM") or env["SMTP_USER"], "sender")
        message["To"] = owner
        message["Subject"] = "IRBIS reporting requires attention: " + key
        message.set_content(detail + "\nInspect the reporting service log and persistent scheduler state.\n")
        with _smtp(env) as smtp:
            rejected = smtp.send_message(message)
            if rejected:
                raise RuntimeError("Owner notification rejected")
        state["alertedKey"] = key
        state.pop("pendingAlert", None)
    except Exception as error:
        # No credentials or raw upstream responses in the public service log.
        state["pendingAlert"] = {"key": key, "detail": detail, "retryAt": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()}
        print(json.dumps({"alertFailed": key, "errorType": type(error).__name__}), flush=True)


def run_logged(command: list[str], package: Path, env: dict) -> None:
    package.mkdir(parents=True, exist_ok=True)
    with (package / "server-run.log").open("ab", buffering=0) as log:
        process = subprocess.Popen(command, cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        while process.poll() is None:
            if STOP.wait(1):
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                raise RuntimeError("Server interrupted; inspect persistent SMTP state before retrying")
        if process.returncode:
            raise RuntimeError("Report subprocess failed; see the private package log")


def tick(repo: Path, root: Path, env: dict, now: datetime) -> None:
    local = now.astimezone(ZoneInfo(SCHEDULE_TIMEZONE))
    for cycle, (_, script, folder) in CYCLES.items():
        output = root / folder
        package = output / local.date().isoformat()
        state_path = root / "scheduler" / f"{local.date().isoformat()}-{cycle}.json"
        state = json.loads(state_path.read_text()) if state_path.exists() else {"cycle": cycle, "runKind": "scheduled", "status": "waiting"}
        action = phase(now, cycle, state)
        if action == "idle":
            pending = state.get("pendingAlert")
            if pending and state.get("status") not in {"sent", "skipped_no_active_staff"} and now >= datetime.fromisoformat(pending["retryAt"]):
                alert(env, state, pending["key"], pending["detail"])
                _atomic_json(state_path, state)
            continue
        retry_at = datetime.fromisoformat(state["retryAt"]) if state.get("retryAt") else now
        if action != "missed_deadline" and now < retry_at:
            continue
        state.update(lastAttemptAt=now.isoformat(), action=action)
        try:
            if action == "missed_deadline":
                state["status"] = "missed_deadline"
                alert(env, state, f"{local.date()}-{cycle}-deadline", "The cycle did not reach confirmed delivery before 19:45 Asia/Bishkek. No automatic late send will occur.")
            elif action == "prepare":
                directory = central_personnel(env, (local.date() - timedelta(days=1)).strftime("%Y-%m"), refresh=True)
                active = [p for p in directory["staff"] if p["cycle"] == cycle and p["active"]]
                if not active:
                    state.update(status="skipped_no_active_staff", staffCount=0)
                elif has_smtp_started(package):
                    state.update(status="ready", smtpStarted=True)
                else:
                    run_logged([sys.executable, str(repo / "scripts" / script), "--mode", "dry-run", "--force-schedule", "--output-root", str(output)], package, env)
                    if not preparation_complete(package / "preparation-state.json"):
                        raise RuntimeError("Package is a preview or incomplete; live delivery is blocked")
                    state.update(status="ready", staffCount=len(active), preparedAt=datetime.now(timezone.utc).isoformat())
            else:
                state["smtpStarted"] = has_smtp_started(package)
                run_logged([sys.executable, str(repo / "scripts/deliver_prepared_performance_reports.py"), "--cycle", cycle, "--mode", "send", "--output-root", str(output)], package, env)
                delivery = json.loads((package / "delivery/delivery-state.json").read_text())
                plan = json.loads((package / "delivery/delivery-plan.json").read_text())
                expected = {p["slug"] for p in plan["reports"]}
                sent = delivery.get("reports", {})
                if not expected or set(sent) != expected or any(row["status"] != "sent" for row in sent.values()):
                    raise RuntimeError("Delivery is not confirmed for every planned message")
                state.update(status="sent", completedAt=datetime.now(timezone.utc).isoformat(), messageCount=len(sent))
                state.pop("retryAt", None)
        except Exception as error:
            state.update(errorType=type(error).__name__, retryAt=(datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat(),
                         smtpStarted=has_smtp_started(package))
            # Once SMTP starts the sender resumes only confirmed unsent items. A
            # 'sending' item requires manual reconciliation and is never replayed.
            alert(env, state, f"{local.date()}-{cycle}-{action}", f"The {action} step failed. No success is recorded. Staff, goals, data completeness and SMTP state must be valid before any delivery.")
        state_path.parent.mkdir(parents=True, exist_ok=True)
        _atomic_json(state_path, state)
        print(json.dumps({"cycle": cycle, "action": action, "status": state["status"], "date": str(local.date())}), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", choices=CYCLES, help="Prepare and validate only, in a separate non-sending output tree")
    args = parser.parse_args()
    env = _load_environment([REPO / ".env"])
    root = Path(env.get("PERFORMANCE_REPORT_DATA_DIR", str(REPO / "var"))).resolve()
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".server.lock").open("a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.smoke:
            # The last fully closed Pacific day, not the unfinished Bishkek 'yesterday'.
            cutoff = datetime.now(ZoneInfo("America/Los_Angeles")).date() - timedelta(days=1)
            delivery_date = cutoff + timedelta(days=1)
            output = root / "smoke" / CYCLES[args.smoke][2]
            package = output / str(delivery_date)
            run_logged([sys.executable, str(REPO / "scripts" / CYCLES[args.smoke][1]), "--mode", "dry-run", "--force-schedule", "--now", f"{delivery_date}T18:30:00+06:00", "--output-root", str(output)], package, env)
            _atomic_json(package / "smoke-state.json", {"runKind": "smoke", "noLiveSend": True, "completedAt": datetime.now(timezone.utc).isoformat()})
            return 0
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, lambda *_: STOP.set())
        monitor_path = root / "scheduler/personnel-health.json"
        monitor = json.loads(monitor_path.read_text()) if monitor_path.exists() else {}
        next_check = datetime.min.replace(tzinfo=timezone.utc)
        while not STOP.is_set():
            now = datetime.now(timezone.utc)
            if now >= next_check:
                try:
                    directory = central_personnel(env, now.astimezone(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m"))
                    monitor = {"status": "healthy", "fetchedAt": directory["fetchedAt"], "checkedAt": now.isoformat()}
                except Exception as error:
                    monitor.update(status="failed", errorType=type(error).__name__, checkedAt=now.isoformat())
                    alert(env, monitor, "personnel-unavailable", "The central personnel directory is unavailable or older than one hour. Consumers block stale data. Check the API and personnel worker.")
                monitor_path.parent.mkdir(parents=True, exist_ok=True)
                _atomic_json(monitor_path, monitor)
                next_check = now + timedelta(minutes=5)
            tick(REPO, root, env, now)
            STOP.wait(20)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
