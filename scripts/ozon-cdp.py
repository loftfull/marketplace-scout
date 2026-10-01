"""Lifecycle adapter for pinned MIT SZhukovWork/ozon-mcp; no upstream edits.

Connect only to Scout's owned, proxy-guarded Chrome. Never launch, disguise,
persist/login, renew challenged sessions, or close the shared browser.
"""
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.runtime' / 'ozon-mcp' / 'src'))
from ozon_mcp import browser  # noqa: E402


class ScoutBrowser(browser.Browser):
    def start(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.connect_over_cdp('http://127.0.0.1:9337', timeout=10000)
        self._new_context(False)
        response = self._page.goto(browser.HOME, wait_until='domcontentloaded', timeout=20000)
        if (response is None or response.status != 200
                or urlparse(self._page.url).hostname != 'www.ozon.ru'
                or not browser._storefront(self._page.title())):
            raise browser.ChallengeFailed('scout_source_blocked')

    def _new_context(self, reuse_state=False):
        self._context = self._browser.new_context(locale='ru-RU', service_workers='block')
        self._page = self._context.new_page()
        self._reused_state = False

    def rechallenge(self):
        raise browser.ChallengeFailed('scout_source_blocked')

    def _save_state(self):
        pass

    def fetch(self, url, method='GET', body=None, timeout=20.0):
        target = urlparse(url)
        if target.scheme != 'https' or target.hostname != 'www.ozon.ru' or target.port not in (None, 443):
            raise browser.ChallengeFailed('scout_unsafe_target')
        result = super().fetch(url, method, body, min(timeout, 20.0))
        if result.status in (401, 403, 429) or result.redirected or 300 <= result.status < 400:
            raise browser.ChallengeFailed('scout_source_blocked')
        if result.status == 200 and result.json() is None:
            raise browser.ChallengeFailed('scout_source_blocked')
        return result

    def close(self):
        try:
            if self._context:
                self._context.close()
        finally:
            if self._pw:
                self._pw.stop()  # disconnect only: Browser.close would kill Scout's Chrome
            self._pw = self._browser = self._context = self._page = None


browser.Browser = ScoutBrowser
if __name__ == '__main__':
    from ozon_mcp.server import main
    main()
