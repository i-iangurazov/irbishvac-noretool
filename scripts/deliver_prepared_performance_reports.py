"""Deliver the reviewed package without regenerating its PDFs or data."""
from __future__ import annotations
import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from performance_reporting import SCHEDULE_TIMEZONE, assert_send_ready
from run_service_tech_thursday_delivery import _load_environment


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cycle", choices=("advisor", "technician"), required=True)
    parser.add_argument("--mode", choices=("dry-run", "send"), default="dry-run")
    parser.add_argument("--output-root", help="Existing delivery package root; defaults to the cycle's normal root")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    marketing_env = repo.parent / "irbishvac-marketing/.env"
    env = _load_environment([repo / ".env", marketing_env])
    today = datetime.now(ZoneInfo(SCHEDULE_TIMEZONE)).date().isoformat()
    folder = "advisor-report-delivery" if args.cycle == "advisor" else "service-tech-report-delivery"
    package = (Path(args.output_root).resolve() if args.output_root else repo / "var" / folder) / today
    snapshot = package / "source" / ("advisor-delivery.json" if args.cycle == "advisor" else "service-tech-delivery.json")
    data = json.loads(snapshot.read_text())
    if args.mode == "send":
        assert_send_ready(data)
    cutoff = data["cutoffDate"]
    cmd = [sys.executable, str(repo / "scripts/send_service_tech_reports.py"), "--manifest", str(package / "individual-pdfs/manifest.json"), "--snapshot", str(snapshot), "--pdf-dir", str(package / "individual-pdfs"), "--state-dir", str(package / "delivery"), "--env-file", str(repo / ".env"), "--env-file", str(marketing_env), "--mode", args.mode, "--delivery-profile", args.cycle]
    if args.cycle == "advisor":
        cmd.extend(["--combined-pdf", str(package / f"IRBIS-Sales-Department-MTD-Coaching-Reports-through-{cutoff}.pdf")])
        env.update({"TECH_REPORTS_ENABLED": env.get("ADVISOR_REPORTS_ENABLED", "false")})
    else:
        cmd.extend(["--combined-hvac-pdf", str(package / f"IRBIS-HVAC-Service-MTD-Coaching-Reports-through-{cutoff}.pdf"), "--combined-plumbing-pdf", str(package / f"IRBIS-Plumbing-Service-MTD-Coaching-Reports-through-{cutoff}.pdf")])
        cmd.extend(["--combined-electrical-pdf", str(package / f"IRBIS-Electrical-Service-MTD-Coaching-Reports-through-{cutoff}.pdf")])
    if args.mode == "dry-run":
        cmd.append("--smtp-preflight")
    subprocess.run(cmd, cwd=repo, env=env, check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
