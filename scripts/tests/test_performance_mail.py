import base64
import io
import json
import sys
import tempfile
import unittest
import urllib.error
from email.message import EmailMessage
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from performance_mail import MailDeliveryUncertain, ResendMailer
import send_service_tech_reports as sender
import report_server
import verify_performance_mail as connection


class Response(io.BytesIO):
    status = 200


def message():
    result = EmailMessage()
    result["From"] = "reports@example.com"
    result["To"] = "one@example.com, two@example.com"
    result["Cc"] = "manager@example.com"
    result["Subject"] = "Coaching report"
    result["Message-ID"] = "<durable-message@example.com>"
    result.set_content("Private coaching content\n")
    result.add_attachment(b"%PDF-example", maintype="application", subtype="pdf", filename="coaching.pdf")
    return result


class HttpsMailTests(unittest.TestCase):
    def setUp(self):
        self.opener = Mock()
        self.factory = patch("urllib.request.build_opener", return_value=self.opener)
        self.factory.start()
        self.addCleanup(self.factory.stop)
        self.env = {"RESEND_API_KEY": "private-test-key", "PERFORMANCE_REPORT_MAIL_TRANSPORT": "resend"}

    def test_pdf_recipients_and_receipt_survive_https_conversion(self):
        self.opener.open.return_value = Response(b'{"id":"accepted-id"}')
        mailer = ResendMailer(self.env)
        self.assertEqual(mailer.send_message(message()), {})
        request = self.opener.open.call_args.args[0]
        payload = json.loads(request.data)
        self.assertEqual(request.full_url, "https://api.resend.com/emails")
        self.assertEqual(payload["to"], ["one@example.com", "two@example.com"])
        self.assertEqual(payload["cc"], ["manager@example.com"])
        self.assertEqual(base64.b64decode(payload["attachments"][0]["content"]), b"%PDF-example")
        self.assertEqual(payload["headers"]["Message-ID"], "<durable-message@example.com>")
        self.assertEqual(mailer.last_receipt["providerMessageId"], "accepted-id")

    def test_retry_is_identical_and_does_not_claim_success_from_invalid_response(self):
        error = urllib.error.HTTPError("https://api.resend.com/emails", 429, "limit", {"Retry-After": "1"}, None)
        self.opener.open.side_effect = [error, Response(b'{"id":"accepted-id"}')]
        with patch("time.sleep"):
            ResendMailer(self.env).send_message(message())
        requests = [call.args[0] for call in self.opener.open.call_args_list]
        self.assertEqual(requests[0].data, requests[1].data)
        self.assertEqual(requests[0].get_header("Idempotency-key"), requests[1].get_header("Idempotency-key"))
        self.opener.open.side_effect = None
        self.opener.open.return_value = Response(b'{}')
        with self.assertRaises(MailDeliveryUncertain):
            ResendMailer(self.env).send_message(message())

    def test_deadline_is_rechecked_before_an_https_retry(self):
        self.opener.open.side_effect = urllib.error.URLError("temporary outage")
        guard = Mock(side_effect=[None, ValueError("Delivery deadline passed")])
        with patch("time.sleep"), self.assertRaisesRegex(ValueError, "deadline"):
            ResendMailer(self.env, before_attempt=guard).send_message(message())
        self.assertEqual(self.opener.open.call_count, 1)

    def test_https_timeout_cannot_extend_the_remaining_send_window(self):
        self.opener.open.return_value=Response(b'{"id":"accepted-id"}')
        ResendMailer(self.env,before_attempt=lambda:0.25).send_message(message())
        self.assertEqual(self.opener.open.call_args.kwargs["timeout"],0.25)

    def test_provider_error_does_not_expose_credentials_or_raw_response(self):
        self.opener.open.side_effect = urllib.error.HTTPError("https://api.resend.com/emails", 401, "private-test-key", {}, io.BytesIO(b'private content'))
        with self.assertRaises(MailDeliveryUncertain) as result:
            ResendMailer(self.env).send_message(message())
        self.assertNotIn("private", str(result.exception))
        self.assertEqual(self.opener.open.call_count, 1)

    def test_https_preflight_sends_nothing_and_never_uses_smtp(self):
        with patch.object(sender, "_smtp") as smtp:
            sender._mail_preflight(self.env, "reports@example.com", ["one@example.com"])
            self.opener.open.assert_not_called()
            smtp.assert_not_called()
            with self.assertRaisesRegex(ValueError, "RESEND_API_KEY"):
                sender._mail_preflight({"PERFORMANCE_REPORT_MAIL_TRANSPORT": "resend"}, "reports@example.com", ["one@example.com"])
            with self.assertRaisesRegex(ValueError, "Unsupported"):
                sender._mailer({"PERFORMANCE_REPORT_MAIL_TRANSPORT": "unknown"})
            smtp.assert_not_called()

    def test_owner_alert_retry_uses_same_payload_and_stops_after_confirmation(self):
        env={**self.env,"EMAIL_FROM":"reports@example.com","PERFORMANCE_REPORT_ALERT_EMAIL":"owner@example.com"}
        state={}
        self.opener.open.side_effect=urllib.error.URLError("connection lost")
        with patch("time.sleep"):
            report_server.alert(env,state,"source-unavailable","The source is unavailable.")
        self.assertIn("pendingAlert",state)
        self.assertNotIn("alertedKey",state)
        first=self.opener.open.call_args.args[0]
        self.opener.open.side_effect=None
        self.opener.open.return_value=Response(b'{"id":"owner-confirmation"}')
        report_server.alert(env,state,"source-unavailable","The source is unavailable.")
        last=self.opener.open.call_args.args[0]
        self.assertEqual(first.data,last.data)
        self.assertEqual(first.get_header("Idempotency-key"),last.get_header("Idempotency-key"))
        self.assertEqual(json.loads(last.data)["to"],["owner@example.com"])
        self.assertNotIn("pendingAlert",state)
        self.assertEqual(state["alertReceipt"]["providerMessageId"],"owner-confirmation")
        calls=self.opener.open.call_count
        report_server.alert(env,state,"source-unavailable","The source is unavailable.")
        self.assertEqual(self.opener.open.call_count,calls)

    def test_explicit_connection_test_only_sends_to_owner_once_without_attachments(self):
        with tempfile.TemporaryDirectory() as folder:
            env={**self.env,"EMAIL_FROM":"reports@example.com","PERFORMANCE_REPORT_ALERT_EMAIL":"owner@example.com"}
            self.opener.open.return_value=Response(b'{"id":"connection-confirmation"}')
            args=["verify_performance_mail.py","--state-dir",folder,"--send-owner-test"]
            with patch.object(sys,"argv",args),patch.object(connection,"_load_environment",return_value=env):
                connection.main()
                connection.main()
            self.assertEqual(self.opener.open.call_count,1)
            payload=json.loads(self.opener.open.call_args.args[0].data)
            self.assertEqual(payload["to"],["owner@example.com"])
            self.assertNotIn("attachments",payload)
            self.assertEqual(json.loads((Path(folder)/"connection-test.json").read_text())["status"],"accepted")

    def test_connection_configuration_check_cannot_send(self):
        with tempfile.TemporaryDirectory() as folder:
            env={**self.env,"EMAIL_FROM":"reports@example.com"}
            with patch.object(sys,"argv",["verify_performance_mail.py","--state-dir",folder]),patch.object(connection,"_load_environment",return_value=env):
                connection.main()
            self.opener.open.assert_not_called()
            self.assertFalse((Path(folder)/"connection-test.json").exists())


class DurableDeliveryTests(unittest.TestCase):
    def setup_package(self, root):
        pdf = root / "hvac-tech-mtd-through-2026-11-04.pdf"
        pdf.write_bytes(b"%PDF-1.7\n" + b"0" * 10000)
        person = {"slug":"tech", "technician":"Example Technician", "department":"HVAC Service", "email":"one@example.com"}
        manifest = {"periodFrom":"2026-11-01", "cutoffDate":"2026-11-04", "reportVersion":"V7", "reports":[{**person,"fileName":pdf.name}]}
        snapshot = {**manifest,"canonicalSource":True,"sourceKind":"technician","technicians":[person]}
        for name, data in (("manifest.json",manifest),("snapshot.json",snapshot),("qa-results.json",[{"slug":"tech","ok":True}])):
            (root/name).write_text(json.dumps(data))
        return ["send_service_tech_reports.py","--manifest",str(root/"manifest.json"),"--snapshot",str(root/"snapshot.json"),"--pdf-dir",str(root),"--state-dir",str(root),"--mode","send","--combined-hvac-pdf",str(pdf)]

    def run_sender(self, root, opener, fail=False):
        args = self.setup_package(root)
        env={"PERFORMANCE_REPORT_MAIL_TRANSPORT":"resend","RESEND_API_KEY":"private-test-key","TECH_REPORTS_ENABLED":"true", "EMAIL_FROM":"reports@example.com", "TIM_EMAIL":"tim@example.com", "VADIM_EMAIL":"vadim@example.com", "TECH_REPORT_HVAC_MANAGER_EMAIL":"manager@example.com", "TECH_REPORT_PLUMBING_MANAGER_EMAIL":"plumbing@example.com"}
        with patch.object(sys,"argv",args), patch.object(sender,"_load_environment",return_value=env), patch.object(sender,"assert_send_ready"), patch.object(sender,"verify_live_personnel"), patch("urllib.request.build_opener",return_value=opener), patch("time.sleep"):
            if fail:
                with self.assertRaises(MailDeliveryUncertain):
                    sender.main()
            else:
                sender.main()

    def test_repeated_run_does_not_resend_confirmed_messages_after_provider_key_expiry(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            opener=Mock()
            opener.open.side_effect=lambda *_args,**_kwargs: Response(b'{"id":"provider-confirmation"}')
            self.run_sender(root,opener)
            self.assertEqual(opener.open.call_count,2)
            # Persistent state, rather than the provider's 24h key window, owns replay protection.
            self.run_sender(root,opener)
            self.assertEqual(opener.open.call_count,2)
            states=json.loads((root/"delivery-state.json").read_text())["reports"]
            self.assertTrue(all(row["status"]=="sent" and row["providerMessageId"]=="provider-confirmation" for row in states.values()))

    def test_unknown_delivery_remains_reserved_and_never_replays(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            opener=Mock()
            opener.open.side_effect=urllib.error.URLError("connection lost")
            self.run_sender(root,opener,fail=True)
            self.assertEqual(opener.open.call_count,3)
            self.assertEqual(json.loads((root/"delivery-state.json").read_text())["reports"]["tech"]["status"],"sending")
            with self.assertRaisesRegex(RuntimeError,"reconcile before retrying"):
                self.run_sender(root,opener)
            self.assertEqual(opener.open.call_count,3)


if __name__ == "__main__": unittest.main()
