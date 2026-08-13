from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


MARKETING_REPO = Path(__file__).resolve().parents[2] / "irbishvac-marketing"
sys.path.insert(0, str(MARKETING_REPO))

from marketing_os_agent.clients.servicetitan import ServiceTitanClient
from marketing_os_agent.config import Settings
from scripts.servicetitan_weekly_performance_export import _api_request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-ids", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--pages", type=int, default=1)
    parser.add_argument("--page-size", type=int, default=5)
    args = parser.parse_args()

    client = ServiceTitanClient(Settings.from_env())
    tenant = client.settings.servicetitan_tenant_id
    result = {}
    job_ids = [part.strip() for part in args.job_ids.split(",") if part.strip()]
    for page in range(1, args.pages + 1):
        payload = _api_request(
            client,
            "GET",
            f"/forms/v2/tenant/{tenant}/submissions",
            {
                "jobId": job_ids[0],
                "page": str(page),
                "pageSize": str(args.page_size),
                "includeTotal": "true",
            },
        )
        result[str(page)] = {
            "page": payload.get("page"),
            "pageSize": payload.get("pageSize"),
            "hasMore": payload.get("hasMore"),
            "totalCount": payload.get("totalCount"),
            "data": [
                {
                    "id": row.get("id"),
                    "formId": row.get("formId"),
                    "formName": row.get("formName"),
                    "status": row.get("status"),
                    "submittedOn": row.get("submittedOn"),
                    "owners": row.get("owners"),
                }
                for row in payload.get("data", [])
                if isinstance(row, dict)
            ],
        }
    Path(args.output).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"wrote={args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
