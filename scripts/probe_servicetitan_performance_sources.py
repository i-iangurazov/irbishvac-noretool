from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any


MARKETING_REPO = Path(__file__).resolve().parents[2] / "irbishvac-marketing"
sys.path.insert(0, str(MARKETING_REPO))

from marketing_os_agent.clients.servicetitan import ServiceTitanApiError, ServiceTitanClient
from marketing_os_agent.config import Settings
from scripts.servicetitan_weekly_performance_export import (
    ReportSpec,
    _api_request,
    build_report_data_body,
    fetch_report_data,
    get_report_description,
    write_report_csv,
)


REPORTS = (
    ReportSpec("technician-dashboard", 213, "Sales from Marketing Leads", "sales_from_marketing_leads"),
    ReportSpec("operations", 80249474, "Comfort Advisor Performance Scorecard", "comfort_advisor_performance_scorecard"),
    ReportSpec("operations", 12389740, "Appointments", "appointments"),
    ReportSpec("marketing", 102440855, "Reviews", "reviews"),
    ReportSpec("marketing", 67020808, "Review", "review"),
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe ServiceTitan sources needed by technician coaching reports.")
    parser.add_argument("--from-date", required=True)
    parser.add_argument("--to-date", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    start_date = date.fromisoformat(args.from_date)
    end_date = date.fromisoformat(args.to_date)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    client = ServiceTitanClient(Settings.from_env())
    summary: dict[str, Any] = {"reports": [], "endpoints": []}

    for spec in REPORTS:
        result: dict[str, Any] = {
            "name": spec.report_name,
            "category": spec.category_id,
            "reportId": spec.report_id,
        }
        try:
            description = get_report_description(client, spec)
            result["parameters"] = _compact_parameters(description)
            result["fields"] = _compact_fields(description)
            body = build_report_data_body(description, start_date, end_date)
            payload = fetch_report_data(client, spec, body)
            result["status"] = "ok"
            result["rows"] = len(payload.get("data") or [])
            result["returnedFields"] = _compact_fields(payload)
            (output_dir / f"{spec.slug}.json").write_text(
                json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            write_report_csv(payload, output_dir / f"{spec.slug}.csv")
        except (ServiceTitanApiError, ValueError) as exc:
            result["status"] = "error"
            result["error"] = str(exc)
        summary["reports"].append(result)

    tenant = client.settings.servicetitan_tenant_id
    endpoints = (
        ("technicians", client._tenant_path("settings", "technicians"), {"pageSize": "1", "active": "Any"}),
        ("appointments", client._tenant_path("jpm", "appointments"), {"pageSize": "1", "includeTotal": "true"}),
        ("job_timesheets", client._tenant_path("payroll", "jobs/timesheets"), {"pageSize": "1"}),
        ("forms", f"/forms/v2/tenant/{tenant}/forms", {"pageSize": "1", "active": "Any"}),
        ("form_submissions", f"/forms/v2/tenant/{tenant}/submissions", {"pageSize": "1"}),
    )
    for name, path, params in endpoints:
        result = {"name": name, "path": path}
        try:
            payload = _api_request(client, "GET", path, params)
            records = payload.get("data") or payload.get("items") or []
            sample = records[0] if records and isinstance(records[0], dict) else {}
            result.update({
                "status": "ok",
                "totalCount": payload.get("totalCount"),
                "sampleKeys": sorted(sample.keys()),
            })
        except ServiceTitanApiError as exc:
            result.update({"status": "error", "error": str(exc)})
        summary["endpoints"].append(result)

    output_path = output_dir / "probe-summary.json"
    output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"wrote={output_path}")
    return 0


def _compact_parameters(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "name": item.get("name"),
            "label": item.get("label"),
            "dataType": item.get("dataType"),
            "required": bool(item.get("isRequired")),
        }
        for item in payload.get("parameters") or []
    ]


def _compact_fields(payload: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {"name": item.get("name"), "label": item.get("label")}
        for item in payload.get("fields") or []
    ]


if __name__ == "__main__":
    raise SystemExit(main())
