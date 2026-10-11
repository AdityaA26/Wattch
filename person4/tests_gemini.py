import unittest
import urllib.error
from unittest.mock import Mock, patch
from .gemini_reliability import generate
from . import household_ai, assistant


def failure(code):
    return urllib.error.HTTPError("https://example.com", code, "test", {}, None)


class ReliabilityTests(unittest.TestCase):
    def test_success_only_calls_once(self):
        req = Mock(return_value={"ok": True})
        result, model = generate(req, "fake", "gemini-3.8-flash", {})
        self.assertTrue(result["ok"])
        self.assertEqual(req.call_count, 1)
        self.assertEqual(model, "gemini-3.8-flash")

    @patch("person4.gemini_reliability.time.sleep")
    def test_retry_recovers_without_switching(self, sleep):
        req = Mock(side_effect=[failure(503), {"ok": True}])
        self.assertEqual(generate(req, "fake", "gemini-3.8-flash", {})[1], "gemini-3.8-flash")
        self.assertEqual(req.call_count, 2)

    @patch("person4.gemini_reliability.time.sleep")
    def test_two_overloads_use_backup_with_same_facts(self, sleep):
        req = Mock(side_effect=[failure(503), failure(503), {"ok": True}])
        body = {"facts": {"usage": 145}}
        self.assertEqual(generate(req, "fake", "gemini-3.8-flash", body)[1], "gemini-3.6-flash")
        self.assertEqual(req.call_count, 3)
        self.assertIs(req.call_args.args[2], body)
        self.assertIn("gemini-3.6-flash", req.call_args.args[0])

    def test_quota_auth_and_missing_model_are_not_retried(self):
        for code in [429, 401, 403, 404]:
            req = Mock(side_effect=failure(code))
            with self.assertRaises(urllib.error.HTTPError): generate(req, "fake", "gemini-3.8-flash", {})
            self.assertEqual(req.call_count, 1)

    @patch("person4.gemini_reliability.time.sleep")
    def test_backup_failure_is_bounded(self, sleep):
        req = Mock(side_effect=failure(503))
        with self.assertRaises(urllib.error.HTTPError): generate(req, "fake", "gemini-3.8-flash", {})
        self.assertEqual(req.call_count, 3)

    @patch("person4.gemini_reliability.time.sleep")
    def test_custom_model_not_silently_changed(self, sleep):
        req = Mock(side_effect=failure(503))
        with self.assertRaises(urllib.error.HTTPError): generate(req, "fake", "custom-flash", {})
        self.assertEqual(req.call_count, 2)

    @patch("person4.gemini_reliability.time.sleep")
    def test_household_returns_actual_backup_name(self, sleep):
        req = Mock(side_effect=[failure(503), failure(503), {"candidates": [{"content": {"parts": [{"text": "Answer"}]}}]}])
        with patch.object(household_ai, "settings", return_value={"GEMINI_API_KEY": "fake", "GEMINI_MODEL": "gemini-3.8-flash"}), patch.object(household_ai, "request_json", req):
            answer = household_ai.household_explain({"householdId": "a", "utilities": []}, "Why?")
        self.assertEqual(answer["provider"], "gemini")
        self.assertEqual(answer["model"], "gemini-3.6-flash")


if __name__ == "__main__":
    unittest.main()
