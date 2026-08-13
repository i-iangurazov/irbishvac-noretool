from __future__ import annotations

import argparse
import hashlib
import json
import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr
from pathlib import Path
from typing import Any, Iterable, Optional


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate and individually deliver Service Technician coaching reports."
    )
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--pdf-dir", required=True)
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--env-file", action="append", default=[])
    parser.add_argument("--mode", choices=("dry-run", "send"), default="dry-run")
    parser.add_argument(
        "--test-recipient",
        help="Send one isolated test message to this address without changing delivery state.",
    )
    parser.add_argument(
        "--test-slug",
        help="Report slug for --test-recipient; defaults to the first manifest row.",
    )
    parser.add_argument(
        "--smtp-preflight",
        action="store_true",
        help="Authenticate and validate recipients with SMTP without sending DATA.",
    )
    args = parser.parse_args()

    env = _load_environment([Path(value) for value in args.env_file])
    manifest_path = Path(args.manifest).resolve()
    snapshot_path = Path(args.snapshot).resolve()
    pdf_dir = Path(args.pdf_dir).resolve()
    state_dir = Path(args.state_dir).resolve()
    state_dir.mkdir(parents=True, exist_ok=True)

    manifest = _json(manifest_path)
    snapshot = _json(snapshot_path)
    reports = _validate_package(manifest, snapshot, pdf_dir)
    routing = _routing(env)
    delivery_key = str(manifest["cutoffDate"])

    plan = []
    for report in reports:
        manager = (
            routing["plumbing_manager"]
            if str(report["department"]).lower().startswith("plumbing")
            else routing["hvac_manager"]
        )
        to = _email(str(report["email"]), f"technician {report['technician']}")
        cc = _unique_emails([routing["tim"], manager], to)
        pdf_path = pdf_dir / str(report["fileName"])
        plan.append(
            {
                "slug": report["slug"],
                "technician": report["technician"],
                "department": report["department"],
                "to": [to],
                "cc": cc,
                "attachment": str(pdf_path),
                "attachmentSha256": _sha256(pdf_path),
                "subject": _subject(report["technician"], manifest["cutoffDate"]),
            }
        )

    plan_path = state_dir / "delivery-plan.json"
    _atomic_json(
        plan_path,
        {
            "schemaVersion": 1,
            "createdAt": _utc_now(),
            "deliveryKey": delivery_key,
            "mode": args.mode,
            "emailFrom": routing["from"],
            "reports": plan,
        },
    )
    print(f"validated_reports={len(plan)}")
    print(f"delivery_plan={plan_path}")

    if args.smtp_preflight:
        recipients = [address for row in plan for address in row["to"] + row["cc"]]
        _smtp_preflight(env, routing["from"], _unique_emails(recipients))
        print(f"smtp_preflight_recipients={len(_unique_emails(recipients))}")

    if args.mode == "dry-run":
        print("emails_sent=0")
        return 0

    if not _truthy(env.get("TECH_REPORTS_ENABLED")):
        raise ValueError("TECH_REPORTS_ENABLED must be true for live delivery")

    if args.test_recipient:
        test_recipient = _email(args.test_recipient, "test recipient")
        source = next(
            (row for row in plan if not args.test_slug or row["slug"] == args.test_slug),
            None,
        )
        if source is None:
            raise ValueError(f"Test report slug was not found: {args.test_slug}")
        test_row = {
            **source,
            "to": [test_recipient],
            "cc": [],
            "subject": f"[TEST] {source['subject']}",
        }
        message_id = make_msgid(
            idstring=f"service-tech-test-{source['slug']}",
            domain=parseaddr(routing["from"])[1].split("@", 1)[1],
        )
        with _smtp(env) as smtp:
            smtp.send_message(
                _message(test_row, routing["from"], manifest["cutoffDate"], message_id)
            )
        print(f"test_email_sent={test_recipient}")
        print(f"test_report={source['slug']}")
        return 0

    state_path = state_dir / "delivery-state.json"
    state = _load_state(state_path, delivery_key, manifest)
    sent = 0
    skipped = 0
    with _smtp(env) as smtp:
        for row in plan:
            prior = state["reports"].get(row["slug"])
            if prior and prior.get("status") == "sent":
                if prior.get("attachmentSha256") != row["attachmentSha256"]:
                    raise RuntimeError(
                        f"Refusing to resend changed attachment for {row['slug']} under delivery key {delivery_key}"
                    )
                skipped += 1
                continue
            if prior and prior.get("status") == "sending":
                raise RuntimeError(
                    f"Delivery for {row['slug']} is marked sending; reconcile before retrying to prevent duplicates"
                )

            message_id = make_msgid(
                idstring=f"service-tech-{delivery_key}-{row['slug']}",
                domain=parseaddr(routing["from"])[1].split("@", 1)[1],
            )
            state["reports"][row["slug"]] = {
                "status": "sending",
                "startedAt": _utc_now(),
                "messageId": message_id,
                "attachmentSha256": row["attachmentSha256"],
                "to": row["to"],
                "cc": row["cc"],
            }
            _atomic_json(state_path, state)

            message = _message(row, routing["from"], manifest["cutoffDate"], message_id)
            smtp.send_message(message)
            state["reports"][row["slug"]].update(
                {"status": "sent", "sentAt": _utc_now()}
            )
            _atomic_json(state_path, state)
            sent += 1
            print(f"sent={row['slug']}")

    print(f"emails_sent={sent}")
    print(f"emails_skipped={skipped}")
    print(f"delivery_state={state_path}")
    return 0


def _validate_package(
    manifest: dict[str, Any], snapshot: dict[str, Any], pdf_dir: Path
) -> list[dict[str, Any]]:
    for key in ("periodFrom", "cutoffDate", "reports"):
        if key not in manifest:
            raise ValueError(f"Manifest is missing {key}")
    if manifest["cutoffDate"] != snapshot.get("cutoffDate"):
        raise ValueError("Manifest and snapshot cutoff dates do not match")
    if manifest.get("reportVersion") != snapshot.get("reportVersion"):
        raise ValueError("Manifest and snapshot report versions do not match")

    reports = manifest.get("reports")
    technicians = snapshot.get("technicians")
    if not isinstance(reports, list) or not isinstance(technicians, list):
        raise ValueError("Manifest reports and snapshot technicians must be arrays")
    if len(reports) != len(technicians) or not reports:
        raise ValueError("Manifest must contain exactly one report for each technician")

    report_slugs = {str(row.get("slug")) for row in reports}
    technician_slugs = {str(row.get("slug")) for row in technicians}
    if report_slugs != technician_slugs or len(report_slugs) != len(reports):
        raise ValueError("Manifest and snapshot technician rosters do not match")

    qa_path = pdf_dir / "qa-results.json"
    qa = _json(qa_path)
    if not isinstance(qa, list):
        raise ValueError("qa-results.json must contain an array")
    qa_by_slug = {str(row.get("slug")): row for row in qa}
    if set(qa_by_slug) != report_slugs:
        raise ValueError("QA roster does not match the delivery manifest")
    failed = [slug for slug, row in qa_by_slug.items() if row.get("ok") is not True]
    if failed:
        raise ValueError(f"Reports failed visual QA: {', '.join(sorted(failed))}")

    cutoff = str(manifest["cutoffDate"])
    for report in reports:
        for key in ("slug", "technician", "department", "email", "fileName"):
            if not report.get(key):
                raise ValueError(f"Report row is missing {key}: {report}")
        if cutoff not in str(report["fileName"]):
            raise ValueError(f"Attachment cutoff is missing from {report['fileName']}")
        pdf_path = pdf_dir / str(report["fileName"])
        if not pdf_path.is_file() or pdf_path.stat().st_size < 10_000:
            raise ValueError(f"Missing or unexpectedly small PDF: {pdf_path}")
        if pdf_path.read_bytes()[:5] != b"%PDF-":
            raise ValueError(f"Attachment is not a PDF: {pdf_path}")
    return reports


def _routing(env: dict[str, str]) -> dict[str, str]:
    return {
        "from": _email(_required(env, "EMAIL_FROM"), "EMAIL_FROM"),
        "tim": _email(_required(env, "TIM_EMAIL"), "TIM_EMAIL"),
        "hvac_manager": _email(
            _required(env, "TECH_REPORT_HVAC_MANAGER_EMAIL"),
            "TECH_REPORT_HVAC_MANAGER_EMAIL",
        ),
        "plumbing_manager": _email(
            _required(env, "TECH_REPORT_PLUMBING_MANAGER_EMAIL"),
            "TECH_REPORT_PLUMBING_MANAGER_EMAIL",
        ),
    }


def _message(
    row: dict[str, Any], sender: str, cutoff_date: str, message_id: str
) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = row["subject"]
    message["From"] = sender
    message["To"] = ", ".join(row["to"])
    message["Cc"] = ", ".join(row["cc"])
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = message_id
    first_name = str(row["technician"]).split()[0]
    cutoff_label = _date_label(cutoff_date)
    message.set_content(
        "\n".join(
            [
                f"Hi {first_name},",
                "",
                f"Attached is your IRBIS month-to-date coaching report through {cutoff_label}.",
                "It includes your current ServiceTitan results, job-execution metrics, Field Pro activity, and this week's coaching focus.",
                "",
                "Please review it before the weekly coaching meeting.",
                "",
                "IRBIS Performance Coaching",
            ]
        )
    )
    attachment = Path(str(row["attachment"]))
    message.add_attachment(
        attachment.read_bytes(),
        maintype="application",
        subtype="pdf",
        filename=attachment.name,
    )
    return message


def _subject(technician: str, cutoff_date: str) -> str:
    return f"{technician} - IRBIS MTD Coaching Report through {_date_label(cutoff_date)}"


def _date_label(value: str) -> str:
    return datetime.strptime(value, "%Y-%m-%d").strftime("%b %-d, %Y")


def _smtp(env: dict[str, str]) -> smtplib.SMTP:
    host = _required(env, "SMTP_HOST")
    port = int(_required(env, "SMTP_PORT"))
    smtp = smtplib.SMTP(host, port, timeout=30)
    smtp.ehlo()
    smtp.starttls(context=ssl.create_default_context())
    smtp.ehlo()
    smtp.login(_required(env, "SMTP_USER"), _required(env, "SMTP_PASS"))
    return smtp


def _smtp_preflight(env: dict[str, str], sender: str, recipients: list[str]) -> None:
    with _smtp(env) as smtp:
        code, response = smtp.mail(sender)
        if code >= 400:
            raise RuntimeError(f"SMTP rejected sender with code {code}: {response!r}")
        rejected = []
        for recipient in recipients:
            code, response = smtp.rcpt(recipient)
            if code >= 400:
                rejected.append(f"{recipient} ({code}: {response!r})")
        smtp.rset()
        if rejected:
            raise RuntimeError("SMTP rejected recipients: " + ", ".join(rejected))


def _load_state(
    path: Path, delivery_key: str, manifest: dict[str, Any]
) -> dict[str, Any]:
    if path.exists():
        state = _json(path)
        if state.get("deliveryKey") != delivery_key:
            raise ValueError("Existing delivery state belongs to a different delivery key")
        return state
    return {
        "schemaVersion": 1,
        "deliveryKey": delivery_key,
        "periodFrom": manifest["periodFrom"],
        "cutoffDate": manifest["cutoffDate"],
        "createdAt": _utc_now(),
        "reports": {},
    }


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


def _json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _atomic_json(path: Path, payload: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _required(env: dict[str, str], key: str) -> str:
    value = env.get(key, "").strip()
    if not value:
        raise ValueError(f"Missing required environment value: {key}")
    return value


def _email(value: str, label: str) -> str:
    address = parseaddr(value)[1].strip().lower()
    if not address or "@" not in address or address.startswith("@") or address.endswith("@"):
        raise ValueError(f"Invalid email for {label}")
    return address


def _unique_emails(values: Iterable[str], excluded: Optional[str] = None) -> list[str]:
    result = []
    seen = {excluded} if excluded else set()
    for value in values:
        address = _email(value, "recipient")
        if address not in seen:
            seen.add(address)
            result.append(address)
    return result


def _truthy(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


if __name__ == "__main__":
    raise SystemExit(main())
