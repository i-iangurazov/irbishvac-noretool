from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlencode


MARKETING_REPO = Path(__file__).resolve().parents[2] / "irbishvac-marketing"
sys.path.insert(0, str(MARKETING_REPO))

from marketing_os_agent.clients.servicetitan import ServiceTitanApiError, ServiceTitanClient
from marketing_os_agent.config import Settings


PAGE_SIZE = 500


@dataclass(frozen=True)
class ReportSpec:
    category_id: str
    report_id: int
    slug: str


REPORTS = (
    ReportSpec("operations", 7148368, "sold_estimates"),
    ReportSpec("marketing", 101394656, "revenue_by_campaign"),
    ReportSpec("marketing", 898, "campaign_summary"),
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export campaign sales and revenue evidence from ServiceTitan."
    )
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--to-date", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument(
        "--reports",
        default=",".join(spec.slug for spec in REPORTS),
        help="Comma-separated report slugs to export.",
    )
    args = parser.parse_args()

    start_date = date.fromisoformat(args.from_date)
    end_date = date.fromisoformat(args.to_date)
    if end_date < start_date:
        raise ValueError("--to-date must be on or after --from-date")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    client = ServiceTitanClient(Settings.from_env())
    selected_reports = {value.strip() for value in args.reports.split(",") if value.strip()}
    manifest: list[dict[str, Any]] = []
    for spec in REPORTS:
        if spec.slug not in selected_reports:
            continue
        description = _request(
            client,
            "GET",
            client._tenant_path(
                "reporting",
                f"report-category/{spec.category_id}/reports/{spec.report_id}",
            ),
        )
        (output_dir / f"{spec.slug}_description.json").write_text(
            json.dumps(description, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        body = _report_body(description, start_date, end_date)
        payload = _fetch_report(client, spec, body)
        json_path = output_dir / f"{spec.slug}.json"
        csv_path = output_dir / f"{spec.slug}.csv"
        json_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        _write_csv(payload, csv_path)

        row_count = len(payload.get("data") or [])
        manifest.append(
            {
                "category": spec.category_id,
                "reportId": spec.report_id,
                "reportName": description.get("name"),
                "from": start_date.isoformat(),
                "to": end_date.isoformat(),
                "rows": row_count,
                "parameters": body["parameters"],
                "csv": csv_path.name,
            }
        )
        print(f"exported {description.get('name')}: {row_count} rows -> {csv_path}")

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return 0


def _report_body(
    description: dict[str, Any], start_date: date, end_date: date
) -> dict[str, Any]:
    parameters: list[dict[str, Any]] = []
    for parameter in description.get("parameters") or []:
        name = str(parameter.get("name") or "")
        label = str(parameter.get("label") or "")
        data_type = str(parameter.get("dataType") or "")
        if not name or not parameter.get("isRequired"):
            continue
        if data_type == "Date":
            normalized = f"{name} {label}".lower()
            is_end = any(
                marker in normalized
                for marker in ("_to", " to", " end", "through", "until")
            )
            parameters.append(
                {"name": name, "value": (end_date if is_end else start_date).isoformat()}
            )
            continue
        if data_type == "Boolean":
            parameters.append({"name": name, "value": False})
            continue
        accepted_values = ((parameter.get("acceptValues") or {}).get("values") or [])
        if accepted_values and isinstance(accepted_values[0], list):
            parameters.append({"name": name, "value": accepted_values[0][0]})
            continue
        raise ValueError(
            f"Cannot auto-fill required parameter {name!r} ({data_type}) "
            f"for {description.get('name')!r}"
        )
    return {"parameters": parameters}


def _fetch_report(
    client: ServiceTitanClient, spec: ReportSpec, body: dict[str, Any]
) -> dict[str, Any]:
    fields: list[dict[str, Any]] = []
    rows: list[list[Any]] = []
    total_count: int | None = None
    page = 1
    while True:
        payload = _request(
            client,
            "POST",
            client._tenant_path(
                "reporting",
                f"report-category/{spec.category_id}/reports/{spec.report_id}/data",
            ),
            {
                "page": str(page),
                "pageSize": str(PAGE_SIZE),
                "includeTotal": "true",
            },
            body,
        )
        if not fields:
            fields = list(payload.get("fields") or [])
        rows.extend(row for row in payload.get("data") or [] if isinstance(row, list))
        if payload.get("totalCount") is not None:
            total_count = int(payload.get("totalCount") or 0)
        if not payload.get("hasMore"):
            break
        page += 1
    return {
        "fields": fields,
        "page": 1,
        "pageSize": PAGE_SIZE,
        "hasMore": False,
        "totalCount": total_count if total_count is not None else len(rows),
        "data": rows,
    }


def _request(
    client: ServiceTitanClient,
    method: str,
    path: str,
    params: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    token = client._access_token_or_refresh()
    query = urlencode(params or {})
    url = f"{client.settings.servicetitan_base_url}{path}"
    if query:
        url = f"{url}?{query}"
    response = client.http.request_json(
        method,
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "ST-App-Key": client.settings.servicetitan_app_key,
        },
        body=body,
    )
    if response.status >= 400:
        raise ServiceTitanApiError(response.status, response.data)
    return response.data


def _write_csv(payload: dict[str, Any], path: Path) -> None:
    fields = payload.get("fields") or []
    headers = [
        str(field.get("name") or field.get("label") or f"column_{index + 1}")
        for index, field in enumerate(fields)
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(payload.get("data") or [])


if __name__ == "__main__":
    raise SystemExit(main())
