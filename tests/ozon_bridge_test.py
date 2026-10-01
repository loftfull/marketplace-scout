"""Lifecycle tests; synthetic objects only, no marketplace traffic/history."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('bridge', Path(__file__).resolve().parent.parent / 'scripts' / 'ozon-cdp.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
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
            response = bridge.browser.Response(status, '{}', 'https://www.ozon.ru/api/test', False, 'application/json')
            with patch.object(parent, 'fetch', return_value=response) as fetch:
                with self.assertRaises(bridge.browser.ChallengeFailed):
                    instance.fetch('https://www.ozon.ru/api/test')
                fetch.assert_called_once()
        for url in ('http://www.ozon.ru/', 'https://127.0.0.1/', 'https://evil.example/'):
            with self.assertRaises(bridge.browser.ChallengeFailed):
                instance.fetch(url)


if __name__ == '__main__':
    unittest.main()
