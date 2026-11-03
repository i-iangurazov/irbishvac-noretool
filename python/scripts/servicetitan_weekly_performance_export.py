from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from marketing_os_agent.clients.servicetitan import ServiceTitanApiError, ServiceTitanClient
from marketing_os_agent.config import Settings


OUTPUT_DIR = Path("data/service_titan_reports")
PAGE_SIZE = 500


@dataclass(frozen=True)
class ReportSpec:
    category_id: str
    report_id: int
    report_name: str
    slug: str


REPORTS = [
    ReportSpec("marketing", 102440855, "Reviews", "reviews"),
    ReportSpec("marketing", 67020808, "Review", "review"),
    ReportSpec("operations", 125008030, "Field Pro Recordings Per Technician", "fieldpro_recordings_per_technician"),
    ReportSpec("operations", 125005789, "Field Pro Recordings Overview", "fieldpro_recordings_overview"),
    ReportSpec("operations", 125959497, "Field Pro Technician Recording Activity", "fieldpro_technician_recording_activity"),
    ReportSpec("technician-dashboard", 201, "Productivity", "technician_dashboard_productivity"),
    ReportSpec("technician", 6771055, "Technician Performance Board", "technician_performance_board"),
    ReportSpec("operations", 80249474, "Comfort Advisor Performance Scorecard", "comfort_advisor_performance_scorecard"),
    ReportSpec("technician", 101706200, "Technician Performance scorecard Oscar", "technician_performance_scorecard_oscar"),
    ReportSpec("technician", 66109112, "Technician Performance scorecard Vadim", "technician_performance_scorecard_vadim"),
    ReportSpec("technician", 900, "Field Conversion Report", "field_conversion_report"),
    ReportSpec("technician", 915, "Field Quality Report", "field_quality_report"),
    ReportSpec("operations", 7966542, "Performance", "operations_performance"),
    ReportSpec("operations", 11184462, "Irbis Performance KPI's", "irbis_performance_kpis"),
]


def main() -> int:
    default_start, default_end = _previous_full_week(date.today())
    parser = argparse.ArgumentParser(description="Export weekly ServiceTitan Field Pro and technician performance reports.")
    parser.add_argument("--from-date", default=default_start.isoformat(), help="Report start date, YYYY-MM-DD.")
    parser.add_argument("--to-date", default=default_end.isoformat(), help="Report end date, YYYY-MM-DD.")
    parser.add_argument("--output-dir", default=str(OUTPUT_DIR), help="Directory for CSV/JSON exports.")
    parser.add_argument("--catalog-only", action="store_true", help="Only refresh the ServiceTitan report catalog.")
    parser.add_argument("--fail-on-missing-selected", action="store_true", help="Exit unsuccessfully if any selected report cannot be exported.")
    parser.add_argument(
        "--skip-catalog",
        action="store_true",
        help="Skip the report catalog refresh when exporting known report IDs.",
    )
    parser.add_argument(
        "--report-slug",
        action="append",
        choices=[spec.slug for spec in REPORTS],
        help="Export only the selected report slug. Repeat to select multiple reports.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=60,
        help="Per-request timeout for slow reporting endpoints.",
    )
    args = parser.parse_args()

    start_date = _parse_date(args.from_date)
    end_date = _parse_date(args.to_date)
    if end_date < start_date:
        raise ValueError("--to-date must be on or after --from-date")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    settings = Settings.from_env()
    client = ServiceTitanClient(settings)
    # Reporting endpoints can take longer than transactional API calls,
    # especially for a multi-month baseline window.
    client.http.timeout_seconds = args.timeout_seconds
    client.http.retries = 3

    if not args.skip_catalog:
        catalog_rows = export_report_catalog(client, output_dir)
        print(f"catalog rows: {len(catalog_rows)} -> {output_dir / 'report_catalog.csv'}")

    if args.catalog_only:
        return 0

    print(f"report window: {start_date.isoformat()} through {end_date.isoformat()}")
    selected_slugs = set(args.report_slug or [])
    selected_reports = [
        spec for spec in REPORTS if not selected_slugs or spec.slug in selected_slugs
    ]
    failed = []
    started_at = datetime.now(timezone.utc).isoformat()
    for spec in selected_reports:
        try:
            description = get_report_description(client, spec)
            body = build_report_data_body(description, start_date, end_date)
            payload = fetch_report_data(client, spec, body)
        except ServiceTitanApiError as exc:
            print(f"FAILED {spec.report_name}: HTTP {exc.status} {exc.message}")
            failed.append(spec.slug)
            continue
        except (RuntimeError, TimeoutError, OSError) as exc:
            print(f"FAILED {spec.report_name}: {type(exc).__name__}: {exc}")
            failed.append(spec.slug)
            continue

        json_path = output_dir / f"{spec.slug}.json"
        csv_path = output_dir / f"{spec.slug}.csv"
        json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        write_report_csv(payload, csv_path)
        print(f"exported {spec.report_name}: {len(payload.get('data') or [])} rows -> {csv_path}")

    (output_dir / "export-manifest.json").write_text(json.dumps({"fromDate": args.from_date, "toDate": args.to_date, "startedAt": started_at, "completedAt": datetime.now(timezone.utc).isoformat(), "selectedReports": [s.slug for s in selected_reports], "failedReports": failed}, indent=2), encoding="utf-8")
    return 1 if failed and args.fail_on_missing_selected else 0


def export_report_catalog(client: ServiceTitanClient, output_dir: Path) -> list[dict[str, Any]]:
    categories = _records_from_response(
        _api_request(client, "GET", client._tenant_path("reporting", "report-categories"), {"pageSize": "500", "includeTotal": "true"})
    )
    rows: list[dict[str, Any]] = []
    for category in categories:
        category_id = str(category.get("id") or "")
        category_name = str(category.get("name") or "")
        if not category_id:
            continue
        reports = _records_from_response(
            _api_request(
                client,
                "GET",
                client._tenant_path("reporting", f"report-category/{category_id}/reports"),
                {"pageSize": "500", "includeTotal": "true"},
            )
        )
        for report in reports:
            rows.append(
                {
                    "category_id": category_id,
                    "category_name": category_name,
                    "report_id": report.get("id") or "",
                    "report_name": report.get("name") or "",
                    "description": report.get("description") or "",
                }
            )

    csv_path = output_dir / "report_catalog.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["category_id", "category_name", "report_id", "report_name", "description"])
        writer.writeheader()
        writer.writerows(rows)
    return rows


def get_report_description(client: ServiceTitanClient, spec: ReportSpec) -> dict[str, Any]:
    return _api_request(
        client,
        "GET",
        client._tenant_path("reporting", f"report-category/{spec.category_id}/reports/{spec.report_id}"),
        {},
    )


def build_report_data_body(description: dict[str, Any], start_date: date, end_date: date) -> dict[str, Any]:
    parameters: list[dict[str, Any]] = []
    for parameter in description.get("parameters") or []:
        name = str(parameter.get("name") or "")
        label = str(parameter.get("label") or "")
        data_type = str(parameter.get("dataType") or "")
        is_required = bool(parameter.get("isRequired"))
        if not name or not is_required:
            continue
        if data_type == "Date":
            parameters.append({"name": name, "value": _date_value_for_parameter(name, label, start_date, end_date)})
            continue
        if data_type == "Boolean":
            parameters.append({"name": name, "value": False})
            continue
        raise ValueError(f"Cannot auto-fill required report parameter {name!r} ({data_type}) for {description.get('name')}")
    return {"parameters": parameters}


def fetch_report_data(client: ServiceTitanClient, spec: ReportSpec, body: dict[str, Any]) -> dict[str, Any]:
    fields: list[dict[str, Any]] = []
    data_rows: list[list[Any]] = []
    total_count: int | None = None
    page = 1
    while True:
        payload = _api_request(
            client,
            "POST",
            client._tenant_path("reporting", f"report-category/{spec.category_id}/reports/{spec.report_id}/data"),
            {"page": str(page), "pageSize": str(PAGE_SIZE), "includeTotal": "true"},
            body,
        )
        if not isinstance(payload.get("fields"), list) or not isinstance(payload.get("data"), list) or not isinstance(payload.get("hasMore"), bool):
            raise RuntimeError("Incomplete report: fields, data or pagination metadata missing")
        if any(not isinstance(row, list) for row in payload["data"]):
            raise RuntimeError("Incomplete report: malformed data row")
        if page > 1 and fields != payload["fields"]:
            raise RuntimeError("Incomplete report: fields changed between pages")
        if not fields:
            fields = list(payload["fields"])
        if payload["hasMore"] and not payload["data"]:
            raise RuntimeError("Incomplete report: empty intermediate page")
        data_rows.extend(payload["data"])
        if payload.get("totalCount") is not None:
            total_count = int(payload.get("totalCount") or 0)
        if not payload["hasMore"]:
            if total_count is not None and total_count != len(data_rows):
                raise RuntimeError("Incomplete report: collected rows differ from totalCount")
            break
        page += 1
        if page > 100:
            raise RuntimeError("Incomplete report: pagination exceeded 100 pages")

    return {
        "fields": fields,
        "page": 1,
        "pageSize": PAGE_SIZE,
        "hasMore": False,
        "totalCount": total_count if total_count is not None else len(data_rows),
        "data": data_rows,
    }


def write_report_csv(payload: dict[str, Any], path: Path) -> None:
    headers = [str(field.get("name") or field.get("label") or f"column_{index + 1}") for index, field in enumerate(payload.get("fields") or [])]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(headers)
        writer.writerows(payload.get("data") or [])


def _api_request(
    client: ServiceTitanClient,
    method: str,
    path: str,
    params: dict[str, str],
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    token = client._access_token_or_refresh()
    query = urlencode({key: value for key, value in params.items() if value is not None})
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


def _records_from_response(data: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("data", "items", "results", "records"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _date_value_for_parameter(name: str, label: str, start_date: date, end_date: date) -> str:
    normalized = f"{name} {label}".lower()
    if "_to" in normalized or normalized.endswith(" to") or " end" in normalized or "until" in normalized:
        return end_date.isoformat()
    return start_date.isoformat()


def _previous_full_week(today: date) -> tuple[date, date]:
    this_monday = today - timedelta(days=today.weekday())
    previous_monday = this_monday - timedelta(days=7)
    previous_sunday = this_monday - timedelta(days=1)
    return previous_monday, previous_sunday


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


if __name__ == "__main__":
    raise SystemExit(main())
