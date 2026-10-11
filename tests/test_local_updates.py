import unittest
from unittest.mock import patch
from io import BytesIO
from components import local_updates

RSS=b'''<?xml version="1.0"?><rss version="2.0"><channel><item><title>Columbia Water update</title><link>https://columbiascwater.net/real-post/</link><pubDate>Sat, 10 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>'''

class MockResponse:
    def __enter__(self): return self
    def __exit__(self,*args): return False
    def read(self,n): return RSS

class WaterNewsTests(unittest.TestCase):
    def setUp(self):
        local_updates._CACHE['expires_at']=0
        local_updates._CACHE['payload']=None

    @patch('components.local_updates.urlopen',return_value=MockResponse())
    def test_parses_real_source_urls(self,api):
        result=local_updates.get_water_updates(force=True)
        self.assertEqual(result['status'],'live')
        self.assertEqual(len(result['posts']),1)
        self.assertEqual(result['posts'][0]['title'],'Columbia Water update')
        self.assertIn('address-specific',result['notice'])

    @patch('components.local_updates.urlopen',side_effect=OSError('offline'))
    def test_failure_does_not_claim_all_clear(self,api):
        result=local_updates.get_water_updates(force=True)
        self.assertEqual(result['status'],'unavailable')
        self.assertEqual(result['posts'],[])

if __name__=='__main__':unittest.main()
