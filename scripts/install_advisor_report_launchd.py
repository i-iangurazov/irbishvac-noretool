from __future__ import annotations

import argparse
import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path


LABEL = "com.irbis.advisor-reports"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Install the local Friday Comfort Advisor report scheduler."
    )
    parser.add_argument("--interval-seconds", type=int, default=300)
    parser.add_argument("--uninstall", action="store_true")
    args = parser.parse_args()
    if args.interval_seconds < 60:
        raise ValueError("interval must be at least 60 seconds")

    repo = Path(__file__).resolve().parents[1]
    launch_agents = Path.home() / "Library" / "LaunchAgents"
    plist_path = launch_agents / f"{LABEL}.plist"
    domain = f"gui/{os.getuid()}"
    service = f"{domain}/{LABEL}"
    if args.uninstall:
        subprocess.run(["launchctl", "bootout", service], check=False)
        if plist_path.exists():
            plist_path.unlink()
        print(f"uninstalled={plist_path}")
        return 0

    pnpm = shutil.which("pnpm")
    if not pnpm:
        raise ValueError("pnpm is not available")
    log_dir = repo / "var" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    launch_agents.mkdir(parents=True, exist_ok=True)
    path_value = ":".join(
        dict.fromkeys(
            [
                str(Path(pnpm).parent),
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
            ]
        )
    )
    payload = {
        "Label": LABEL,
        "ProgramArguments": [
            sys.executable,
            str(repo / "scripts" / "run_advisor_friday_delivery.py"),
            "--mode",
            "send",
        ],
        "WorkingDirectory": str(repo),
        "EnvironmentVariables": {"PATH": path_value, "PYTHONUNBUFFERED": "1"},
        "RunAtLoad": True,
        "StartInterval": args.interval_seconds,
        "ProcessType": "Background",
        "StandardOutPath": str(log_dir / "advisor-reports.log"),
        "StandardErrorPath": str(log_dir / "advisor-reports.error.log"),
    }
    temporary = plist_path.with_suffix(".plist.tmp")
    with temporary.open("wb") as handle:
        plistlib.dump(payload, handle, sort_keys=True)
    temporary.replace(plist_path)
    subprocess.run(["launchctl", "bootout", service], check=False)
    subprocess.run(["launchctl", "bootstrap", domain, str(plist_path)], check=True)
    subprocess.run(["launchctl", "kickstart", service], check=True)
    print(f"installed={plist_path}")
    print(f"service={service}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
