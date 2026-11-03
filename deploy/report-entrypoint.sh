#!/bin/sh
set -eu
mkdir -p "${PERFORMANCE_REPORT_DATA_DIR:-/data/performance}"
if [ ! -L /app/var ]; then
  ln -s "${PERFORMANCE_REPORT_DATA_DIR:-/data/performance}" /app/var
fi
# Smoke jobs are finite and never invoke SMTP DATA. Normal service is persistent.
if [ "${PERFORMANCE_REPORT_SMOKE_CYCLE:-}" != "" ]; then
  exec python3 -u scripts/report_server.py --smoke "$PERFORMANCE_REPORT_SMOKE_CYCLE"
fi
exec python3 -u scripts/report_server.py
