#!/usr/bin/env python3
"""Serve LabFlow and optionally relay allow-listed cloud AI requests.

This keeps the browser UI static/vanilla while providing a same-origin escape hatch
for cloud APIs that deliberately do not enable browser CORS. It is not a generic
forward proxy: provider ids, upstream hosts, schemes, methods and forwarded headers
are all allow-listed.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HEALTH_PATH = "/__labflow__/health"
PROXY_PATH = "/__labflow__/proxy"
MAX_PROXY_BODY = 8 * 1024 * 1024
UPSTREAM_TIMEOUT = 180

PROVIDER_HOSTS = {
    "zai": {"api.z.ai"},
    "openrouter": {"openrouter.ai"},
    "nvidia": {"integrate.api.nvidia.com"},
    "openai": {"api.openai.com"},
    "gemini": {"generativelanguage.googleapis.com"},
}
FORWARD_REQUEST_HEADERS = {
    "accept",
    "content-type",
    "authorization",
    "x-openrouter-title",
    "http-referer",
}
FORWARD_RESPONSE_HEADERS = {
    "content-type",
    "retry-after",
    "x-request-id",
    "request-id",
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens",
}


def compact_target(url: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        return "<invalid>"


class LabFlowHandler(SimpleHTTPRequestHandler):
    server_version = "LabFlowLocal/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep static-file logs concise. Proxy requests have their own structured line.
        message = fmt % args
        sys.stderr.write(f"[LabFlowServer][HTTP] {self.client_address[0]} {message}\n")

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlsplit(self.path).path
        if path == HEALTH_PATH:
            self._json(HTTPStatus.OK, {
                "ok": True,
                "service": "labflow-local-server",
                "relay": True,
                "providers": sorted(PROVIDER_HOSTS),
            })
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        path = urllib.parse.urlsplit(self.path).path
        if path != PROXY_PATH:
            self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Unknown LabFlow server route."})
            return
        self._handle_proxy()

    def _handle_proxy(self) -> None:
        started = time.monotonic()
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_PROXY_BODY:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Invalid relay request size."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "Malformed relay JSON."})
            return

        provider = str(payload.get("provider") or "").strip().lower()
        method = str(payload.get("method") or "GET").strip().upper()
        phase = str(payload.get("phase") or "request").strip()[:80]
        url = str(payload.get("url") or "").strip()
        headers = payload.get("headers") if isinstance(payload.get("headers"), dict) else {}
        body = payload.get("body")

        allowed_hosts = PROVIDER_HOSTS.get(provider)
        if not allowed_hosts:
            self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Provider is not relay-enabled."})
            return
        if method not in {"GET", "POST"}:
            self._json(HTTPStatus.METHOD_NOT_ALLOWED, {"ok": False, "error": "Relay method is not allowed."})
            return
        try:
            parsed = urllib.parse.urlsplit(url)
        except Exception:
            parsed = None
        if not parsed or parsed.scheme.lower() != "https" or (parsed.hostname or "").lower() not in allowed_hosts:
            self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Relay target is not allowed for this provider."})
            return
        if parsed.username or parsed.password or parsed.fragment:
            self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Relay target contains unsupported URL components."})
            return

        upstream_headers: dict[str, str] = {}
        for key, value in headers.items():
            if str(key).lower() in FORWARD_REQUEST_HEADERS:
                upstream_headers[str(key)] = str(value)
        request_data = None if method == "GET" or body is None else str(body).encode("utf-8")
        request = urllib.request.Request(url, data=request_data, headers=upstream_headers, method=method)

        try:
            response = urllib.request.urlopen(request, timeout=UPSTREAM_TIMEOUT, context=ssl.create_default_context())
            status = int(response.status)
            raw = response.read(MAX_PROXY_BODY + 1)
            response_headers = response.headers
        except urllib.error.HTTPError as error:
            status = int(error.code)
            raw = error.read(MAX_PROXY_BODY + 1)
            response_headers = error.headers
        except Exception as error:
            elapsed = round((time.monotonic() - started) * 1000)
            sys.stderr.write(
                f"[LabFlowServer][RELAY][ERROR] provider={provider} phase={phase} "
                f"target={compact_target(url)} elapsedMs={elapsed} error={type(error).__name__}: {error}\n"
            )
            self._json(HTTPStatus.BAD_GATEWAY, {
                "error": {
                    "message": "LabFlow relay could not reach the provider upstream.",
                    "type": "labflow_relay_network_error",
                    "provider": provider,
                    "phase": phase,
                }
            })
            return

        if len(raw) > MAX_PROXY_BODY:
            self._json(HTTPStatus.BAD_GATEWAY, {"ok": False, "error": "Provider response exceeded the LabFlow relay limit."})
            return

        elapsed = round((time.monotonic() - started) * 1000)
        sys.stderr.write(
            f"[LabFlowServer][RELAY] provider={provider} phase={phase} method={method} "
            f"status={status} target={compact_target(url)} elapsedMs={elapsed} bytes={len(raw)}\n"
        )
        self.send_response(status)
        for key, value in response_headers.items():
            if key.lower() in FORWARD_RESPONSE_HEADERS:
                self.send_header(key, value)
        if not response_headers.get("Content-Type"):
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-LabFlow-Transport", "relay")
        self.end_headers()
        self.wfile.write(raw)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve LabFlow with an optional same-origin cloud-provider relay.")
    parser.add_argument("--host", default=os.environ.get("LABFLOW_WEB_HOST", "0.0.0.0"), help="bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("LABFLOW_WEB_PORT", "8000")), help="bind port (default: 8000)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), LabFlowHandler)
    shown_host = "127.0.0.1" if args.host in {"0.0.0.0", "::"} else args.host
    print(f"LabFlow local server: http://{shown_host}:{args.port}")
    print("Cloud relay: enabled for Z.AI, OpenRouter, NVIDIA NIM, OpenAI and Gemini")
    if args.host in {"0.0.0.0", "::"}:
        print("LAN serving: enabled; use this computer's private IP/hostname from another device")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping LabFlow local server.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
