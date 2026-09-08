#!/usr/bin/env python3
"""Regression checks for public asset routing and the fixed Z.AI relay."""
from __future__ import annotations

import importlib.util
import json
import threading
from contextlib import contextmanager
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen as client_urlopen
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('labflow_serve_static', ROOT / 'tools' / 'serve_static.py')
assert SPEC and SPEC.loader
serve_static = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(serve_static)


class FakeUpstream:
    def __init__(self, payload: bytes, status: int = 200) -> None:
        self.payload = payload
        self.status = status
        self.headers = {"Content-Type": "application/json", "X-Request-Id": "test-request"}
        self._read = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self, _size: int = -1) -> bytes:
        if self._read:
            return b""
        self._read = True
        return self.payload


@contextmanager
def running_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), serve_static.PublicHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def expect_http_error(url: str, status: int) -> None:
    try:
        client_urlopen(url, timeout=3)
    except HTTPError as error:
        assert error.code == status, (url, error.code, status)
    else:
        raise AssertionError(f"Expected HTTP {status}: {url}")


def main() -> None:
    with running_server() as base:
        assert client_urlopen(base + "/", timeout=3).status == 200
        assert client_urlopen(base + "/assets/js/export/nomad.js", timeout=3).status == 200
        assert client_urlopen(base + "/assets/js/pages/export-page.js", timeout=3).status == 200
        expect_http_error(base + "/assets/js/nomad/nomad.js", 404)
        expect_http_error(base + "/assets/js/pages/nomad-page.js", 404)

        missing_key = Request(
            base + serve_static.ZAI_RELAY_PATH,
            data=b"{}",
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            client_urlopen(missing_key, timeout=3)
        except HTTPError as error:
            assert error.code == 401
        else:
            raise AssertionError("Z.AI relay accepted a request without Authorization")

        preflight = Request(
            base + serve_static.ZAI_RELAY_PATH,
            method="OPTIONS",
            headers={
                "Origin": "http://127.0.0.1:5500",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        with client_urlopen(preflight, timeout=3) as response:
            assert response.status == 204
            assert response.headers.get("Access-Control-Allow-Origin") == "http://127.0.0.1:5500"
            assert "POST" in response.headers.get("Access-Control-Allow-Methods", "")

        captured = {}

        def fake_urlopen(request, timeout):
            captured["url"] = request.full_url
            captured["authorization"] = request.get_header("Authorization")
            captured["body"] = request.data
            captured["timeout"] = timeout
            return FakeUpstream(json.dumps({"ok": True}).encode("utf-8"))

        relay_request = Request(
            base + serve_static.ZAI_RELAY_PATH,
            data=json.dumps({"model": "glm-4.7-flash", "messages": [{"role": "user", "content": "ping"}]}).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", "Authorization": "Bearer test-key"},
        )
        with patch.object(serve_static, "urlopen", fake_urlopen):
            with client_urlopen(relay_request, timeout=3) as response:
                body = json.loads(response.read().decode("utf-8"))
                assert response.status == 200
                assert response.headers.get("X-LabFlow-Relay") == "zai"
                assert body == {"ok": True}

        assert captured["url"] == serve_static.ZAI_UPSTREAM
        assert captured["authorization"] == "Bearer test-key"
        assert json.loads(captured["body"].decode("utf-8"))["model"] == "glm-4.7-flash"
        assert captured["timeout"] == serve_static.UPSTREAM_TIMEOUT_SECONDS

    print("serve-static-zai: passed")


if __name__ == "__main__":
    main()
