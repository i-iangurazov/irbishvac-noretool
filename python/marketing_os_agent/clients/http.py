from __future__ import annotations

import json
import logging
import time
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


logger = logging.getLogger(__name__)
DEFAULT_USER_AGENT = "marketing-os-agent/1.0"


def _retry_delay(error: urllib.error.HTTPError, raw: str, attempt: int) -> float:
    if error.code != 429:
        return 0.5 * (2 ** attempt)
    value = error.headers.get("Retry-After", "") if error.headers else ""
    try:
        requested = float(value)
    except (TypeError, ValueError):
        try:
            requested = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError, OverflowError):
            match = re.search(r"try again in (\d+) seconds", raw, re.I)
            requested = float(match.group(1)) if match else 60
    # Reporting APIs limit repeated requests for one report to once per minute.
    # Preserve a longer explicit provider delay and avoid rapid retry loops.
    return max(65.0, requested + 1.0)


@dataclass
class HttpResponse:
    status: int
    data: dict[str, Any]
    headers: dict[str, str]


class HttpClient:
    def __init__(self, timeout_seconds: int = 20, retries: int = 2) -> None:
        self.timeout_seconds = timeout_seconds
        self.retries = retries

    def request_json(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> HttpResponse:
        payload = None if body is None else json.dumps(body).encode("utf-8")
        request_headers = {"Content-Type": "application/json", "User-Agent": DEFAULT_USER_AGENT, **(headers or {})}
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            delay = 0.5 * (2 ** attempt)
            try:
                req = urllib.request.Request(url, data=payload, headers=request_headers, method=method.upper())
                with urllib.request.urlopen(req, timeout=self.timeout_seconds) as response:
                    raw = response.read().decode("utf-8")
                    data = json.loads(raw) if raw else {}
                    return HttpResponse(status=response.status, data=data, headers=dict(response.headers.items()))
            except urllib.error.HTTPError as exc:
                raw = exc.read().decode("utf-8", errors="replace")
                last_error = exc
                try:
                    data = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    data = {"error": raw}
                if 400 <= exc.code < 500 and exc.code != 429:
                    logger.warning("http_client_error", extra={"url": url, "status": exc.code, "body": data})
                    return HttpResponse(status=exc.code, data=data, headers=dict(exc.headers.items()))
                delay = _retry_delay(exc, raw, attempt)
                logger.warning("http_retryable_error status=%s attempt=%s retry_seconds=%s", exc.code, attempt, delay)
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
                logger.warning("http_network_error", extra={"url": url, "attempt": attempt, "error": str(exc)})
            if attempt < self.retries:
                time.sleep(delay)
        raise RuntimeError(f"HTTP request failed after retries: {url}") from last_error

    def request_form(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        body: dict[str, str] | None = None,
    ) -> HttpResponse:
        payload = None if body is None else urllib.parse.urlencode(body).encode("utf-8")
        request_headers = {"Content-Type": "application/x-www-form-urlencoded", "User-Agent": DEFAULT_USER_AGENT, **(headers or {})}
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            delay = 0.5 * (2 ** attempt)
            try:
                req = urllib.request.Request(url, data=payload, headers=request_headers, method=method.upper())
                with urllib.request.urlopen(req, timeout=self.timeout_seconds) as response:
                    raw = response.read().decode("utf-8")
                    data = json.loads(raw) if raw else {}
                    return HttpResponse(status=response.status, data=data, headers=dict(response.headers.items()))
            except urllib.error.HTTPError as exc:
                raw = exc.read().decode("utf-8", errors="replace")
                last_error = exc
                try:
                    data = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    data = {"error": raw}
                if 400 <= exc.code < 500 and exc.code != 429:
                    logger.warning("http_client_error", extra={"url": url, "status": exc.code, "body": data})
                    return HttpResponse(status=exc.code, data=data, headers=dict(exc.headers.items()))
                delay = _retry_delay(exc, raw, attempt)
                logger.warning("http_retryable_error status=%s attempt=%s retry_seconds=%s", exc.code, attempt, delay)
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
                logger.warning("http_network_error", extra={"url": url, "attempt": attempt, "error": str(exc)})
            if attempt < self.retries:
                time.sleep(delay)
        raise RuntimeError(f"HTTP request failed after retries: {url}") from last_error
