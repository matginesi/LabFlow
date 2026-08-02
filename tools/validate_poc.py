#!/usr/bin/env python3
"""Fast structural guardrails for the LabFlow static POC.

No third-party Python dependencies are required. This validator does not replace
browser testing; it catches architecture regressions that previously caused the
POC to drift between incompatible UI/workflow models.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def parse_pipeline(path: Path) -> dict:
    """Parse only the small YAML subset intentionally used by LabFlow."""
    data: dict = {"steps": []}
    current = None
    in_steps = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = re.sub(r"\s+#.*$", "", raw)
        if not line.strip():
            continue
        if re.fullmatch(r"steps:\s*", line):
            in_steps = True
            continue
        item = re.match(r"^\s*-\s+([\w-]+):\s*(.+)$", line)
        if in_steps and item:
            current = {item.group(1): item.group(2).strip().strip("'\"")}
            data["steps"].append(current)
            continue
        nested = re.match(r"^\s+([\w-]+):\s*(.+)$", line)
        if in_steps and current is not None and nested:
            current[nested.group(1)] = nested.group(2).strip().strip("'\"")
            continue
        root = re.match(r"^([\w-]+):\s*(.+)$", line)
        if root:
            data[root.group(1)] = root.group(2).strip().strip("'\"")
    return data


# 1. Every root page must use exactly the same shared CSS and pipeline loader.
for html in sorted(ROOT.glob("*.html")):
    text = html.read_text(encoding="utf-8")
    app_css_count = len(re.findall(r'href=["\']assets/app\.css["\']', text))
    if app_css_count != 1:
        fail(f"{html.name}: expected exactly one assets/app.css link, found {app_css_count}")
    theme_init_count = len(re.findall(r'src=["\']assets/theme-init\.js["\']', text))
    if theme_init_count != 1:
        fail(f"{html.name}: expected exactly one assets/theme-init.js script, found {theme_init_count}")
    if "labflow-admin-appearance" in re.sub(r'<script[^>]+src=[^>]+></script>', '', text, flags=re.S | re.I):
        fail(f"{html.name}: appearance bootstrap must live in assets/theme-init.js, not inline HTML")
    for forbidden in ("assets/theme.css", "assets/workflow.css", "pipelines/chose/pipeline.css"):
        if forbidden in text:
            fail(f"{html.name}: references removed shared stylesheet {forbidden}")
    if "assets/app.js" in text:
        bundle = text.find("assets/pipeline-bundle.js")
        loader = text.find("assets/pipeline-loader.js")
        app = text.find("assets/app.js")
        if bundle < 0 or loader < 0 or not (bundle < loader < app):
            fail(f"{html.name}: pipeline-bundle.js -> pipeline-loader.js -> app.js order is required")
    compatibility_routes = {"processes.html", "pipeline.html", "experiments.html", "experiment.html", "stack.html", "solution.html"}
    if html.name not in compatibility_routes and "assets/compatibility-domain.js" in text:
        fail(f"{html.name}: primary route loads quarantined Process/Experiment compatibility model")
    if html.name in compatibility_routes and "assets/compatibility-domain.js" not in text:
        fail(f"{html.name}: compatibility route must load assets/compatibility-domain.js")

# 2. app.js must not contain duplicated pipeline metadata or HTML view bundles.
app_js = (ROOT / "assets/app.js").read_text(encoding="utf-8")
for forbidden in ("const pipelineMetadata=", "LabFlowPipelineViews", "views['chose/", 'views["chose/'):
    if forbidden in app_js:
        fail(f"assets/app.js: duplicated Pipeline source detected: {forbidden}")

# Primary navigation must not route to compatibility Process/Experiment pages.
nav_match = re.search(r"function buildNavigation\(project\)\{(.+?)\n  \}\n", app_js, re.S)
if not nav_match:
    fail("assets/app.js: buildNavigation(project) not found")
else:
    nav = nav_match.group(1)
    for legacy in ("processes.html", "pipeline.html", "experiments.html", "experiment.html"):
        if legacy in nav:
            fail(f"Primary navigation links to compatibility page {legacy}")


# 2a. Generated static Pipeline bundle must match canonical YAML + step HTML.
bundle_check = subprocess.run(
    [sys.executable, str(ROOT / "tools" / "sync_pipeline_bundle.py"), "--check"],
    cwd=ROOT,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
)
if bundle_check.returncode != 0:
    fail("assets/pipeline-bundle.js is stale: " + bundle_check.stdout.strip())

docs_check = subprocess.run(
    [sys.executable, str(ROOT / "tools" / "sync_docs_bundle.py"), "--check"],
    cwd=ROOT,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
)
if docs_check.returncode != 0:
    fail("assets/docs-bundle.js is stale: " + docs_check.stdout.strip())
if 'assets/docs-bundle.js' not in (ROOT / 'documentation.html').read_text(encoding='utf-8'):
    fail('documentation.html: generated documentation bundle must be loaded')
if 'data-doc-file=' not in (ROOT / 'documentation.html').read_text(encoding='utf-8'):
    fail('documentation.html: repository guides must render inside the documentation surface')

# Runtime must remain fetch-free; LabFlow is a GitHub Pages static POC.
for runtime_name in ("app.js", "pipeline-loader.js"):
    runtime_text = (ROOT / "assets" / runtime_name).read_text(encoding="utf-8")
    runtime_code = re.sub(r"/\*.*?\*/|//.*?$", "", runtime_text, flags=re.S | re.M)
    if re.search(r"\bfetch\s*\(", runtime_code):
        fail(f"assets/{runtime_name}: runtime fetch() is forbidden; use the generated static Pipeline bundle")

# 3. Pipeline definitions must resolve to real assets and carry a visual identity.
for yaml_path in sorted((ROOT / "pipelines").glob("*/pipeline.yaml")):
    pipeline = parse_pipeline(yaml_path)
    if not pipeline.get("id") or not pipeline.get("name"):
        fail(f"{yaml_path.relative_to(ROOT)}: missing id/name")
    if not pipeline["steps"]:
        fail(f"{yaml_path.relative_to(ROOT)}: no steps")
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', pipeline.get('accent','')):
        fail(f"{yaml_path.relative_to(ROOT)}: Pipeline accent must be a #RRGGBB colour")
    base = yaml_path.parent
    pipeline_js = pipeline.get("js")
    if pipeline_js and not (base / pipeline_js).is_file():
        fail(f"{yaml_path.relative_to(ROOT)}: missing pipeline JS {pipeline_js}")
    for index, step in enumerate(pipeline["steps"], 1):
        for key in ("id", "title", "html"):
            if not step.get(key):
                fail(f"{yaml_path.relative_to(ROOT)} step {index}: missing {key}")
        if step.get("css"):
            fail(f"{yaml_path.relative_to(ROOT)} step {step.get('id', index)}: Pipeline/page CSS is forbidden; use assets/styles/")
        for key in ("html", "js"):
            asset = step.get(key)
            if asset and not (base / asset).is_file():
                fail(f"{yaml_path.relative_to(ROOT)} step {step.get('id', index)}: missing {key} asset {asset}")

# 4. CSS/UI Kit contract.
css_files = sorted(ROOT.rglob("*.css"))
allowed_css_root = ROOT / "assets" / "styles"
for css in css_files:
    rel = css.relative_to(ROOT)
    if css != ROOT / "assets" / "app.css" and allowed_css_root not in css.parents:
        fail(f"{rel}: page/feature/Pipeline stylesheets are forbidden; use assets/styles/")
    text = css.read_text(encoding="utf-8")
    if not text.lstrip().startswith("/**"):
        fail(f"{rel}: CSS file must begin with a documentation block")

manifest = (ROOT / "assets" / "app.css").read_text(encoding="utf-8")
required_modules = (
    "feature-foundations.css", "feature-workflows.css", "feature-workspace.css", "feature-reports-ai.css",
    "feature-scientific-workbench.css", "tokens.css", "base.css", "layout.css", "shell.css",
    "components.css", "scientific.css", "utilities.css", "responsive.css",
)
for module in required_modules:
    if f'styles/{module}' not in manifest:
        fail(f"assets/app.css: missing shared design-system module {module}")

# Core primitives have one canonical owner. Feature modules may compose or
# contextualise them (e.g. `.home-card .button`) but may not provide another
# direct implementation of the primitive itself.
owners = {
    ".topbar": ("shell.css", set()),
    ".sidebar": ("shell.css", set()),
    ".nav-link": ("shell.css", set()),
    ".page-header": ("layout.css", set()),
    ".button": ("components.css", {"shell.css"}),
    ".input": ("components.css", {"shell.css"}),
    ".panel": ("components.css", set()),
}
for selector, (owner, contextual) in owners.items():
    for css in sorted(allowed_css_root.glob("*.css")):
        if css.name in {owner, "responsive.css", *contextual}:
            continue
        body = re.sub(r"/\*.*?\*/", "", css.read_text(encoding="utf-8"), flags=re.S)
        direct = re.compile(rf"(?m)^\s*{re.escape(selector)}\s*(?:,|\{{)")
        if direct.search(body):
            fail(f"assets/styles/{css.name}: direct core selector {selector} belongs in {owner}")

# Tiny interface copy was a major source of visual drift. Data visualisations
# can scale geometry, but ordinary CSS text must never fall below 10px.
for css in sorted(allowed_css_root.glob("*.css")):
    body = re.sub(r"/\*.*?\*/", "", css.read_text(encoding="utf-8"), flags=re.S)
    for match in re.finditer(r"font-size\s*:\s*([0-9.]+)px", body):
        if float(match.group(1)) < 10:
            fail(f"assets/styles/{css.name}: font-size below 10px violates UI Kit readability floor")
    for match in re.finditer(r"font\s*:[^;{}]*?([0-9.]+)px(?:/|\s)", body):
        if float(match.group(1)) < 10:
            fail(f"assets/styles/{css.name}: font shorthand below 10px violates UI Kit readability floor")

ui_kit = (ROOT / "ui-kit.html").read_text(encoding="utf-8")
for marker in ("GROUND TRUTH", "Core sizing contract", "assets/app.css"):
    if marker not in ui_kit:
        fail(f"ui-kit.html: missing UI ground-truth marker {marker!r}")

if list(ROOT.glob("pipelines/**/*.css")):
    fail("Pipeline CSS exists; all visual styling must be shared under assets/styles/")

# 4a. Current UI standards: flat scientific graphics, compact shell and docs.
ui_standards = ROOT / "docs" / "UI_STANDARDS.md"
if not ui_standards.is_file():
    fail("docs/UI_STANDARDS.md missing")

scientific_css = (ROOT / "assets" / "styles" / "scientific.css").read_text(encoding="utf-8")
if not all(token in scientific_css for token in ("2D scientific builders", ".solution-composition-bar", ".stack-band")):
    fail("assets/styles/scientific.css: canonical 2D solution/stack visuals missing")
for css in sorted(allowed_css_root.glob("*.css")):
    body = re.sub(r"/\*.*?\*/", "", css.read_text(encoding="utf-8"), flags=re.S)
    if re.search(r"(?:rotateX|rotateY|rotate3d|translateZ)\s*\(|preserve-3d", body, re.I):
        fail(f"assets/styles/{css.name}: 3D transform found; scientific/UI graphics must remain 2D")

if "Global scrollbars" not in (ROOT / "assets" / "styles" / "base.css").read_text(encoding="utf-8"):
    fail("assets/styles/base.css: global themed scrollbar contract missing")

nav_match = re.search(r"function buildNavigation\(project\)\{(.+?)\n  \}\n", app_js, re.S)
if nav_match:
    compact_nav = nav_match.group(1)
    for duplicate in ("label:'Projects'", "label:'Admin Settings'"):
        if duplicate in compact_nav:
            fail(f"assets/app.js: sidebar contains redundant destination {duplicate}")

# 5. Compatibility pages must say what they are.
for name in ("processes.html", "pipeline.html", "experiments.html", "experiment.html"):
    text = (ROOT / name).read_text(encoding="utf-8")
    if "compatibility-notice" not in text:
        fail(f"{name}: missing compatibility notice")

# 6. Cabinet and Project examples must initialise with meaningful demo data.
demo_seed = (ROOT / 'assets/demo-projects.js').read_text(encoding='utf-8')
for marker in ("put('mixed'", "put('annealing'", "put('thickness'", "put('solvent-ratio'", "MEAS-JV-B", "STACK-MIX-B"):
    if marker not in demo_seed:
        fail(f"assets/demo-projects.js: missing cross-Pipeline demo marker {marker}")
cabinet = (ROOT / "assets/cabinet-store.js").read_text(encoding="utf-8")
if "return write(clone(seed))" not in cabinet:
    fail("assets/cabinet-store.js: first-run Cabinet must initialise from seed")

# 7. Project Pipeline completion and export surfaces must have explicit final states.
for required in ("pipelineCompleted", "Complete Pipeline", "const progress=project.pipelineCompleted?100"):
    if required not in app_js:
        fail(f"assets/app.js: missing Pipeline completion contract marker: {required}")
exporters = (ROOT / 'assets/exporters.js').read_text(encoding='utf-8')
for marker in ('buildXlsx', 'buildDocx', 'buildSummaryPdf', 'exportAppearance'):
    if marker not in exporters:
        fail(f"assets/exporters.js: missing themed export capability {marker}")
for marker in ('report-pdf', 'report-docx', 'report-xlsx'):
    if marker not in app_js:
        fail(f"assets/app.js: missing report export action {marker}")

# Structural inline margins are a sign that shared UI classes are being bypassed.
for html in sorted(ROOT.glob("*.html")):
    text = html.read_text(encoding="utf-8")
    if re.search(r'style=["\'][^"\']*margin-(?:top|bottom|left|right)\s*:', text):
        fail(f"{html.name}: structural inline margin found; use a shared utility/component class")
    for style in re.findall(r'style=["\']([^"\']*)["\']', text):
        if re.search(r'(?:^|;)\s*(?:background|color|border(?:-[a-z]+)?|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|font(?:-[a-z]+)?|display|position|top|right|bottom|left)\s*:', style):
            fail(f"{html.name}: static visual inline style found; move appearance/layout to shared CSS")

# 8. General hygiene checks.
if not (ROOT / "AGENTS.md").is_file():
    fail("AGENTS.md missing")
if "Workspace → Project → Pipeline → Step" not in (ROOT / "AGENTS.md").read_text(encoding="utf-8"):
    fail("AGENTS.md: canonical hierarchy missing")

for message in warnings:
    print(f"WARNING: {message}")
if errors:
    print("\nLabFlow validation FAILED:\n")
    for message in errors:
        print(f" - {message}")
    sys.exit(1)

print(f"LabFlow validation OK: {len(list(ROOT.glob('*.html')))} root pages, {len(css_files)} CSS files, {len(list((ROOT/'pipelines').glob('*/pipeline.yaml')))} pipelines checked.")
