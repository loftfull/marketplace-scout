"""No network: a denied WB response must not reach legacy endpoint fallbacks."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch

spec = importlib.util.spec_from_file_location("scout_wb", Path(__file__).resolve().parents[1] / "scripts/wb-guard.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class GuardTests(unittest.IsolatedAsyncioTestCase):
    async def test_denied_and_html_responses_are_terminal(self):
        for response in [(code, "denied", None) for code in (401, 403, 429, 498)] + [(200, "<html>Access denied</html>", None)]:
            with patch.object(bridge, "original_get", AsyncMock(return_value=response)) as request:
                with self.assertRaisesRegex(bridge.ToolError, "scout_source_blocked"):
                    await bridge.guarded_get("https://example.invalid")
                request.assert_awaited_once()

    async def test_json_response_is_preserved(self):
        response = (200, '{"data": {}}', None)
        with patch.object(bridge, "original_get", AsyncMock(return_value=response)):
            self.assertEqual(await bridge.guarded_get("https://example.invalid"), response)


if __name__ == "__main__":
    unittest.main()
