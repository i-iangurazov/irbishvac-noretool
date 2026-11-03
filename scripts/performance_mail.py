"""HTTPS mail transport. No accounts, domains or credentials are created here."""
from __future__ import annotations

import base64
import hashlib
import json
import time
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import getaddresses
from typing import Callable


class MailDeliveryUncertain(RuntimeError):
    """The caller must retain its durable 'sending' record for reconciliation."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


class ResendMailer:
    provider = "resend"

    def __init__(self, env: dict[str, str], before_attempt: Callable[[], float | None] | None = None):
        self.key = env.get("RESEND_API_KEY", "").strip()
        if not self.key:
            raise ValueError("RESEND_API_KEY is required for HTTPS mail")
        self.before_attempt = before_attempt
        self.last_receipt: dict | None = None
        self.opener = urllib.request.build_opener(_NoRedirect())

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def send_message(self, message: EmailMessage) -> dict:
        sender = str(message["From"] or "").strip()
        recipients = [address for _, address in getaddresses(message.get_all("To", []))]
        if not sender or not recipients or not message.get("Message-ID"):
            raise ValueError("HTTPS mail requires sender, recipients and a recorded Message-ID")
        body = message.get_body(preferencelist=("plain",))
        if body is None:
            raise ValueError("HTTPS mail requires a plain-text body")
        payload = {
            "from": sender, "to": recipients, "subject": str(message["Subject"] or ""),
            "text": body.get_content(), "headers": {"Message-ID": str(message["Message-ID"])},
        }
        cc = [address for _, address in getaddresses(message.get_all("Cc", []))]
        if cc:
            payload["cc"] = cc
        attachments = []
        for part in message.iter_attachments():
            content = part.get_payload(decode=True)
            filename = part.get_filename()
            if not isinstance(content, bytes) or not filename:
                raise ValueError("Invalid HTTPS mail attachment")
            attachments.append({"filename": filename, "content": base64.b64encode(content).decode("ascii")})
        if attachments:
            payload["attachments"] = attachments
        # Freeze bytes once. Every retry uses the same payload and idempotency key.
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > 40_000_000:
            raise ValueError("HTTPS email exceeds the provider's 40 MB limit")
        key = str(message.get("X-IRBIS-Delivery-Key") or hashlib.sha256(str(message["Message-ID"]).encode()).hexdigest())
        for attempt in range(3):
            remaining = self.before_attempt() if self.before_attempt else None
            timeout = min(30.0, remaining) if isinstance(remaining, (int, float)) else 30.0
            if timeout <= 0:
                raise MailDeliveryUncertain("Delivery deadline passed before HTTPS request")
            request = urllib.request.Request("https://api.resend.com/emails", data=encoded, method="POST", headers={
                "Authorization": "Bearer " + self.key, "Content-Type": "application/json",
                "Idempotency-Key": key, "User-Agent": "irbis-performance-reports/1.0",
            })
            try:
                with self.opener.open(request, timeout=timeout) as response:
                    result = json.loads(response.read().decode("utf-8"))
                    if response.status < 200 or response.status >= 300 or not isinstance(result, dict) or not isinstance(result.get("id"), str) or not result["id"]:
                        raise MailDeliveryUncertain("HTTPS provider did not return a confirmed message ID")
                    self.last_receipt = {"provider": self.provider, "providerMessageId": result["id"], "idempotencyKey": key}
                    return {}
            except urllib.error.HTTPError as error:
                if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                    raise MailDeliveryUncertain(f"HTTPS mail not confirmed (HTTP {error.code}); reconcile recorded delivery key") from None
                try:
                    delay = max(1.0, float(error.headers.get("Retry-After", "1")))
                except (TypeError, ValueError):
                    delay = 2.0 ** attempt
                # A long provider outage must not hold the scheduled send window open.
                if delay > 30:
                    raise MailDeliveryUncertain("HTTPS provider requested a long retry delay; delivery requires reconciliation") from None
            except (urllib.error.URLError, TimeoutError):
                if attempt == 2:
                    raise MailDeliveryUncertain("HTTPS mail outcome unknown; reconcile recorded delivery key") from None
                delay = 2.0 ** attempt
            except (json.JSONDecodeError, UnicodeError):
                raise MailDeliveryUncertain("HTTPS mail response was invalid; reconcile recorded delivery key") from None
            time.sleep(delay)
        raise MailDeliveryUncertain("HTTPS mail retries exhausted")


def transport_name(env: dict[str, str]) -> str:
    value = env.get("PERFORMANCE_REPORT_MAIL_TRANSPORT", "smtp").strip().lower()
    if value not in {"smtp", "resend"}:
        raise ValueError("Unsupported PERFORMANCE_REPORT_MAIL_TRANSPORT; no fallback will be used")
    return value
