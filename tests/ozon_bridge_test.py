"""Lifecycle tests; synthetic objects only, no marketplace traffic/history."""
import importlib.util
import asyncio
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).resolve().parent.parent / 'scripts' / 'ozon-cdp.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def setUp(self):
        bridge._blocked = False

    def test_disconnect_never_closes_shared_chrome(self):
        instance = bridge.ScoutBrowser(Path('.runtime/unused-test-state'))
        instance._context, instance._browser, instance._pw = MagicMock(), MagicMock(), MagicMock()
        context, browser, driver = instance._context, instance._browser, instance._pw
        instance.close()
        context.close.assert_called_once()
        driver.stop.assert_called_once()
        browser.close.assert_not_called()

    def test_context_has_no_imported_state_or_disguise(self):
        instance = bridge.ScoutBrowser(Path('.runtime/unused-test-state'))
        instance._browser = MagicMock()
        instance._new_context(True)
        instance._browser.new_context.assert_called_once_with(locale='ru-RU', service_workers='block')
        with self.assertRaises(bridge.browser.ChallengeFailed):
            instance.rechallenge()

    def test_terminal_block_never_retries_or_saves_state(self):
        instance = bridge.ScoutBrowser(Path('.runtime/unused-test-state'))
        parent = bridge.ScoutBrowser.__mro__[1]
        for status in (401, 403, 429, 307):
            bridge._blocked = False
            response = bridge.browser.Response(status, '{}', 'https://www.ozon.ru/api/test', False, 'application/json')
            with patch.object(parent, 'fetch', return_value=response) as fetch:
                with self.assertRaises(bridge.browser.ChallengeFailed):
                    instance.fetch('https://www.ozon.ru/api/test')
                fetch.assert_called_once()
                # Ancillary failures caught upstream cannot start another fetch.
                with self.assertRaises(bridge.browser.ChallengeFailed):
                    instance.fetch('https://www.ozon.ru/api/next-sku')
                with self.assertRaises(bridge.browser.ChallengeFailed):
                    bridge.ScoutBrowser(Path('.runtime/unused-test-state')).start()
                fetch.assert_called_once()
        for url in ('http://www.ozon.ru/', 'https://127.0.0.1/', 'https://evil.example/'):
            with self.assertRaises(bridge.browser.ChallengeFailed):
                instance.fetch(url)

    def test_swallowed_ancillary_block_rejects_partial_tool_result(self):
        from ozon_mcp import server
        from mcp.server.mcpserver.exceptions import ToolError
        instance = bridge.ScoutBrowser(Path('.runtime/unused-test-state'))
        parent = bridge.ScoutBrowser.__mro__[1]
        response = bridge.browser.Response(403, '{}', 'https://www.ozon.ru/api/reviews', False, 'application/json')
        async def partial(*args, **kwargs):
            try:
                instance.fetch('https://www.ozon.ru/api/reviews')
            except bridge.browser.ChallengeFailed:
                pass  # upstream optional rating/delivery handling
            return {'price': 100, 'status': 'ok'}
        with patch.object(parent, 'fetch', return_value=response) as fetch:
            with patch.object(server.mcp, 'call_tool', side_effect=partial) as original:
                bridge.guard_tools(server.mcp)
                for _ in range(2):
                    with self.assertRaisesRegex(ToolError, 'scout_source_blocked'):
                        asyncio.run(server.mcp.call_tool('get_product', {'product': '1'}))
                original.assert_called_once()
                fetch.assert_called_once()


if __name__ == '__main__':
    unittest.main()
