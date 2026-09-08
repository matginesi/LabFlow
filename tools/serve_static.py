#!/usr/bin/env python3
"""Serve LabFlow public files and the narrow same-origin Z.AI relay.

The public-file allowlist prevents dotfiles, Python sources, documentation,
tests and repository metadata from being fetched by the browser. The relay is
restricted to Z.AI Chat Completions so it cannot be used as an arbitrary proxy.
"""
from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SUFFIXES = {".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2"}
PUBLIC_ROOTS = {"assets", "vendor"}
ZAI_RELAY_PATH = "/__labflow/zai/chat/completions"
ZAI_UPSTREAM = "https://api.z.ai/api/paas/v4/chat/completions"
MAX_RELAY_BODY = 16 * 1024 * 1024
UPSTREAM_TIMEOUT_SECONDS = 190
FORWARDED_RESPONSE_HEADERS = {
    "content-type",
    "cache-control",
    "retry-after",
    "x-request-id",
    "request-id",
}


class PublicHandler(SimpleHTTPRequestHandler):
    """Map a small public URL allowlist into the repository root."""

    def _cors_origin(self) -> str:
        origin = self.headers.get("Origin", "").strip()
        if origin == "null":
            return origin
        try:
            parsed = urlsplit(origin)
        except ValueError:
            return ""
        if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            return ""
        return origin

    def end_headers(self) -> None:
        origin = self._cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        relative = Path(unquote(urlsplit(path).path).lstrip("/"))
        if relative == Path("."):
            relative = Path("index.html")
        parts = relative.parts
        allowed_root = relative.name in {"index.html", "ui-kit.html"} or (parts and parts[0] in PUBLIC_ROOTS)
        safe = allowed_root and relative.suffix.lower() in PUBLIC_SUFFIXES and not any(part.startswith(".") for part in parts)
        candidate = (ROOT / relative).resolve()
        if not safe or ROOT not in candidate.parents:
            return str(ROOT / "__not_public__")
        return str(candidate)

    def _json_error(self, status: int, message: str) -> None:
        payload = json.dumps({"error": {"message": message}}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _forward_upstream_response(self, upstream, status: int) -> None:
        self.send_response(status)
        for key, value in upstream.headers.items():
            if key.lower() in FORWARDED_RESPONSE_HEADERS:
                self.send_header(key, value)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-LabFlow-Relay", "zai")
        self.end_headers()
        while True:
            chunk = upstream.read(64 * 1024)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()

    def _relay_zai(self) -> None:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            self._json_error(400, "Invalid Content-Length.")
            return
        if length <= 0:
            self._json_error(400, "Z.AI request body is empty.")
            return
        if length > MAX_RELAY_BODY:
            self._json_error(413, "Z.AI request body is too large.")
            return
        authorization = self.headers.get("Authorization", "").strip()
        if not authorization.lower().startswith("bearer "):
            self._json_error(401, "Z.AI API key is missing.")
            return
        body = self.rfile.read(length)
        headers = {
            "Authorization": authorization,
            "Content-Type": "application/json",
            "Accept-Language": self.headers.get("Accept-Language", "en-US,en"),
            "Accept": self.headers.get("Accept", "application/json, text/event-stream"),
            "User-Agent": "LabFlow/1.0 ZAI relay",
        }
        request = Request(ZAI_UPSTREAM, data=body, headers=headers, method="POST")
        try:
            with urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as upstream:
                self._forward_upstream_response(upstream, upstream.status)
        except HTTPError as error:
            self._forward_upstream_response(error, error.code)
        except URLError as error:
            self._json_error(502, f"Could not reach Z.AI: {error.reason}")
        except TimeoutError:
            self._json_error(504, "Z.AI request timed out at the LabFlow relay.")
        except BrokenPipeError:
            # The browser cancelled the request; no further response is possible.
            return

    def do_POST(self) -> None:
        if urlsplit(self.path).path == ZAI_RELAY_PATH:
            self._relay_zai()
            return
        self._json_error(404, "Unknown LabFlow API route.")

    def do_OPTIONS(self) -> None:
        if urlsplit(self.path).path != ZAI_RELAY_PATH or not self._cors_origin():
            self._json_error(403, "This relay accepts browser requests only from local LabFlow origins.")
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept-Language")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        """Keep browser-test output quiet unless a request fails."""
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), PublicHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
