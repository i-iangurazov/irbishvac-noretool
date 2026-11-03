import sys
import unittest
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import run_service_tech_thursday_delivery as tech
import run_advisor_friday_delivery as advisor

class DashboardOnlyTests(unittest.TestCase):
    def test_both_cycles_publish_current_pacific_day_without_pdf_or_email(self):
        # The Pacific date is still November 3 even though Bishkek has crossed midnight.
        now = datetime.fromisoformat("2026-11-04T02:00:00+06:00")
        for module in (tech, advisor):
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as folder:
                root=Path(folder)
                source=root/"2026-11-04/source/servicetitan-mtd-through-2026-11-03"
                source.mkdir(parents=True)
                for filename in ("review.csv","reviews.csv","review.json","reviews.json"):
                    (source/filename).write_text("{}")
                with patch.object(module,"prepare_personnel",return_value=root/"roster.json"), patch.object(module,"_run") as run, patch.object(module,"_render_and_qa") as render:
                    module._run_cycle(repo=root,marketing_repo=root,marketing_env=root/"env",root_env=root/"env",env={},now=now,output_root=root,mode="dashboard",reuse_source_exports=False)
                render.assert_not_called()
                commands=[call.args[0] for call in run.call_args_list]
                publish=[command for command in commands if "scripts/publish-coaching-snapshot.ts" in command]
                self.assertEqual(len(publish),1)
                self.assertFalse(any(any("send_service_tech_reports" in arg or "deliver_prepared" in arg for arg in command) for command in commands))
                canonical=next(command for command in commands if "scripts/build-canonical-performance.ts" in command)
                self.assertEqual(canonical[canonical.index("--cutoff-date")+1],"2026-11-03")
                self.assertIn("--use-current",canonical)

if __name__=="__main__":unittest.main()
