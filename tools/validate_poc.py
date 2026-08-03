#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
errors = []
html_pages = sorted(ROOT.glob("*.html"))
required_pages = {"index.html", "project.html", "cabinet.html", "knowledge.html", "tools.html", "settings.html", "documentation.html", "ui-kit.html"}
required_assets = {
    "ui/ui.css", "ui/theme.css", "ui/theme-controller.js",
    "ui/foundations/tokens.css", "ui/themes/theme-base.css",
    "ui/themes/theme-dark.css", "ui/themes/theme-light.css", "ui/themes/palettes.css",
    "assets/js/data.js", "assets/js/pipeline-bundle.js", "assets/js/exporters.js",
    "assets/js/workbook.js", "assets/js/state.js", "assets/js/docs-bundle.js", "assets/js/app.js",
    "assets/js/settings-bundle.js", "settings.yaml", "tools/build_settings_bundle.py",
    "assets/js/knowledge-pages.js", "assets/js/tools-page.js", "assets/js/diagrams.js", "ui/components/knowledge-tools.css",
    "examples/theme-integration.html", "tools/build_page_shell.py",
}

entry_styles = [
    "ui/foundations/tokens.css", "ui/themes/theme-base.css", "ui/themes/theme-dark.css",
    "ui/themes/theme-light.css", "ui/themes/palettes.css", "ui/foundations/base.css",
    "ui/layout/shell.css", "ui/components/core.css", "ui/components/scientific.css",
    "ui/components/knowledge-tools.css", "ui/foundations/utilities.css", "ui/layout/responsive.css",
]
canonical_docs = {
    "PROJECT.md", "UI_UX_GUIDELINES.md", "PIPELINES_AND_DATA.md",
    "AI_REPORTS_AND_EXPORT.md", "THEME_INTEGRATION.md", "VALIDATION_CHECKLIST.md",
}

settings_path = ROOT / "settings.yaml"
try:
    settings_source = settings_path.read_text(encoding="utf-8")
    first_content_line = next((line.strip() for line in settings_source.splitlines() if line.strip() and not line.lstrip().startswith("#")), "")
    if first_content_line.startswith(("{", "[")):
        errors.append("settings.yaml must use native YAML block syntax, not JSON syntax")
    settings = yaml.safe_load(settings_source)
    if settings.get("appearance", {}).get("default_theme") != "light":
        errors.append("settings.yaml: default theme must be light")
    if any(settings.get("feature_flags", {}).get(key) for key in ("authentication", "browser_persistence", "external_requests", "tracking", "pwa")):
        errors.append("settings.yaml: static/privacy feature flags must remain disabled")
except Exception as exc:
    errors.append(f"settings.yaml could not be parsed: {exc}")

missing_pages = required_pages - {path.name for path in html_pages}
if missing_pages:
    errors.append(f"Missing HTML pages: {sorted(missing_pages)}")

for page in html_pages:
    text = page.read_text(encoding="utf-8")
    style_positions = [text.find(f'href="{asset}"') for asset in entry_styles]
    if any(position < 0 for position in style_positions):
        errors.append(f"{page.name}: canonical direct stylesheet set is incomplete")
    elif style_positions != sorted(style_positions):
        errors.append(f"{page.name}: direct stylesheets are not in canonical order")
    if text.find("ui/theme-controller.js") > min((position for position in style_positions if position >= 0), default=len(text)):
        errors.append(f"{page.name}: theme controller must load before CSS to prevent cross-page flicker")
    for marker in ('class="app-shell"', 'class="sidebar"', 'class="topbar"', 'id="page-content"'):
        if marker not in text:
            errors.append(f"{page.name}: checked-in application shell is missing {marker}")
    if re.search(r'<div\s+id="app"\s*>\s*</div>', text):
        errors.append(f"{page.name}: application root must not be empty")
    runtime_scripts = re.findall(r'<script(?![^>]*src="ui/theme-controller\.js")[^>]*>', text)
    if any(" defer" not in tag for tag in runtime_scripts):
        errors.append(f"{page.name}: runtime scripts must use defer")
    if re.search(r"https?://", text):
        errors.append(f"{page.name}: external URL found in runtime HTML")
    for ref in re.findall(r'(?:src|href)="([^"]+)"', text):
        if ref.startswith(("#", "mailto:", "http")):
            continue
        target = ROOT / ref.split("?")[0].split("#")[0]
        if not target.exists():
            errors.append(f"{page.name}: broken local reference {ref}")
    for asset in ("ui/theme-controller.js", "assets/js/state.js", "assets/js/app.js"):
        if asset not in text:
            errors.append(f"{page.name}: required shared asset missing: {asset}")

for asset in required_assets:
    if not (ROOT / asset).exists():
        errors.append(f"Missing shared asset: {asset}")

if not (ROOT / ".nojekyll").exists():
    errors.append("Missing .nojekyll for direct GitHub Pages delivery")

actual_docs = {path.name for path in (ROOT / "docs").glob("*.md")}
if actual_docs != canonical_docs:
    errors.append(f"Canonical docs mismatch: expected {sorted(canonical_docs)}, found {sorted(actual_docs)}")

for forbidden in ("manifest.json", "manifest.webmanifest", "service-worker.js", "sw.js"):
    if any(path.name == forbidden for path in ROOT.rglob("*")):
        errors.append(f"Forbidden PWA artifact found: {forbidden}")

runtime_sources = [*html_pages, ROOT / "assets/js/app.js", ROOT / "assets/js/state.js", ROOT / "assets/js/knowledge-pages.js", ROOT / "assets/js/tools-page.js", ROOT / "assets/js/diagrams.js", ROOT / "ui/theme-controller.js"]
privacy_patterns = {
    "persistent browser storage": r"\b(?:localStorage|sessionStorage|indexedDB|cookieStore)\b|document\.cookie",
    "service worker registration": r"serviceWorker\s*\.",
    "automatic network API": r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|sendBeacon\s*\(",
    "tracking API": r"\b(?:gtag|ga|analytics|tracker)\s*\(",
}
for source in runtime_sources:
    text = source.read_text(encoding="utf-8")
    for label, pattern in privacy_patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            errors.append(f"{source.relative_to(ROOT)}: forbidden {label}")

app_source = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
if re.search(r'href=["\'`]?(?:[^"\'`]*\.(?:css|js|ya?ml|json|webmanifest|md))', app_source, re.IGNORECASE):
    errors.append("app.js: product UI exposes a raw technical file link")

css = "\n".join(path.read_text(encoding="utf-8") for path in (ROOT / "ui").rglob("*.css"))
if "transition:all" in css.replace(" ", ""):
    errors.append("CSS uses forbidden transition: all")

workbook = (ROOT / "assets/js/workbook.js").read_text(encoding="utf-8")
for sheet in ["Dashboard", "Project", "Solutions", "Stack", "Raw Data", "Processed Data", "Analysis", "AI Findings", "Provenance", "Export Manifest"]:
    if f'["{sheet}"' not in workbook:
        errors.append(f"Workbook sheet definition missing: {sheet}")

docs_bundle = (ROOT / "assets/js/docs-bundle.js").read_text(encoding="utf-8")
for source in [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md"))]:
    if source.relative_to(ROOT).as_posix() not in docs_bundle:
        errors.append(f"Documentation bundle missing {source.relative_to(ROOT)}")

settings_bundle = (ROOT / "assets/js/settings-bundle.js").read_text(encoding="utf-8")
expected_settings_bundle = "window.LabFlowConfig=" + json.dumps(settings, ensure_ascii=False, separators=(",", ":")) + ";\n"
if settings_bundle != expected_settings_bundle:
    errors.append("Settings bundle is not synchronized with settings.yaml")

for page in html_pages:
    text = page.read_text(encoding="utf-8")
    if 'data-theme="light"' not in text:
        errors.append(f"{page.name}: checked-in content theme must default to light")

pipeline_ids = set()
for source in sorted((ROOT / "pipelines").glob("*/pipeline.yaml")):
    data = yaml.safe_load(source.read_text(encoding="utf-8"))
    for key in ["id", "name", "version", "description", "project_type", "steps"]:
        if key not in data:
            errors.append(f"{source}: missing {key}")
    if data.get("id") in pipeline_ids:
        errors.append(f"Duplicate pipeline id {data.get('id')}")
    pipeline_ids.add(data.get("id"))
    for index, step in enumerate(data.get("steps", []), 1):
        for key in ["id", "title", "short_title", "view", "description", "output"]:
            if key not in step:
                errors.append(f"{source}: step {index} missing {key}")

if errors:
    print("VALIDATION FAILED")
    print("\n".join(f" - {error}" for error in errors))
    sys.exit(1)
print(f"VALIDATION OK: {len(html_pages)} pages, {len(pipeline_ids)} pipelines, volatile state and no external runtime requests")
