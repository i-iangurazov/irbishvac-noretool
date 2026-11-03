"""Check mail configuration, or explicitly send one attachment-free owner test."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import make_msgid
from pathlib import Path
from performance_mail import transport_name
from send_service_tech_reports import _atomic_json, _email, _load_environment, _mail_preflight, _mailer


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--send-owner-test", action="store_true")
    parser.add_argument("--state-dir", required=True)
    parser.add_argument("--env-file", action="append", default=[])
    args = parser.parse_args()
    env = _load_environment([Path(p) for p in args.env_file])
    sender = _email(env.get("EMAIL_FROM", ""), "sender")
    owner = _email(env.get("PERFORMANCE_REPORT_ALERT_EMAIL", "it@irbishvac.com"), "owner")
    _mail_preflight(env, sender, [owner])
    if not args.send_owner_test:
        print("connection_test_sent=false; provider delivery remains unverified")
        return 0
    root = Path(args.state_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".connection-test.lock").open("a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        path = root / "connection-test.json"
        if path.exists():
            state = json.loads(path.read_text())
            if state.get("status") == "accepted" and (state.get("sender"), state.get("owner"), state.get("provider")) == (sender, owner, transport_name(env)):
                print("connection_test_noop=already accepted; confirm receipt in the owner's inbox")
                return 0
            raise RuntimeError("Existing connection test requires reconciliation; no automatic replay")
        message = EmailMessage()
        message["From"], message["To"] = sender, owner
        message["Subject"] = "IRBIS server reporting mail connection test"
        message["Message-ID"] = make_msgid(domain=sender.split("@")[1])
        key = hashlib.sha256(str(message["Message-ID"]).encode()).hexdigest()
        message["X-IRBIS-Delivery-Key"] = key
        message.set_content("This confirms the server mail connection is being tested. No employee reports or attachments are included.\n")
        state = {"status":"sending", "sender":sender, "owner":owner, "provider":transport_name(env),
                 "messageId":str(message["Message-ID"]), "idempotencyKey":key, "startedAt":datetime.now(timezone.utc).isoformat()}
        _atomic_json(path, state)
        with _mailer(env) as mailer:
            if mailer.send_message(message):
                raise RuntimeError("Connection test was rejected; reconcile recorded state")
            receipt = getattr(mailer, "last_receipt", None)
            if isinstance(receipt, dict):
                state.update(receipt)
        state.update(status="accepted", acceptedAt=datetime.now(timezone.utc).isoformat())
        _atomic_json(path, state)
        print("connection_test_accepted=true; confirm receipt in the owner's inbox before enabling staff delivery")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
