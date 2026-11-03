import io
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'python'))
from marketing_os_agent.clients.http import HttpClient, _retry_delay
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

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'python/scripts'))
import servicetitan_weekly_performance_export as exporter
class PaginationTests(unittest.TestCase):
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
