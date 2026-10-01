"""Run the complete pinned upstream app with a small local pilot boundary."""

import os
import signal
import sys
import threading

from boundary import DATA, ROOT, Boundary, write_json

UPSTREAM = ROOT / ".runtime/external/changedetection/upstream"
ORIGIN = "http://127.0.0.1:8791"


def resolve_http(watch, datastore):
    from changedetectionio import content_fetchers

    if (
        watch.get("fetch_backend") not in ("html_requests", "system", None)
        or watch.has_browser_steps
        or watch.get("notification_urls")
    ):
        raise ValueError("Pilot supports only HTTP without steps or notifications")
    return content_fetchers.html_requests, "html_requests", None


def main():
    # Set before upstream imports. No inherited browser/proxy/cloud endpoint.
    for key in list(os.environ):
        if "PROXY" in key.upper() or key.startswith(
            ("PLAYWRIGHT_", "WEBDRIVER_", "APPRISE_")
        ):
            os.environ.pop(key)
    os.environ.update(
        {
            "DISABLE_VERSION_CHECK": "true",
            "FETCH_WORKERS": "1",
            "REQUESTS_RETRY_MAX_COUNT": "0",
            "LLM_FEATURES_DISABLED": "true",
            "LITELLM_LOCAL_MODEL_COST_MAP": "True",
            "ALLOW_FILE_URI": "false",
            "ALLOW_IANA_RESTRICTED_ADDRESSES": "false",
            "BASE_URL": ORIGIN,
            "DEFAULT_SETTINGS_REQUESTS_TIMEOUT": "25",
            "PYTHONUTF8": "1",
        }
    )
    sys.path.insert(0, str(UPSTREAM))
    import requests

    boundary = Boundary()
    requests.Session.send = lambda session, request, **kw: boundary.send(
        session, request, **kw
    )

    import changedetectionio as upstream
    from changedetectionio import content_fetchers, store
    from changedetectionio.flask_app import changedetection_app
    from changedetectionio.pluggy_interface import (
        inject_datastore_into_plugins,
        register_builtin_restock_plugins,
    )
    from flask import abort, request
    from werkzeug.serving import make_server

    DATA.mkdir(parents=True, exist_ok=True)
    datastore = store.ChangeDetectionStore(
        datastore_path=str(DATA),
        version_tag=upstream.__version__,
        include_default_watches=False,
    )
    settings = datastore.data["settings"]["application"]
    settings.update(
        all_paused=True,
        all_muted=True,
        api_access_token_enabled=True,
        notification_urls=[],
        fetch_backend="html_requests",
    )
    settings["ui"]["favicons_enabled"] = False
    settings["ui"]["socket_io_enabled"] = False
    datastore._save_settings()
    for watch in datastore.data["watching"].values():
        watch["paused"] = True
    register_builtin_restock_plugins()
    inject_datastore_into_plugins(datastore)

    content_fetchers.resolve_content_fetcher = resolve_http

    # All external notification transports are disabled, including non-HTTP ones.
    import apprise

    apprise.Apprise.notify = lambda *args, **kw: False

    async def no_notify(*args, **kw):
        return False

    apprise.Apprise.async_notify = no_notify

    app = changedetection_app(
        {"datastore_path": str(DATA), "batch_mode": False}, datastore
    )
    upstream.app, upstream.datastore = app, datastore
    app.config["TRUSTED_HOSTS"] = ["127.0.0.1"]
    original_wsgi = app.wsgi_app

    def guarded_wsgi(environ, start_response):
        if (
            environ.get("HTTP_HOST") != "127.0.0.1:8791"
            or environ.get("HTTP_ORIGIN") not in (None, ORIGIN)
            or environ.get("HTTP_SEC_FETCH_SITE") in ("cross-site", "same-site")
            or environ.get("PATH_INFO", "").startswith("/socket.io")
        ):
            start_response("403 Forbidden", [("Content-Type", "text/plain")])
            return [b"Local pilot boundary"]
        return original_wsgi(environ, start_response)

    app.wsgi_app = guarded_wsgi

    @app.before_request
    def local_boundary():
        if request.host != "127.0.0.1:8791":
            abort(403)
        if request.headers.get("Origin") not in (None, ORIGIN):
            abort(403)
        if request.headers.get("Sec-Fetch-Site") in ("cross-site", "same-site"):
            abort(403)
        # Fixed pilot policy survives UI/API edits. Upstream API auth stays on.
        settings.update(
            all_paused=True,
            all_muted=True,
            api_access_token_enabled=True,
            notification_urls=[],
            fetch_backend="html_requests",
        )
        if (
            request.path.startswith("/api/")
            and request.path != "/api/v1/full-spec"
            and request.headers.get("x-api-key") != settings["api_access_token"]
        ):
            abort(403)
        # No importing arbitrary remote watch bundles, browser endpoints or notifications.
        if request.path.startswith(
            (
                "/import",
                "/share",
                "/check_proxy",
                "/browser-steps",
                "/add-watch-ui",
                "/price_data_follower",
            )
        ):
            abort(403)

    server = make_server("127.0.0.1", 8791, app, threaded=True)
    stop = DATA / "stop.request"
    stop.unlink(missing_ok=True)
    write_json(
        DATA / "running.json",
        {"pid": os.getpid(), "url": ORIGIN, "version": upstream.__version__},
    )

    def stop_listener():
        while not stop.exists():
            if app.config.exit.wait(0.5):
                return
        server.shutdown()

    threading.Thread(target=stop_listener, daemon=True).start()
    try:
        server.serve_forever()
    finally:
        server.server_close()
        settings["all_paused"] = True
        datastore._save_settings()
        (DATA / "running.json").unlink(missing_ok=True)
        upstream.sigshutdown_handler(signal.SIGTERM, None)


if __name__ == "__main__":
    main()
