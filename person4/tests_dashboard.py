import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch, Mock
import urllib.error
from components.forecast import build_forecast
from .storage import Store
from .history import profile
from .dashboard import dashboard, billing
from .planning import plan_from_forecast, household_plan
from . import household_ai


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'test.db', database_url='')
        self.p = profile({'householdId': 'selected-home', 'occupants': 3, 'floorAreaSqft': 2100})
    def tearDown(self):
        self.tmp.cleanup()
    def load(self, p=None, monthly=624):
        return dashboard(self.store, {'profile': p or self.p, 'monthlyElectricKwh': monthly, 'initializeDemo': True})
    def test_dashboard_report_and_bills_share_exact_readings(self):
        d = self.load()
        self.assertEqual(len(d['readings']), 558)
        for b in d['billing']:
            window = [r for r in d['readings'] if r['utility'] == b['utility'] and b['startDate'] <= r['date'] <= b['endDate']]
            self.assertEqual(len(window), 30)
            self.assertAlmostEqual(b['quantity'], sum(r['quantity'] for r in window))
            self.assertAlmostEqual(b['variableCostUsd'], sum(r['quantity'] * r['unitRateUsd'] for r in window))
        self.assertEqual(d['report']['householdId'], d['householdId'])
    def test_profile_refresh_preserves_history_and_observed_import(self):
        d = self.load()
        row = dict(d['readings'][0], quantity=123, source='observed', unit={'electricity':'kWh','water':'gal','gas':'therms'}[d['readings'][0]['utility']])
        self.store.import_readings(self.p['householdId'], [row])
        changed = self.load(dict(self.p, occupants=5), monthly=1200)
        self.assertEqual(len(changed['readings']), 558)
        actual = next(r for r in changed['readings'] if r['date'] == row['date'] and r['utility'] == row['utility'])
        self.assertEqual(actual['quantity'], 123)
        self.assertEqual(actual['source'], 'observed')
    def test_homes_are_isolated(self):
        a = self.load()
        b = self.load(dict(self.p, householdId='other-home'), monthly=312)
        self.assertAlmostEqual(b['billing'][0]['quantity'], a['billing'][0]['quantity'] / 2, places=2)
        self.assertNotEqual(a['householdId'], b['householdId'])
    def test_partial_history_never_becomes_a_complete_bill(self):
        self.store.save_profile(self.p)
        self.store.import_readings(self.p['householdId'], [{'date':date.today().isoformat(),'utility':'water','unit':'gal','quantity':5,'unitRateUsd':.006,'source':'observed'}])
        d = self.load()
        b = next(b for b in d['billing'] if b['utility'] == 'water')
        self.assertEqual(b['daysAvailable'], 1)
        self.assertIsNone(b['totalCostUsd'])
        self.assertEqual(len(d['readings']), 1)


class PlanningTests(unittest.TestCase):
    def setUp(self):
        self.p = profile({'householdId':'home','batteryCapacityKwh':13.5,'startingSocPct':55,'reservePct':30,'maxBatteryPowerKw':5})
        self.forecast = build_forecast(demo=True, battery_capacity_kwh=13.5, solar_capacity_kw=5, base_load_kw=1)
    def test_many_plans_obey_reserve_end_energy_and_peak_cap(self):
        for soc in (0,30,55,100):
            for reserve in (0,30,50,100):
                for daily in (0,8,24,100):
                    p = dict(self.p, startingSocPct=soc, reservePct=reserve)
                    result = plan_from_forecast(p,self.forecast,daily)
                    plan=result['plan']  # evaluate already validates every hour's physical balances
                    self.assertAlmostEqual(sum(r['loadKw'] for r in plan['schedule']),daily)
                    self.assertAlmostEqual(plan['baseline'][-1]['storedKwh'],plan['schedule'][-1]['storedKwh'])
                    self.assertGreaterEqual(plan['metrics']['savingsVsBaselineUsd'],-1e-8)
                    self.assertLessEqual(plan['gridImpact']['plannedPeakKw'],plan['gridImpact']['baselinePeakKw']+1e-8)
    def test_default_profitable_plan_trims_actual_full_day_peak(self):
        p=plan_from_forecast(self.p,self.forecast,30)['plan']
        self.assertLess(p['gridImpact']['plannedPeakKw'],p['gridImpact']['baselinePeakKw'])
        self.assertGreater(p['metrics']['savingsVsBaselineUsd'],0)
    def test_flat_and_high_wear_skip_unprofitable_cycles(self):
        for kwargs in ({'tariff':'flat'},{'wear':.5}):
            p=plan_from_forecast(self.p,self.forecast,30,**kwargs)['plan']
            self.assertAlmostEqual(p['metrics']['savingsVsBaselineUsd'],0)
            self.assertTrue(all(r['dischargeKw']==0 for r in p['schedule']))
    def test_unknown_weather_does_not_invent_all_clear(self):
        result=plan_from_forecast(self.p,self.forecast,30)
        self.assertEqual(result['weather']['weather']['status'],'live_data_incomplete')
    def test_live_storm_protects_fifty_percent(self):
        f=dict(self.forecast,data_sources=dict(self.forecast['data_sources'],weather='open-meteo',weather_alerts='live'),weather_risk='elevated')
        result=plan_from_forecast(self.p,f,30)
        self.assertGreaterEqual(result['plan']['metrics']['reservePct'],50)
    def test_no_battery_and_unreachable_reserve_are_explicit(self):
        self.assertEqual(plan_from_forecast(dict(self.p,batteryCapacityKwh=.01),self.forecast,30)['status'],'battery_not_supported')
        self.assertEqual(plan_from_forecast(dict(self.p,maxBatteryPowerKw=.01,startingSocPct=0),self.forecast,30)['status'],'reserve_not_reachable')


class FocusedAssistantTests(unittest.TestCase):
    def setUp(self):
        household_ai._CACHE.clear()
        self.report={'householdId':'home','utilities':[{'utility':'water','recentDailyAverage':217.5,'baselineDailyAverage':145,'unit':'gal','changePct':50,'source':'simulated','habitSuggestions':['Check irrigation.','Inspect fixtures.']}]}
    def test_storm_question_does_not_default_to_water_anomaly(self):
        answer=household_ai.focused_summary(self.report,'What about a hurricane?')
        self.assertIn('Weather evidence',answer)
        self.assertNotIn('217.5',answer)
    def test_unloaded_services_do_not_substitute_an_unrelated_utility(self):
        for question in ('Why did my internet bill rise?', 'How can I save on internet?', 'When is trash pickup?'):
            answer=household_ai.focused_summary(self.report,question)
            self.assertNotIn('217.5',answer)
            self.assertIn('not loaded',answer)
    def test_exact_evidence_cache_saves_requests_and_changes_invalidate(self):
        req=Mock(return_value={'candidates':[{'content':{'parts':[{'text':'A focused answer'}]}}]})
        cfg={'GEMINI_API_KEY':'test-only','GEMINI_MODEL':'gemini-test-flash'}
        with patch.object(household_ai,'settings',return_value=cfg),patch.object(household_ai,'request_json',req):
            a=household_ai.household_explain(self.report,'Why water?')
            b=household_ai.household_explain(self.report,'Why water?')
            self.assertEqual(a['provider'],'gemini')
            self.assertTrue(b['cached'])
            self.assertEqual(req.call_count,1)
            household_ai.household_explain(dict(self.report,householdId='other'),'Why water?')
            self.assertEqual(req.call_count,2)
    def test_quota_failure_has_specific_message_and_no_retry(self):
        err=urllib.error.HTTPError('https://example.test',429,'quota',{},None)
        req=Mock(side_effect=err)
        with patch.object(household_ai,'settings',return_value={'GEMINI_API_KEY':'fake','GEMINI_MODEL':'test'}),patch.object(household_ai,'request_json',req):
            r=household_ai.household_explain(self.report,'Why water?')
        self.assertIn('quota',r['warning'])
        self.assertEqual(req.call_count,1)
        self.assertIn('Water averaged',r['answer'])


if __name__=='__main__': unittest.main()
