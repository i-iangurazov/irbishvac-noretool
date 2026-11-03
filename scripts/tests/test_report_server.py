import sys
from pathlib import Path
from datetime import datetime, timezone
import unittest
import tempfile
import json
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from report_server import phase, tick, audit_missed_cycles

class SchedulerTests(unittest.TestCase):
    def at(self, value, state=None, cycle="technician"):
        return phase(datetime.fromisoformat(value + "+06:00"), cycle, state or {})
    def test_cycles_and_windows(self):
        self.assertEqual(self.at("2026-11-05T17:59:00"), "idle")
        self.assertEqual(self.at("2026-11-05T18:00:00"), "prepare")
        self.assertEqual(self.at("2026-11-06T18:00:00"), "idle")
        self.assertEqual(self.at("2026-11-06T18:00:00", cycle="advisor"), "prepare")
    def test_never_sends_unprepared_or_late(self):
        self.assertEqual(self.at("2026-11-05T19:40:00"), "idle")
        self.assertEqual(self.at("2026-11-05T19:35:00", {"status":"ready"}), "send")
        self.assertEqual(self.at("2026-11-05T19:45:00", {"status":"ready"}), "missed_deadline")
    def test_completed_or_empty_cycle_is_terminal(self):
        for status in ("sent", "skipped_no_active_staff", "missed_deadline"):
            self.assertEqual(self.at("2026-11-05T19:40:00", {"status":status}), "idle")
    def test_no_regeneration_after_smtp_started(self):
        self.assertEqual(self.at("2026-11-05T18:30:00", {"smtpStarted":True}), "idle")
        self.assertEqual(self.at("2026-11-05T19:40:00", {"smtpStarted":True}), "send")

    def test_disabled_delivery_does_not_start_smtp(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            package = root / "service-tech-report-delivery/2026-11-05"
            package.mkdir(parents=True)
            (package / "preparation-state.json").write_text(json.dumps({"status":"ready","dataWindowComplete":True}))
            with patch("report_server.run_logged") as run:
                tick(root, root, {"PERFORMANCE_REPORT_AUTO_SEND":"false"}, datetime.fromisoformat("2026-11-05T19:35:00+06:00"))
            run.assert_not_called()
            state=json.loads((root / "scheduler/2026-11-05-technician.json").read_text())
            self.assertFalse(state["autoSendEnabled"])
    def test_detects_a_cycle_missed_while_server_was_down_once(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "scheduler").mkdir()
            (root / "scheduler/activation.json").write_text(json.dumps({"localDate":"2026-11-03"}))
            with patch("report_server.alert") as notify:
                now=datetime.fromisoformat("2026-11-06T18:00:00+06:00")
                audit_missed_cycles(root, {}, now)
                audit_missed_cycles(root, {}, now)
            notify.assert_called_once()
            self.assertEqual(json.loads((root / "scheduler/2026-11-05-technician.json").read_text())["status"],"missed_deadline")

if __name__ == "__main__": unittest.main()
