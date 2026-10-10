"""Run: python3 -m unittest -v person4.tests. No live API key is used."""
import copy
import io
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from . import api, assistant, configure_key
from . import settings as settings_module
from .calculations import evaluate, community_report
from .settings import ROOT


def sample():
    return json.loads((ROOT / "fixtures/sample_plan.json").read_text())


EMPTY = {"GEMINI_API_KEY": "", "GEMINI_MODEL": "", "PORT": "", "FRONTEND_ORIGIN": ""}


class CalculationTests(unittest.TestCase):
    def test_reference_costs_and_ending_energy(self):
        p = evaluate(sample()); m = p["metrics"]
        self.assertAlmostEqual(m["baselineCostUsd"], 17.712)
        self.assertAlmostEqual(m["plannedCostUsd"], 15.368869806094184)
        self.assertAlmostEqual(m["savingsVsBaselineUsd"], 2.3431301939058162)
        self.assertAlmostEqual(p["baseline"][-1]["storedKwh"], p["schedule"][-1]["storedKwh"])

    def test_grid_only_and_repeat_day_label(self):
        p = evaluate(sample())
        self.assertAlmostEqual(p["metrics"]["gridOnlyCostUsd"], sum(r["loadKw"] * r["priceUsdPerKwh"] for r in p["baseline"]))
        self.assertAlmostEqual(p["repeatDayProjection"]["annualUsd"], p["metrics"]["savingsVsBaselineUsd"] * 365)
        self.assertIn("identical days", p["repeatDayProjection"]["assumption"])

    def test_flat_tariff_no_fake_savings(self):
        p = evaluate(json.loads((ROOT / "fixtures/flat_plan.json").read_text()))
        self.assertAlmostEqual(p["metrics"]["savingsVsBaselineUsd"], 0)

    def test_negative_savings_not_hidden(self):
        p = sample(); p["config"]["wearUsdPerKwh"] = .5
        self.assertLess(evaluate(p)["metrics"]["savingsVsBaselineUsd"], 0)

    def test_observed_inputs_have_separate_status(self):
        p = sample(); p["inputType"] = "observed"
        report = evaluate(p)
        self.assertEqual(report["savingsStatus"], "calculated_from_supplied_observations")
        self.assertTrue(any("not been verified" in w for w in report["warnings"]))

    def test_no_event_means_no_event_impact(self):
        p = sample()
        for name in ("baseline", "schedule"):
            for row in p[name]: row["gridEvent"] = False
        self.assertEqual(evaluate(p)["gridImpact"]["eventEnergyAvoidedKwh"], 0)

    def test_backup_load_over_power_limit(self):
        p = sample(); p["config"].update(essentialLoadKw=5, backupHours=0)
        m = evaluate(p)["metrics"]
        self.assertFalse(m["backupGoalFeasible"])
        self.assertEqual(m["currentBackupHours"], 0)

    def test_unmet_energy_goal_is_flagged(self):
        p = sample(); p["config"]["backupHours"] = 48
        energy = 13.5 * .6
        for row in p["baseline"]:
            charge = min(3, max(0, 13.5-energy) / .95); energy += charge * .95
            row.update(chargeKw=charge, dischargeKw=0, gridKw=row["loadKw"]+charge, storedKwh=energy)
        p["schedule"] = copy.deepcopy(p["baseline"])
        report = evaluate(p)
        self.assertFalse(report["metrics"]["backupGoalFeasible"])
        self.assertTrue(any("exceeds battery energy" in w for w in report["warnings"]))

    def test_solar_surplus_is_curtailed(self):
        p = sample()
        for name in ("baseline", "schedule"):
            row = p[name][0]; row["solarKw"] = 2; row["gridKw"] = row["chargeKw"]
        self.assertGreaterEqual(evaluate(p)["metrics"]["gridOnlyCostUsd"], 0)

    def test_invalid_energy_balance(self):
        p = sample(); p["schedule"][0]["gridKw"] += 1
        with self.assertRaisesRegex(ValueError, "energy balance"): evaluate(p)

    def test_unfair_prices(self):
        p = sample(); p["schedule"][0]["priceUsdPerKwh"] += .1
        with self.assertRaisesRegex(ValueError, "identical demand"): evaluate(p)

    def test_unfair_ending_energy(self):
        p = sample(); r = p["baseline"][-1]
        r["chargeKw"] += .1/.95; r["gridKw"] += .1/.95; r["storedKwh"] += .1
        with self.assertRaisesRegex(ValueError, "identical ending"): evaluate(p)

    def test_reserve_violation(self):
        p = sample(); p["config"]["reservePct"] = 90
        with self.assertRaisesRegex(ValueError, "reserve"): evaluate(p)

    def test_invalid_values_and_event_type(self):
        for value in (True, float("nan"), float("inf"), -1):
            p = sample(); p["config"]["capacityKwh"] = value
            with self.subTest(value=value), self.assertRaises(ValueError): evaluate(p)
        p = sample(); p["schedule"][0]["gridEvent"] = "false"
        with self.assertRaises(ValueError): evaluate(p)

    def test_bad_metadata(self):
        for k, value in (("date", "bad"), ("timezone", "not/a/timezone"), ("inputType", "real"), ("currency", "INR")):
            p = sample(); p[k] = value
            with self.subTest(k=k), self.assertRaises(ValueError): evaluate(p)

    def test_community_coincident_values(self):
        raw = json.loads((ROOT / "fixtures/sample_community.json").read_text())
        result = community_report(raw)
        self.assertEqual(result["assetsRepresented"], 2)
        self.assertAlmostEqual(result["baselineCoincidentPeakKw"], 12.6)
        self.assertAlmostEqual(result["eventEnergyAvoidedKwh"], 16.85)
        self.assertEqual(result["backupGoalsMetAtEnd"], 2)

    def test_community_does_not_sum_individual_peaks(self):
        raw = json.loads((ROOT / "fixtures/sample_community.json").read_text())
        second = raw["plans"][1]
        second["schedule"] = copy.deepcopy(second["baseline"])
        for name in ("baseline", "schedule"):
            old = [r["loadKw"] for r in second[name]]
            for h,r in enumerate(second[name]):
                load = old[(h+12)%24]
                r["loadKw"] = load; r["gridKw"] = load+r["chargeKw"]-r["dischargeKw"]
        individual = sum(evaluate(p)["gridImpact"]["baselinePeakKw"] for p in raw["plans"])
        self.assertLess(community_report(raw)["baselineCoincidentPeakKw"], individual)

    def test_community_rejects_misalignment_and_duplicate_ids(self):
        raw = json.loads((ROOT / "fixtures/sample_community.json").read_text())
        raw["plans"][1]["date"] = "2026-10-12"
        with self.assertRaises(ValueError): community_report(raw)
        raw["plans"][1]["date"] = "2026-10-11"
        raw["plans"][1]["assetId"] = raw["plans"][0]["assetId"]
        with self.assertRaises(ValueError): community_report(raw)


class AssistantTests(unittest.TestCase):
    def test_missing_key_is_labeled(self):
        with patch.object(assistant,"settings",return_value=EMPTY):
            reply = assistant.explain(evaluate(sample()),"Monthly savings?")
        self.assertEqual(reply["provider"],"local_rules")
        self.assertIn("identical days",reply["answer"])

    def test_gemini_receives_calculations_and_sources(self):
        cfg = dict(EMPTY,GEMINI_API_KEY="test-key",GEMINI_MODEL="test-flash")
        def fake(url,key,body):
            text = body["contents"][0]["parts"][0]["text"]
            self.assertIn("tariffSource",text); self.assertIn("repeatDayProjection",text)
            return {"candidates":[{"content":{"parts":[{"text":"A grounded simulated explanation."}]}}]}
        with patch.object(assistant,"settings",return_value=cfg), patch.object(assistant,"request_json",side_effect=fake):
            reply = assistant.explain(evaluate(sample()),"Why save?")
        self.assertEqual(reply["provider"],"gemini")
        self.assertNotIn("test-key",json.dumps(reply))

    def test_gemini_failure_has_a_fallback(self):
        cfg = dict(EMPTY,GEMINI_API_KEY="test-key",GEMINI_MODEL="test-flash")
        with patch.object(assistant,"settings",return_value=cfg), patch.object(assistant,"request_json",side_effect=urllib.error.URLError("offline")):
            reply = assistant.explain(evaluate(sample()),"Backup?")
        self.assertEqual(reply["provider"],"local_rules")
        self.assertIn("failed",reply["warning"])

    def test_model_discovery_filters_image_models(self):
        data = {"models":[{"name":"models/gemini-test-flash","supportedGenerationMethods":["generateContent"]},
                          {"name":"models/gemini-test-flash-image","supportedGenerationMethods":["generateContent"]}]}
        with patch.object(assistant,"request_json",return_value=data):
            self.assertEqual(assistant.select_model("unique-test-key",""),"gemini-test-flash")


class ConfigurationTests(unittest.TestCase):
    def test_key_setup_saves_without_printing_key(self):
        with tempfile.TemporaryDirectory() as d:
            output = io.StringIO()
            with patch.object(configure_key,"ROOT",Path(d)), patch.object(configure_key.getpass,"getpass",return_value="fake-key-for-test"), patch("sys.stdout",output):
                configure_key.main()
            self.assertEqual((Path(d)/".env").read_text().strip(),"GEMINI_API_KEY=fake-key-for-test")
            self.assertNotIn("fake-key-for-test",output.getvalue())

    def test_saved_key_overrides_stale_terminal_key(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d)/".env").write_text("GEMINI_API_KEY=saved-test-key\n")
            with patch.object(settings_module,"ROOT",Path(d)), patch.dict(os.environ,GEMINI_API_KEY="old-terminal-test-key"):
                self.assertEqual(settings_module.settings()["GEMINI_API_KEY"],"saved-test-key")


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = dict(EMPTY)
        cls.patches = [patch.object(api,"settings",return_value=cls.config),patch.object(assistant,"settings",return_value=cls.config)]
        for p in cls.patches: p.start()
        cls.server = ThreadingHTTPServer(("127.0.0.1",0),api.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True); cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.client = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join()
        for p in cls.patches: p.stop()

    def call(self,path,body=None,origin=None,method=None):
        headers = {"Content-Type":"application/json"}
        if origin: headers["Origin"] = origin
        req = urllib.request.Request(self.url+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        with self.client.open(req,timeout=3) as r:
            data = r.read()
            return r,json.loads(data) if data else None

    def test_root_returns_backend_status(self):
        r,data = self.call("/")
        self.assertEqual(r.headers["Content-Type"],"application/json")
        self.assertTrue(data["ok"]); self.assertFalse(data["frontendIncluded"])

    def test_full_evaluate_chat_community_flow(self):
        _,p = self.call("/api/insights/evaluate",sample())
        _,reply = self.call("/api/insights/chat",{"planId":p["planId"],"question":"Backup?"})
        self.assertEqual(reply["planId"],p["planId"])
        self.assertEqual(reply["provider"],"local_rules")
        _,community = self.call("/api/insights/community",json.loads((ROOT/"fixtures/sample_community.json").read_text()))
        self.assertEqual(community["assetsRepresented"],2)

    def test_bad_body_and_missing_plan(self):
        with self.assertRaises(urllib.error.HTTPError) as caught: self.call("/api/insights/evaluate",{})
        self.assertEqual(caught.exception.code,400)
        with self.assertRaises(urllib.error.HTTPError) as caught: self.call("/api/insights/chat",{"planId":"missing","question":"Hi"})
        self.assertEqual(caught.exception.code,404)

    def test_frontend_origin_and_preflight(self):
        with self.assertRaises(urllib.error.HTTPError) as caught: self.call("/api/insights/health",origin="http://localhost:3000")
        self.assertEqual(caught.exception.code,403)
        with patch.dict(self.config,FRONTEND_ORIGIN="http://localhost:3000"):
            r,_ = self.call("/api/insights/health",origin="http://localhost:3000")
            self.assertEqual(r.headers["Access-Control-Allow-Origin"],"http://localhost:3000")
            r,_ = self.call("/api/insights/chat",origin="http://localhost:3000",method="OPTIONS")
            self.assertEqual(r.status,204)


if __name__ == "__main__":
    unittest.main(verbosity=2)
