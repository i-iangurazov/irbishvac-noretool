from __future__ import annotations

import argparse
import fcntl
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
from performance_reporting import SCHEDULE_TIMEZONE, prepare_personnel, report_export_options, preparation_complete, record_preparation, refresh_personnel_if_due, run_automatic_delivery


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    marketing_repo = repo / "python"
    parser = argparse.ArgumentParser(
        description="Regenerate, QA, and deliver Thursday technician coaching reports."
    )
    parser.add_argument("--mode", choices=("dry-run", "send", "dashboard"), default="dry-run")
    parser.add_argument("--force-schedule", action="store_true")
    parser.add_argument(
        "--reuse-source-exports",
        action="store_true",
        help="Resume from already exported MTD and baseline CSV files.",
    )
    parser.add_argument("--now", help="ISO timestamp used for deterministic schedule tests")
    parser.add_argument(
        "--output-root", default=str(repo / "var" / "service-tech-report-delivery")
    )
    parser.add_argument("--marketing-env", default=str(marketing_repo / ".env"))
    args = parser.parse_args()

    root_env = repo / ".env"
    marketing_env = Path(args.marketing_env).resolve()
    env = _load_environment([root_env, marketing_env])
    business_timezone = env.get("TIMEZONE") or env.get("APP_TIMEZONE")
    if not business_timezone:
        raise ValueError("TIMEZONE or APP_TIMEZONE is required")
    zone = ZoneInfo(business_timezone)
    now = _business_now(args.now, ZoneInfo(env.get("PERFORMANCE_REPORT_SCHEDULE_TIMEZONE", SCHEDULE_TIMEZONE)))
    if args.mode == "send" and not args.force_schedule:
        if run_automatic_delivery(repo, Path(args.output_root).resolve(), now, env, "technician", _run):
            return 0
        args.mode = "dry-run"
        print("automatic_delivery=prepare_only outside the authorized 19:40 send slot")

    if args.force_schedule and args.mode == "send" and not _truthy(
        env.get("TECH_REPORT_ALLOW_FORCE_SEND")
    ):
        raise ValueError(
            "Forced live delivery is disabled; set TECH_REPORT_ALLOW_FORCE_SEND=true for an intentional override"
        )
    if args.mode != "dashboard" and not args.force_schedule and not _inside_delivery_window(now, env):
        refresh_personnel_if_due(repo, marketing_env, env, _run)
        print(f"schedule_noop={now.isoformat()}")
        return 0

    output_root = Path(args.output_root).resolve()
    if args.mode == "dry-run" and not args.force_schedule and preparation_complete(output_root / now.date().isoformat() / "preparation-state.json"):
        print("preparation_noop=already ready for today's cycle")
        return 0
    output_root.mkdir(parents=True, exist_ok=True)
    lock_path = output_root / ".delivery.lock"
    with lock_path.open("a+") as lock_handle:
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("delivery_noop=another process holds the delivery lock")
            return 0
        return _run_cycle(
            repo=repo,
            marketing_repo=marketing_repo,
            marketing_env=marketing_env,
            root_env=root_env,
            env=env,
            now=now,
            output_root=output_root,
            mode=args.mode,
            reuse_source_exports=args.reuse_source_exports,
        )


def _run_cycle(
    repo: Path,
    marketing_repo: Path,
    marketing_env: Path,
    root_env: Path,
    env: dict[str, str],
    now: datetime,
    output_root: Path,
    mode: str,
    reuse_source_exports: bool,
) -> int:
    delivery_date = now.date()
    cutoff_date = now.astimezone(ZoneInfo("America/Los_Angeles")).date() if mode == "dashboard" else delivery_date - timedelta(days=1)
    period_from = cutoff_date.replace(day=1)
    baseline_to = period_from - timedelta(days=1)
    baseline_from = _shift_month(period_from, -3)
    package = output_root / delivery_date.isoformat()
    source = package / "source"
    mtd_source = source / f"servicetitan-mtd-through-{cutoff_date.isoformat()}"
    baseline_source = source / (
        f"servicetitan-baseline-{baseline_from.isoformat()}_{baseline_to.isoformat()}"
    )
    reviews_source = source / "reviews"
    coaching_source = source / "coaching-evidence"
    provisional_snapshot = source / "service-tech-provisional.json"
    final_snapshot = source / "service-tech-delivery.json"
    pdf_dir = package / "individual-pdfs"
    state_dir = package / "delivery"
    package.mkdir(parents=True, exist_ok=True)
    state_dir.mkdir(parents=True, exist_ok=True)

    if mode == "send" and _delivery_complete(state_dir / "delivery-state.json"):
        print(f"delivery_noop=already complete for {delivery_date.isoformat()}")
        return 0

    print(f"delivery_date={delivery_date.isoformat()}")
    print(f"period={period_from.isoformat()}..{cutoff_date.isoformat()}")
    print(f"timezone={now.tzinfo}")
    roster = prepare_personnel(repo, marketing_env, env, source, cutoff_date.strftime("%Y-%m"), "technician", _run)

    export_wrapper = repo / "scripts" / "run_servicetitan_performance_export.py"
    performance_export = (
        marketing_repo / "scripts" / "servicetitan_weekly_performance_export.py"
    )
    if reuse_source_exports:
        _require_source_exports(mtd_source, "MTD", period_from.isoformat(), cutoff_date.isoformat())
        _require_source_exports(baseline_source, "baseline", baseline_from.isoformat(), baseline_to.isoformat())
        print("source_exports=reused")
    else:
        _run(
            [
                sys.executable,
                str(export_wrapper),
                "--env-file",
                str(marketing_env),
                "--export-script",
                str(performance_export),
                "--",
                *report_export_options("technician"),
                "--from-date",
                period_from.isoformat(),
                "--to-date",
                cutoff_date.isoformat(),
                "--output-dir",
                str(mtd_source),
            ],
            repo,
        )
        if mode != "dashboard" or not _source_exports_valid(baseline_source, baseline_from.isoformat(), baseline_to.isoformat()):
            _run(
                [
                    sys.executable,
                    str(export_wrapper),
                    "--env-file",
                    str(marketing_env),
                    "--export-script",
                    str(performance_export),
                    "--",
                    *report_export_options("technician"),
                    "--from-date",
                    baseline_from.isoformat(),
                    "--to-date",
                    baseline_to.isoformat(),
                    "--output-dir",
                    str(baseline_source),
                ],
                repo,
            )
        else:
            _require_source_exports(baseline_source, "dashboard baseline", baseline_from.isoformat(), baseline_to.isoformat())

    goals = source / "performance-goals.csv"
    report_version = env.get("TECH_REPORT_VERSION", "V7")
    build_snapshot = repo / "scripts" / "build_service_tech_delivery_snapshot.py"
    snapshot_common = [
        sys.executable,
        str(build_snapshot),
        "--roster",
        str(roster),
        "--source-dir",
        str(mtd_source),
        "--baseline-source-dir",
        str(baseline_source),
        "--baseline-from-date",
        baseline_from.isoformat(),
        "--baseline-to-date",
        baseline_to.isoformat(),
        "--goals",
        str(goals),
        "--from-date",
        period_from.isoformat(),
        "--cutoff-date",
        cutoff_date.isoformat(),
        "--skip-api",
        "--report-version",
        report_version,
    ]
    _run(snapshot_common + ["--output", str(provisional_snapshot)], repo)

    reviews_source.mkdir(parents=True, exist_ok=True)
    for filename in ("review.csv", "reviews.csv", "review.json", "reviews.json"):
        shutil.copy2(mtd_source / filename, reviews_source / filename)
    coaching_export = repo / "scripts" / "export_servicetitan_coaching_evidence.py"
    _run(
        [
            sys.executable,
            str(export_wrapper),
            "--env-file",
            str(marketing_env),
            "--export-script",
            str(coaching_export),
            "--",
            "--snapshot",
            str(provisional_snapshot),
            "--reviews-dir",
            str(reviews_source),
            "--from-date",
            period_from.isoformat(),
            "--to-date",
            cutoff_date.isoformat(),
            "--hhr-effective-date",
            env.get("TECH_REPORT_HHR_EFFECTIVE_DATE", "2026-07-23"),
            "--output-dir",
            str(coaching_source),
        ],
        repo,
    )
    _run(
        snapshot_common
        + [
            "--coaching-evidence",
            str(coaching_source / "coaching_evidence.json"),
            "--output",
            str(final_snapshot),
        ],
        repo,
    )

    canonical = source / "canonical-performance.json"
    _run(["pnpm", "exec", "tsx", "--tsconfig", "tsconfig.reporting.json", "scripts/build-canonical-performance.ts",
          "--cycle", "technician", "--from-date", period_from.isoformat(), "--cutoff-date", cutoff_date.isoformat(),
          "--output", str(canonical), *(["--use-current"] if mode == "dashboard" else [])], repo, env)
    _run([sys.executable, str(repo / "scripts/apply_canonical_performance.py"), "--snapshot", str(final_snapshot), "--canonical", str(canonical)], repo)

    if mode == "dashboard":
        _run(["pnpm", "exec", "tsx", "--tsconfig", "tsconfig.reporting.json", "scripts/publish-coaching-snapshot.ts", "--snapshot", str(final_snapshot)], repo, env)
        return 0

    generated_snapshot = repo / "generated" / "service-tech-mtd-delivery.tmp.json"
    generated_snapshot.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(final_snapshot, generated_snapshot)
    _render_and_qa(repo, final_snapshot, pdf_dir, package)
    hvac_combined_pdf = package / (
        f"IRBIS-HVAC-Service-MTD-Coaching-Reports-through-{cutoff_date.isoformat()}.pdf"
    )
    plumbing_combined_pdf = package / (
        f"IRBIS-Plumbing-Service-MTD-Coaching-Reports-through-{cutoff_date.isoformat()}.pdf"
    )
    _merge_department_pdfs(pdf_dir, hvac_combined_pdf, plumbing=False)
    _merge_department_pdfs(pdf_dir, plumbing_combined_pdf, plumbing=True)
    electrical_combined_pdf = package / f"IRBIS-Electrical-Service-MTD-Coaching-Reports-through-{cutoff_date.isoformat()}.pdf"
    _merge_department_pdfs(pdf_dir, electrical_combined_pdf, plumbing=False, department_prefix="electrical")

    sender = repo / "scripts" / "send_service_tech_reports.py"
    sender_command = [
        sys.executable,
        str(sender),
        "--manifest",
        str(pdf_dir / "manifest.json"),
        "--snapshot",
        str(final_snapshot),
        "--pdf-dir",
        str(pdf_dir),
        "--state-dir",
        str(state_dir),
        "--env-file",
        str(root_env),
        "--env-file",
        str(marketing_env),
        "--mode",
        mode,
        "--combined-hvac-pdf",
        str(hvac_combined_pdf),
        "--combined-plumbing-pdf",
        str(plumbing_combined_pdf),
        "--combined-electrical-pdf", str(electrical_combined_pdf),
    ]
    if mode == "dry-run":
        sender_command.append("--mail-preflight")
    _run(sender_command, repo)
    record_preparation(package, final_snapshot)
    print(f"package={package}")
    return 0


def _merge_department_pdfs(pdf_dir: Path, output: Path, plumbing: bool, department_prefix: str | None = None) -> None:
    manifest = json.loads((pdf_dir / "manifest.json").read_text(encoding="utf-8"))
    reports = manifest.get("reports", [])
    selected = []
    for row in reports:
        prefix = department_prefix or ("plumbing" if plumbing else "hvac")
        if str(row.get("department", "")).lower().startswith(prefix):
            selected.append(row)
    if not selected:
        label = "Plumbing Service" if plumbing else "HVAC Service"
        print(f"management_packet_skipped={label}; no active staff")
        return
    inputs = [pdf_dir / str(row["fileName"]) for row in selected]
    pdf_python = _load_environment([Path(__file__).resolve().parents[2] / "irbishvac-marketing/.env"]).get("REPORT_PDF_PYTHON", sys.executable)
    join = Path(__file__).with_name("merge_performance_pdfs.py")
    _run([pdf_python, str(join), "--output", str(output), *(str(path) for path in inputs)], pdf_dir)
    if not output.is_file() or output.stat().st_size < 10_000:
        raise ValueError(f"Combined department PDF was not created correctly: {output}")
    if output.read_bytes()[:5] != b"%PDF-":
        raise ValueError(f"Combined department attachment is not a PDF: {output}")
    print(f"combined_pdf={output}")


def _render_and_qa(
    repo: Path, snapshot: Path, pdf_dir: Path, package: Path
) -> None:
    web = repo / "apps" / "web"
    web_env = os.environ.copy()
    use_built_web = os.environ.get("PERFORMANCE_REPORT_USE_BUILT_WEB") == "true"
    web_env.update(
        {
            "PERFORMANCE_DELIVERY_SNAPSHOT_PATH": str(snapshot),
            "PERFORMANCE_PDF_OUTPUT_DIR": str(pdf_dir),
            "NODE_ENV": "production" if use_built_web else "development",
        }
    )
    # Each render gets an isolated server so a previously running dev server
    # cannot serve a stale snapshot from another delivery package.
    port = _free_port()
    base_url = f"http://127.0.0.1:{port}"
    web_env["PERFORMANCE_WEB_BASE_URL"] = base_url
    report_render_token = secrets.token_urlsafe(32)
    web_env["PERFORMANCE_REPORT_RENDER_MODE"] = "true"
    web_env["PERFORMANCE_REPORT_RENDER_TOKEN"] = report_render_token
    server_log = (package / "renderer.log").open("ab")
    server = subprocess.Popen(
        ["pnpm", "exec", "next", "start" if use_built_web else "dev", "--hostname", "127.0.0.1", "--port", str(port)],
        cwd=web,
        env=web_env,
        stdout=server_log,
        stderr=subprocess.STDOUT,
    )
    try:
        snapshot_payload = json.loads(snapshot.read_text(encoding="utf-8"))
        report_rows = snapshot_payload.get("technicians", [])
        if not report_rows or not report_rows[0].get("slug"):
            raise ValueError("Report snapshot does not contain a renderable technician")
        readiness_url = f"{base_url}/performance/{report_rows[0]['slug']}"
        _wait_for_url(
            readiness_url, server, report_render_token
        )
        _run(["node", "scripts/generate-service-tech-pdfs.mjs"], web, web_env)
        _run(["node", "scripts/qa-service-tech-reports.mjs"], web, web_env)
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=5)
        server_log.close()


def _inside_delivery_window(now: datetime, env: dict[str, str]) -> bool:
    now = now.astimezone(ZoneInfo(env.get("PERFORMANCE_REPORT_SCHEDULE_TIMEZONE", SCHEDULE_TIMEZONE)))
    weekday = env.get("TECH_REPORT_SEND_WEEKDAY", "THU").strip().upper()
    weekday_index = {"MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}
    if weekday not in weekday_index:
        raise ValueError(f"Unsupported TECH_REPORT_SEND_WEEKDAY: {weekday}")
    if now.weekday() != weekday_index[weekday]:
        return False
    target = int(env.get("TECH_REPORT_SEND_HOUR", "18")) * 60 + int(
        env.get("TECH_REPORT_SEND_MINUTE", "30")
    )
    window = int(env.get("TECH_REPORT_SEND_WINDOW_MINUTES", "75"))
    current = now.hour * 60 + now.minute
    return target <= current < target + window


def _business_now(value: Optional[str], zone: ZoneInfo) -> datetime:
    if value:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=zone)
        return parsed.astimezone(zone)
    return datetime.now(zone)


def _shift_month(value: date, months: int) -> date:
    total = value.year * 12 + (value.month - 1) + months
    return date(total // 12, total % 12 + 1, 1)


def _delivery_complete(path: Path) -> bool:
    if not path.exists():
        return False
    payload = json.loads(path.read_text(encoding="utf-8"))
    reports = payload.get("reports", {})
    return bool(reports) and all(row.get("status") == "sent" for row in reports.values())


def _require_source_exports(path: Path, label: str, from_date: str | None = None, to_date: str | None = None) -> None:
    required = (
        "technician_performance_board.csv",
        "technician_performance_scorecard_vadim.csv",
        "technician_dashboard_productivity.csv",
        "fieldpro_technician_recording_activity.csv",
        "field_conversion_report.csv",
        "operations_performance.csv",
    )
    missing = [name for name in required if not (path / name).exists()]
    if missing:
        raise FileNotFoundError(
            f"Cannot reuse {label} source exports; missing: {', '.join(missing)}"
        )
    if from_date is not None:
        manifest = json.loads((path / "export-manifest.json").read_text())
        if manifest.get("fromDate") != from_date or manifest.get("toDate") != to_date or manifest.get("failedReports"):
            raise ValueError(f"Cannot reuse {label}: source dates differ or report exports failed")


def _source_exports_valid(path: Path, from_date: str, to_date: str) -> bool:
    try:
        _require_source_exports(path, "cached baseline", from_date, to_date)
        return True
    except (OSError, ValueError, TypeError):
        return False


def _free_port() -> int:
    with socket.socket() as handle:
        handle.bind(("127.0.0.1", 0))
        return int(handle.getsockname()[1])


def _wait_for_url(
    url: str, process: subprocess.Popen[bytes], report_render_token: str
) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Report renderer stopped with exit code {process.returncode}")
        try:
            request = Request(
                url,
                headers={"x-irbis-report-render-token": report_render_token},
            )
            with urlopen(request, timeout=2) as response:
                if response.status < 500:
                    return
        except Exception:
            time.sleep(1)
    raise TimeoutError(f"Report renderer did not become ready: {url}")


def _url_ready(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as response:
            return response.status < 500
    except Exception:
        return False


def _run(
    command: list[str], cwd: Path, env: Optional[dict[str, str]] = None
) -> None:
    print("running=" + " ".join(_redacted_command(command)), flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True)


def _redacted_command(command: list[str]) -> list[str]:
    return ["<env-file>" if index > 0 and command[index - 1] == "--env-file" else value for index, value in enumerate(command)]


def _load_environment(paths: list[Path]) -> dict[str, str]:
    values: dict[str, str] = {}
    for path in paths:
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            values[key.strip()] = value
    values.update({key: value for key, value in os.environ.items() if value})
    return values


def _truthy(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    raise SystemExit(main())
