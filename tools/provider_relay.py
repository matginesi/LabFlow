#!/usr/bin/env python3
"""Allowlisted localhost relay for cloud APIs that block browser CORS.

LabFlow remains a static browser application. The browser still owns provider
selection, credentials, requests, and responses. This helper exists only because
some hosted APIs do not expose browser-compatible CORS headers.

The relay:
- binds to loopback by default;
- forwards only explicitly allowlisted LabFlow routes;
- never stores API keys, bodies, or scientific state;
- never chooses a provider or performs fallback routing;
- supports normal JSON responses and streaming responses.

Default LabFlow endpoints:
  Z.AI       http://127.0.0.1:8099/zai/v1
  NVIDIA NIM http://127.0.0.1:8099/nvidia/v1
"""

from __future__ import annotations

import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROUTES = {
    ("POST", "/zai/v1/chat/completions"): "https://api.z.ai/api/paas/v4/chat/completions",
    ("GET", "/nvidia/v1/models"): "https://integrate.api.nvidia.com/v1/models",
    ("POST", "/nvidia/v1/chat/completions"): "https://integrate.api.nvidia.com/v1/chat/completions",
}

REQUEST_HEADERS = (
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Request-Id",
    "X-Correlation-Id",
)
RESPONSE_HEADERS = (
    "Content-Type",
    "Cache-Control",
    "Retry-After",
    "X-Request-Id",
    "Request-Id",
)
MAX_REQUEST_BYTES = 16 * 1024 * 1024


class RelayServer(ThreadingHTTPServer):
    daemon_threads = True


class ProviderRelayHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "LabFlowProviderRelay/1"

    def log_message(self, fmt: str, *args: object) -> None:
        # Never log request headers or bodies: they may contain credentials/data.
        sys.stderr.write("[provider-relay] " + fmt % args + "\n")

    def _path(self) -> str:
        return urlsplit(self.path).path

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "*") or "*"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type, Accept, X-Request-Id, X-Correlation-Id",
        )
        self.send_header(
            "Access-Control-Expose-Headers",
            "X-Request-Id, Request-Id, Retry-After",
        )
        # Chromium may classify an HTTPS GitHub Pages -> localhost request as a
        # local/private-network access. The relay is loopback-only by default.
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")

    def _json_error(self, status: int, message: str) -> None:
        body = json.dumps(
            {"error": {"message": message, "type": "labflow_relay_error"}}
        ).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_OPTIONS(self) -> None:  # noqa: N802
        path = self._path()
        if not any(route_path == path for _, route_path in ROUTES):
            self._json_error(404, "Unsupported LabFlow provider-relay path.")
            return
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        self._forward("GET")

    def do_POST(self) -> None:  # noqa: N802
        self._forward("POST")

    def _forward(self, method: str) -> None:
        path = self._path()
        upstream_url = ROUTES.get((method, path))
        if not upstream_url:
            self._json_error(404, f"Unsupported relay route: {method} {path}")
            return

        authorization = self.headers.get("Authorization", "").strip()
        if not authorization:
            self._json_error(401, "Provider API key is missing from the browser request.")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0") or 0)
        except ValueError:
            self._json_error(400, "Invalid Content-Length header.")
            return
        if content_length < 0 or content_length > MAX_REQUEST_BYTES:
            self._json_error(413, "Provider request exceeds the relay size limit.")
            return

        body = self.rfile.read(content_length) if content_length else None
        headers = {
            name: self.headers[name]
            for name in REQUEST_HEADERS
            if self.headers.get(name)
        }
        headers.setdefault("Accept", "application/json")

        request = Request(
            upstream_url,
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=180) as upstream:
                self._relay_response(upstream.status, upstream.headers, upstream)
        except HTTPError as error:
            self._relay_response(error.code, error.headers, error)
        except URLError as error:
            self._json_error(502, f"Provider upstream is unreachable: {error.reason}")
        except Exception as error:  # defensive boundary around stdlib transport
            self._json_error(502, f"Provider relay failed: {error}")

    def _relay_response(self, status: int, headers, stream) -> None:
        self.send_response(status)
        self._cors()
        for name in RESPONSE_HEADERS:
            value = headers.get(name) if headers else None
            if value:
                self.send_header(name, value)
        # Do not copy upstream Content-Length/Transfer-Encoding. We relay bytes
        # until EOF and close the connection, which also works for SSE streams.
        self.send_header("Connection", "close")
        self.end_headers()
        read_chunk = getattr(stream, "read1", stream.read)
        while True:
            chunk = read_chunk(64 * 1024)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()
        self.close_connection = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Allowlisted local CORS relay for LabFlow cloud providers."
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address (default: 127.0.0.1). Use a LAN address only deliberately.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8099,
        help="Bind port (default: 8099).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = RelayServer((args.host, args.port), ProviderRelayHandler)
    print(f"LabFlow provider relay: http://{args.host}:{args.port}")
    print("  Z.AI       /zai/v1/chat/completions")
    print("  NVIDIA NIM /nvidia/v1/models")
    print("  NVIDIA NIM /nvidia/v1/chat/completions")
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        print("WARNING: relay is not bound to loopback; protect the host/network accordingly.", file=sys.stderr)
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
