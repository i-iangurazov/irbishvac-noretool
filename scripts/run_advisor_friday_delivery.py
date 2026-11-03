from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from performance_reporting import SCHEDULE_TIMEZONE, prepare_personnel, report_export_options, preparation_complete, record_preparation, refresh_personnel_if_due, run_automatic_delivery

from run_service_tech_thursday_delivery import (
    _business_now,
    _delivery_complete,
    _load_environment,
    _render_and_qa,
    _require_source_exports,
    _run,
    _shift_month,
    _truthy,
)


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    marketing_repo = repo / "python"
    parser = argparse.ArgumentParser(
        description="Regenerate, QA, and deliver Friday Comfort Advisor reports."
    )
    parser.add_argument("--mode", choices=("dry-run", "send", "dashboard"), default="dry-run")
    parser.add_argument("--force-schedule", action="store_true")
    parser.add_argument("--reuse-source-exports", action="store_true")
    parser.add_argument("--now", help="ISO timestamp used for deterministic schedule tests")
    parser.add_argument(
        "--output-root", default=str(repo / "var" / "advisor-report-delivery")
    )
    parser.add_argument(
        "--marketing-env", default=str(marketing_repo / ".env")
    )
    args = parser.parse_args()

    root_env = repo / ".env"
    marketing_env = Path(args.marketing_env).resolve()
    env = _load_environment([root_env, marketing_env])
    timezone = env.get("TIMEZONE") or env.get("APP_TIMEZONE")
    if not timezone:
        raise ValueError("TIMEZONE or APP_TIMEZONE is required")
    zone = ZoneInfo(timezone)
    now = _business_now(args.now, ZoneInfo(env.get("PERFORMANCE_REPORT_SCHEDULE_TIMEZONE", SCHEDULE_TIMEZONE)))
    if args.mode == "send" and not args.force_schedule:
        if run_automatic_delivery(repo, Path(args.output_root).resolve(), now, env, "advisor", _run):
            return 0
        args.mode = "dry-run"
        print("automatic_delivery=prepare_only outside the authorized 19:40 send slot")
    if args.force_schedule and args.mode == "send" and not _truthy(
        env.get("ADVISOR_REPORT_ALLOW_FORCE_SEND")
    ):
        raise ValueError("Forced live advisor delivery is disabled")
    if args.mode != "dashboard" and not args.force_schedule and not _inside_delivery_window(now, env):
        refresh_personnel_if_due(repo, marketing_env, env, _run)
        print(f"schedule_noop={now.isoformat()}")
        return 0

    output_root = Path(args.output_root).resolve()
    if args.mode == "dry-run" and not args.force_schedule and preparation_complete(output_root / now.date().isoformat() / "preparation-state.json"):
        print("preparation_noop=already ready for today's cycle")
        return 0
    output_root.mkdir(parents=True, exist_ok=True)
    with (output_root / ".delivery.lock").open("a+") as lock_handle:
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("delivery_noop=another process holds the advisor delivery lock")
            return 0
        return _run_cycle(
            repo,
            marketing_repo,
            root_env,
            marketing_env,
            env,
            now,
            output_root,
            args.mode,
            args.reuse_source_exports,
        )


def _run_cycle(
    repo: Path,
    marketing_repo: Path,
    root_env: Path,
    marketing_env: Path,
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
    provisional = source / "advisor-provisional.json"
    final_snapshot = source / "advisor-delivery.json"
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
    roster = prepare_personnel(repo, marketing_env, env, source, cutoff_date.strftime("%Y-%m"), "advisor", _run)

    export_wrapper = repo / "scripts" / "run_servicetitan_performance_export.py"
    performance_export = (
        marketing_repo / "scripts" / "servicetitan_weekly_performance_export.py"
    )
    if reuse_source_exports:
        _require_source_exports(mtd_source, "advisor MTD", period_from.isoformat(), cutoff_date.isoformat())
        _require_source_exports(baseline_source, "advisor baseline", baseline_from.isoformat(), baseline_to.isoformat())
        for path, label in (
            (mtd_source, "advisor MTD"),
            (baseline_source, "advisor baseline"),
        ):
            if not (path / "comfort_advisor_performance_scorecard.csv").exists():
                raise FileNotFoundError(
                    f"Cannot reuse {label}; comfort advisor scorecard is missing"
                )
        print("source_exports=reused")
    else:
        for from_date, to_date, output in (
            (period_from, cutoff_date, mtd_source),
            (baseline_from, baseline_to, baseline_source),
        ):
            if mode == "dashboard" and output == baseline_source and (output / "export-manifest.json").exists():
                _require_source_exports(output, "dashboard baseline", baseline_from.isoformat(), baseline_to.isoformat())
                continue
            _run(
                [
                    sys.executable,
                    str(export_wrapper),
                    "--env-file",
                    str(marketing_env),
                    "--export-script",
                    str(performance_export),
                    "--",
                    *report_export_options("advisor"),
                    "--from-date",
                    from_date.isoformat(),
                    "--to-date",
                    to_date.isoformat(),
                    "--output-dir",
                    str(output),
                ],
                repo,
            )

    goals = source / "performance-goals.csv"
    builder = repo / "scripts" / "build_advisor_delivery_snapshot.py"
    common = [
        sys.executable,
        str(builder),
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
        "--report-version",
        env.get("ADVISOR_REPORT_VERSION", "A1"),
    ]
    _run(common + ["--output", str(provisional)], repo)

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
            str(provisional),
            "--reviews-dir",
            str(reviews_source),
            "--from-date",
            period_from.isoformat(),
            "--to-date",
            cutoff_date.isoformat(),
            "--hhr-effective-date",
            cutoff_date.isoformat(),
            "--output-dir",
            str(coaching_source),
        ],
        repo,
    )
    _run(
        common
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
          "--cycle", "advisor", "--from-date", period_from.isoformat(), "--cutoff-date", cutoff_date.isoformat(),
          "--output", str(canonical), *(["--use-current"] if mode == "dashboard" else [])], repo, env)
    _run([sys.executable, str(repo / "scripts/apply_canonical_performance.py"), "--snapshot", str(final_snapshot), "--canonical", str(canonical)], repo)

    if mode == "dashboard":
        _run(["pnpm", "exec", "tsx", "--tsconfig", "tsconfig.reporting.json", "scripts/publish-coaching-snapshot.ts", "--snapshot", str(final_snapshot)], repo, env)
        return 0

    generated = repo / "generated" / "advisor-mtd-delivery.tmp.json"
    generated.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(final_snapshot, generated)
    _render_and_qa(repo, final_snapshot, pdf_dir, package)
    combined_pdf = package / (
        f"IRBIS-Sales-Department-MTD-Coaching-Reports-through-{cutoff_date.isoformat()}.pdf"
    )
    _merge_advisor_pdfs(pdf_dir, combined_pdf)

    sender_env = os.environ.copy()
    sender_env.update(
        {
            "TECH_REPORT_HVAC_MANAGER_EMAIL": env.get(
                "ADVISOR_REPORT_MANAGER_EMAIL", env.get("VADIM_EMAIL", "")
            ),
            "TECH_REPORTS_ENABLED": env.get("ADVISOR_REPORTS_ENABLED", "false"),
        }
    )
    sender_command = [
        sys.executable,
        str(repo / "scripts" / "send_service_tech_reports.py"),
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
        "--delivery-profile",
        "advisor",
        "--combined-pdf",
        str(combined_pdf),
    ]
    if mode == "dry-run":
        sender_command.append("--mail-preflight")
    _run(sender_command, repo, sender_env)
    record_preparation(package, final_snapshot)
    print(f"package={package}")
    return 0


def _merge_advisor_pdfs(pdf_dir: Path, output: Path) -> None:
    manifest = json.loads((pdf_dir / "manifest.json").read_text(encoding="utf-8"))
    by_slug = {str(row["slug"]): row for row in manifest["reports"]}
    if not by_slug or len(by_slug) != len(manifest["reports"]):
        raise ValueError("Advisor PDF roster is empty or contains duplicate IDs")
    order = tuple(row["slug"] for row in sorted(manifest["reports"], key=lambda row: row["technician"]))
    inputs = [pdf_dir / str(by_slug[slug]["fileName"]) for slug in order]
    pdf_python = _load_environment([Path(__file__).resolve().parents[2] / "irbishvac-marketing/.env"]).get("REPORT_PDF_PYTHON", sys.executable)
    join = Path(__file__).with_name("merge_performance_pdfs.py")
    _run([pdf_python, str(join), "--output", str(output), *(str(path) for path in inputs)], pdf_dir)
    if not output.is_file() or output.stat().st_size < 10_000:
        raise ValueError(f"Combined advisor PDF was not created correctly: {output}")
    if output.read_bytes()[:5] != b"%PDF-":
        raise ValueError(f"Combined advisor attachment is not a PDF: {output}")
    print(f"combined_pdf={output}")


def _inside_delivery_window(now: datetime, env: dict[str, str]) -> bool:
    now = now.astimezone(ZoneInfo(env.get("PERFORMANCE_REPORT_SCHEDULE_TIMEZONE", SCHEDULE_TIMEZONE)))
    weekday = env.get("ADVISOR_REPORT_SEND_WEEKDAY", "FRI").strip().upper()
    weekday_index = {
        "MON": 0,
        "TUE": 1,
        "WED": 2,
        "THU": 3,
        "FRI": 4,
        "SAT": 5,
        "SUN": 6,
    }
    if weekday not in weekday_index:
        raise ValueError(f"Unsupported ADVISOR_REPORT_SEND_WEEKDAY: {weekday}")
    if now.weekday() != weekday_index[weekday]:
        return False
    target = int(env.get("ADVISOR_REPORT_SEND_HOUR", "18")) * 60 + int(
        env.get("ADVISOR_REPORT_SEND_MINUTE", "30")
    )
    window = int(env.get("ADVISOR_REPORT_SEND_WINDOW_MINUTES", "75"))
    current = now.hour * 60 + now.minute
    return target <= current < target + window


if __name__ == "__main__":
    raise SystemExit(main())
