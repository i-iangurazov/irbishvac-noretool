from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


SERVICE_TITAN_ENV_KEYS = {
    "SERVICETITAN_CLIENT_ID",
    "SERVICETITAN_CLIENT_SECRET",
    "SERVICETITAN_TENANT_ID",
    "SERVICETITAN_APP_KEY",
    "SERVICETITAN_ENVIRONMENT",
    "SERVICETITAN_BASE_URL",
    "SERVICETITAN_AUTH_URL",
    "SERVICETITAN_JOB_URL_TEMPLATE",
}

REQUIRED_KEYS = {
    "SERVICETITAN_CLIENT_ID",
    "SERVICETITAN_CLIENT_SECRET",
    "SERVICETITAN_TENANT_ID",
    "SERVICETITAN_APP_KEY",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the performance export with only ServiceTitan credentials from an env file."
    )
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--export-script", required=True)
    parser.add_argument("export_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    selected = _selected_env(Path(args.env_file))
    missing = sorted(key for key in REQUIRED_KEYS if not selected.get(key))
    if missing:
        raise ValueError(f"Missing required ServiceTitan settings: {', '.join(missing)}")

    child_env = {
        key: value
        for key, value in os.environ.items()
        if key in {"HOME", "LANG", "LC_ALL", "PATH", "TMPDIR"}
    }
    child_env.update(selected)

    export_args = args.export_args[1:] if args.export_args[:1] == ["--"] else args.export_args
    command = [sys.executable, args.export_script, *export_args]
    return subprocess.run(command, env=child_env, check=False).returncode


def _selected_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key not in SERVICE_TITAN_ENV_KEYS:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


if __name__ == "__main__":
    raise SystemExit(main())
