import io
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'python'))
from marketing_os_agent.clients.http import HttpClient, _retry_delay
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from export_servicetitan_coaching_evidence import ReportHttpClient, _complete_pages, _review_evidence
import tempfile
import json

class ReviewSourceTests(unittest.TestCase):
    def test_verified_empty_reviews_are_zero_and_missing_exports_remain_unavailable(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            staff=[{"technician":"Person One"}]
            (root/"reviews.csv").write_text("TechnicianName,TotalReviews\n")
            (root/"review.csv").write_text("PublishDate,Review,TechnicianFullName\n")
            self.assertFalse(_review_evidence(root,staff)["personone"]["sourceAvailable"])
            for filename,fields in (("reviews.json",["TechnicianName","TotalReviews"]),("review.json",["PublishDate","Review","TechnicianFullName"])):
                (root/filename).write_text(json.dumps({"fields":[{"name":name} for name in fields],"data":[],"hasMore":False,"totalCount":0}))
            result=_review_evidence(root,staff)["personone"]
            self.assertTrue(result["sourceAvailable"])
            self.assertEqual(result["totalEvidenceReviews"],0)

class Response(io.BytesIO):
    status=200
    headers={}
class RateLimitTests(unittest.TestCase):
    def test_reporting_rate_limit_waits_then_retries_without_exposing_headers(self):
        error=urllib.error.HTTPError('https://example.invalid',429,'limit',{'Retry-After':'60'},io.BytesIO(b'{}'))
        with patch('urllib.request.urlopen',side_effect=[error,Response(b'{"data":[]}')]), patch('time.sleep') as sleep:
            result=HttpClient(retries=1).request_json('POST','https://example.invalid',headers={'Authorization':'private'})
        self.assertEqual(result.status,200)
        sleep.assert_called_once_with(65.0)
    def test_longer_provider_wait_is_respected(self):
        error=urllib.error.HTTPError('https://example.invalid',429,'limit',{'Retry-After':'120'},io.BytesIO(b'{}'))
        self.assertEqual(_retry_delay(error,'',0),121)

    def test_coaching_rate_limit_wait_happens_after_alarm_is_disabled(self):
        error=urllib.error.HTTPError('https://example.invalid',429,'limit',{'Retry-After':'60'},io.BytesIO(b'{}'))
        events=[]
        with patch('urllib.request.urlopen',side_effect=[error,Response(b'{"data":[]}')]), \
             patch('signal.setitimer',side_effect=lambda *args: events.append(('alarm',args[1]))), \
             patch('time.sleep',side_effect=lambda delay: events.append(('sleep',delay))):
            result=ReportHttpClient(retries=0).request_json('GET','https://example.invalid')
        self.assertEqual(result.status,200)
        self.assertEqual(events,[('alarm',35),('alarm',0),('sleep',65.0),('alarm',35),('alarm',0)])

    def test_coaching_repeated_source_failure_is_bounded(self):
        with patch('urllib.request.urlopen',side_effect=urllib.error.URLError('offline')) as request, \
             patch('signal.setitimer'), patch('time.sleep') as sleep:
            with self.assertRaises(RuntimeError):
                ReportHttpClient(retries=0).request_json('GET','https://example.invalid')
        self.assertEqual(request.call_count,3)
        self.assertEqual(sleep.call_count,2)

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'python/scripts'))
import servicetitan_weekly_performance_export as exporter
class PaginationTests(unittest.TestCase):
    def test_forms_zero_count_placeholder_is_replaced_by_an_explicit_count_request(self):
        from unittest.mock import Mock
        rows=[{"id":1},{"id":2}]
        client=Mock(_get=Mock(side_effect=lambda path,params: {"data":rows,"hasMore":False,"totalCount":2 if params.get("includeTotal")=="true" else 0}))
        self.assertEqual(_complete_pages(client,"/forms",{"includeTotal":"false"}),rows)

    def test_coaching_rejects_missing_pages_and_repeated_records(self):
        from unittest.mock import Mock
        for pages in (
            [{"data":[{"id":1}],"hasMore":False,"totalCount":2}],
            [{"data":[],"hasMore":True}],
            [{"data":[{"id":1}],"hasMore":True},{"data":[{"id":1}],"hasMore":False}],
            [{"data":[None],"hasMore":False}],
            [{"data":[]}],
        ):
            with self.assertRaisesRegex(ValueError,"Incomplete"):
                _complete_pages(Mock(_get=Mock(side_effect=pages)),"/test",{})

    def test_coaching_pagination_cap_fails_and_complete_collection_succeeds(self):
        from unittest.mock import Mock
        pages=[{"data":[{"id":1}],"hasMore":True,"totalCount":2},{"data":[{"id":2}],"hasMore":False,"totalCount":2}]
        self.assertEqual(_complete_pages(Mock(_get=Mock(side_effect=pages)),"/test",{}),[{"id":1},{"id":2}])
        with self.assertRaisesRegex(ValueError,"pagination limit"):
            _complete_pages(Mock(_get=Mock(side_effect=pages)),"/test",{},max_pages=1)

    def test_rejects_partial_or_malformed_source(self):
        for payload in ({"fields":[],"data":[],"hasMore":False,"totalCount":1}, {"fields":[],"data":[]}, {"fields":[],"data":[{}],"hasMore":False}):
            with patch.object(exporter,"_api_request",return_value=payload):
                with self.assertRaisesRegex(RuntimeError,"Incomplete"):
                    exporter.fetch_report_data(type("Client",(),{"_tenant_path":lambda *a:"/test"})(),exporter.REPORTS[0],{})
    def test_collects_complete_pages(self):
        pages=[{"fields":[{"name":"id"}],"data":[[1]],"hasMore":True,"totalCount":2},{"fields":[{"name":"id"}],"data":[[2]],"hasMore":False,"totalCount":2}]
        with patch.object(exporter,"_api_request",side_effect=pages):
            result=exporter.fetch_report_data(type("Client",(),{"_tenant_path":lambda *a:"/test"})(),exporter.REPORTS[0],{})
        self.assertEqual(result["data"],[[1],[2]])

if __name__=='__main__': unittest.main()
