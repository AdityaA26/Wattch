import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from components.forecast import build_forecast
from .server import Handler
from .storage import Store

class DemoServerTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  root=Path(self.tmp.name);dist=root/'dist';dist.mkdir();(dist/'index.html').write_text('<html>Wattch demo</html>');(root/'outside.txt').write_text('do not serve')
  self.store=Store(root/'db',database_url='')
  handler=type('TestDemoHandler',(Handler,),{'store':self.store,'frontend_root':dist})
  self.server=ThreadingHTTPServer(('127.0.0.1',0),handler);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.addCleanup(self.stop)
  self.base=f'http://127.0.0.1:{self.server.server_port}'
 def stop(self):self.server.shutdown();self.server.server_close();self.thread.join()
 def call(self,path,data=None,origin=None):
  headers={'Content-Type':'application/json'}
  if origin:headers['Origin']=origin
  req=urllib.request.Request(self.base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
  with urllib.request.urlopen(req) as r:return r.headers,r.read()
 def load(self,ident='home',origin=None):
  _,body=self.call('/api/household/dashboard',{'profile':{'householdId':ident},'monthlyElectricKwh':624,'initializeDemo':True},origin)
  return json.loads(body)
 def test_single_host_serves_html_and_accepts_its_own_api_origin(self):
  headers,body=self.call('/');self.assertIn('text/html',headers['Content-Type']);self.assertIn(b'Wattch demo',body)
  self.assertEqual(self.load(origin=self.base)['householdId'],'home')
 def test_static_traversal_cannot_read_outside_build(self):
  with self.assertRaises(urllib.error.HTTPError) as err:self.call('/%2e%2e/outside.txt')
  self.assertEqual(err.exception.code,404)
  self.assertNotIn(b'do not serve',err.exception.read())
 def test_unapproved_cross_origin_api_is_rejected(self):
  with self.assertRaises(urllib.error.HTTPError) as err:self.load(origin='https://unrelated.example')
  self.assertEqual(err.exception.code,403)
 def test_active_vacation_changes_plan_load_and_protects_reserve(self):
  self.load();forecast=build_forecast(demo=True,battery_capacity_kwh=13.5,solar_capacity_kw=5,base_load_kw=1)
  with patch('person4.planning.forecast_fetch',return_value=forecast):
   _,body=self.call('/api/household/plan',{'householdId':'home','awayUsagePct':45,'vacationReservePct':50})
  result=json.loads(body);self.assertAlmostEqual(result['modeledDailyKwh'],result['normalDailyKwh']*.45)
  self.assertGreaterEqual(result['plan']['metrics']['reservePct'],50)
  self.assertAlmostEqual(sum(r['loadKw'] for r in result['plan']['schedule']),result['modeledDailyKwh'])
 def test_plan_uses_validated_request_snapshot_without_rewriting_stored_settings(self):
  d=self.load();p=dict(d['profile'],essentialLoadKw=.8,backupGoalHours=4)
  forecast=build_forecast(demo=True,battery_capacity_kwh=13.5,solar_capacity_kw=5,base_load_kw=1)
  with patch('person4.planning.forecast_fetch',return_value=forecast):_,body=self.call('/api/household/plan',{'householdId':'home','profile':p})
  result=json.loads(body);self.assertEqual(result['plan']['config']['essentialLoadKw'],.8)
  self.assertEqual(self.store.get_profile('home')['essentialLoadKw'],.55)
 def test_chat_cannot_attach_another_homes_plan(self):
  self.load('a');self.load('b');forecast=build_forecast(demo=True,battery_capacity_kwh=13.5,solar_capacity_kw=5,base_load_kw=1)
  with patch('person4.planning.forecast_fetch',return_value=forecast):_,body=self.call('/api/household/plan',{'householdId':'a'})
  ident=json.loads(body)['plan']['planId']
  with self.assertRaises(urllib.error.HTTPError) as err:self.call('/api/household/chat',{'householdId':'b','planId':ident,'question':'How much do I save?'})
  self.assertEqual(err.exception.code,400)

if __name__=='__main__':unittest.main()
