#!/usr/bin/env python3
"""Regression contract for the explicit localhost cloud-provider relay."""
from __future__ import annotations

import http.client
import importlib.util
from pathlib import Path
import threading

ROOT = Path(__file__).resolve().parents[2]
RELAY_PATH = ROOT / "tools" / "provider_relay.py"


def load_relay():
    spec = importlib.util.spec_from_file_location("labflow_provider_relay", RELAY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("provider relay module could not be loaded")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def request(port: int, method: str, path: str, headers=None, body=None):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
    connection.request(method, path, body=body, headers=headers or {})
    response = connection.getresponse()
    payload = response.read()
    response_headers = {key.lower(): value for key, value in response.getheaders()}
    status = response.status
    connection.close()
    return status, response_headers, payload


def main() -> None:
    relay = load_relay()
    assert set(relay.ROUTES) == {
        ("POST", "/zai/v1/chat/completions"),
        ("GET", "/nvidia/v1/models"),
        ("POST", "/nvidia/v1/chat/completions"),
    }, "relay route allowlist changed"

    server = relay.RelayServer(("127.0.0.1", 0), relay.ProviderRelayHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]

    try:
        status, headers, _ = request(
            port,
            "OPTIONS",
            "/nvidia/v1/chat/completions",
            {
                "Origin": "https://matginesi.github.io",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
                "Access-Control-Request-Private-Network": "true",
            },
        )
        assert status == 204
        assert headers.get("access-control-allow-origin") == "https://matginesi.github.io"
        assert headers.get("access-control-allow-private-network") == "true"
        assert "authorization" in headers.get("access-control-allow-headers", "").lower()

        status, _, _ = request(
            port,
            "OPTIONS",
            "/zai/v1/chat/completions",
            {"Origin": "https://matginesi.github.io"},
        )
        assert status == 204

        status, _, _ = request(port, "GET", "/not-allowlisted")
        assert status == 404

        status, _, _ = request(
            port,
            "POST",
            "/nvidia/v1/chat/completions",
            {"Content-Type": "application/json"},
            b"{}",
        )
        assert status == 401
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

    print("provider relay regression: OK")


if __name__ == "__main__":
    main()
