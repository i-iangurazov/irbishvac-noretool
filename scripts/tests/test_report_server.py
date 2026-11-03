import sys
from pathlib import Path
from datetime import datetime, timezone
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from report_server import phase

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
        self.assertEqual(self.at("2026-11-05T19:40:00", {"status":"ready"}), "send")
        self.assertEqual(self.at("2026-11-05T19:45:00", {"status":"ready"}), "missed_deadline")
    def test_completed_or_empty_cycle_is_terminal(self):
        for status in ("sent", "skipped_no_active_staff", "missed_deadline"):
            self.assertEqual(self.at("2026-11-05T19:40:00", {"status":status}), "idle")
    def test_no_regeneration_after_smtp_started(self):
        self.assertEqual(self.at("2026-11-05T18:30:00", {"smtpStarted":True}), "idle")
        self.assertEqual(self.at("2026-11-05T19:40:00", {"smtpStarted":True}), "send")

if __name__ == "__main__": unittest.main()
