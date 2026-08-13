#!/usr/bin/env python3
"""Fail when LabFlow's local-first runtime privacy boundary is weakened."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_FILES = (ROOT / "index.html", ROOT / "ui-kit.html")
FETCH_OWNER = Path("assets/js/ai/transport.js")
FORBIDDEN_APIS = {
    "document.cookie": re.compile(r"document\s*\.\s*cookie"),
    "cookie capability probe": re.compile(r"navigator\s*\.\s*cookieEnabled"),
    "sendBeacon": re.compile(r"\bsendBeacon\s*\("),
    "service worker": re.compile(r"serviceWorker\s*\.\s*register\s*\("),
    "WebSocket": re.compile(r"\bnew\s+WebSocket\s*\("),
    "EventSource": re.compile(r"\bnew\s+EventSource\s*\("),
}
TRACKER_MARKERS = (
    "google-analytics", "googletagmanager", "gtag(", "segment.com",
    "mixpanel", "hotjar", "fullstory", "posthog.capture", "clarity.ms",
    "facebook.net", "doubleclick.net",
)


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def validate_html(errors: list[str]) -> None:
    remote_asset = re.compile(
        r"<(?:script|link|img|iframe|source)\b[^>]*(?:src|href)\s*=\s*['\"](?:https?:)?//",
        re.IGNORECASE,
    )
    for path in HTML_FILES:
        text = path.read_text(encoding="utf-8")
        if remote_asset.search(text):
            fail(errors, f"{path.relative_to(ROOT)} loads a remote runtime asset")
        if 'meta name="referrer" content="no-referrer"' not in text:
            fail(errors, f"{path.relative_to(ROOT)} is missing the no-referrer policy")
        if 'assets/js/ui/icons.js' not in text:
            fail(errors, f"{path.relative_to(ROOT)} does not load the local icon set")


def validate_javascript(errors: list[str]) -> None:
    fetch_files: list[Path] = []
    for path in sorted((ROOT / "assets").rglob("*.js")):
        relative = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        if re.search(r"\bfetch\s*\(", text):
            fetch_files.append(relative)
        for label, pattern in FORBIDDEN_APIS.items():
            if pattern.search(text):
                fail(errors, f"{relative} uses forbidden {label}")
        lowered = text.lower()
        for marker in TRACKER_MARKERS:
            if marker in lowered:
                fail(errors, f"{relative} contains tracker marker {marker!r}")

    if fetch_files != [FETCH_OWNER]:
        fail(errors, f"fetch owners must be [{FETCH_OWNER}], found {fetch_files}")

    transport = (ROOT / FETCH_OWNER).read_text(encoding="utf-8")
    for contract in ("credentials:'omit'", "cache:'no-store'"):
        if contract not in transport:
            fail(errors, f"AI transport is missing {contract}")


def validate_local_assets(errors: list[str]) -> None:
    required = (
        ROOT / "assets/js/ui/icons.js",
        ROOT / "assets/icons/labflow-favicon.svg",
        ROOT / "vendor/lucide/LICENSE",
        ROOT / "vendor/lucide/NOTICE.txt",
        ROOT / "vendor/report-export/NOTICE.txt",
        ROOT / "LICENSE",
        ROOT / "docs/PRIVACY.md",
    )
    for path in required:
        if not path.is_file():
            fail(errors, f"missing local/privacy asset: {path.relative_to(ROOT)}")

    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    if ".env" not in {line.strip() for line in gitignore}:
        fail(errors, ".gitignore must exclude .env")
    env_file = ROOT / ".env"
    if env_file.exists() and env_file.stat().st_mode & 0o077:
        fail(errors, ".env must not grant group/other filesystem permissions (use chmod 600)")


def main() -> int:
    errors: list[str] = []
    validate_html(errors)
    validate_javascript(errors)
    validate_local_assets(errors)
    if errors:
        print("Privacy contract FAILED:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Privacy contract OK: local assets, one explicit provider transport, no tracker APIs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
