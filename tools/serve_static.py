#!/usr/bin/env python3
"""Serve only LabFlow's public browser files for local development tests.

Unlike ``python -m http.server``, this handler refuses dotfiles, Python,
documentation, test sources and repository metadata, so `.env` and its API key
can never be fetched by a browser client.
"""
from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SUFFIXES = {".html", ".css", ".js", ".json", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".woff", ".woff2"}
PUBLIC_ROOTS = {"assets", "vendor"}


class PublicHandler(SimpleHTTPRequestHandler):
    """Map a small public URL allowlist into the repository root."""

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

    def log_message(self, format: str, *args: object) -> None:
        """Keep browser-test output quiet unless a request fails."""
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(format, *args)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
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
