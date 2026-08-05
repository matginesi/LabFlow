#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
errors = []
html_pages = sorted(ROOT.glob("*.html"))
required_pages = {"index.html", "project.html", "cabinet.html", "knowledge.html", "robotics.html", "tools.html", "settings.html", "pipeline-studio.html", "documentation.html", "ui-kit.html"}
required_assets = {
    "ui/theme.css", "ui/theme-controller.js", "ui/labflow.bundle.css",
    "ui/foundations/tokens.css", "ui/themes/theme-base.css",
    "ui/themes/theme-dark.css", "ui/themes/theme-light.css", "ui/themes/palettes.css",
    "assets/js/data.js", "assets/js/pipeline-bundle.js", "assets/js/pipeline-runtime.js", "assets/js/exporters.js", "assets/js/runtime.js",
    "assets/js/workbook.js", "assets/js/state.js", "assets/js/docs-bundle.js", "assets/js/app.js",
    "assets/js/settings-bundle.js", "settings.yaml", "tools/build_settings_bundle.py",
    "assets/js/knowledge-pages.js", "assets/js/robotics.js", "assets/js/robotics-bundle.js", "assets/js/tools-page.js", "assets/js/pipeline-studio.js", "assets/js/diagrams.js", "ui/components/knowledge-tools.css", "ui/components/robotics.css",
    "examples/theme-integration.html", "examples/ai-foundation/dataset-snapshot.yaml", "examples/ai-foundation/model-card.yaml",
    "examples/ai-foundation/prediction-record.json", "examples/ai-foundation/rag-evaluation.yaml",
    "tools/build_page_shell.py", "tools/build_frontend_bundles.py", "tools/build_robotics_bundle.py", "robotics/robot-arm-01.yaml",
}

entry_styles = ["ui/labflow.bundle.css"]
canonical_docs = {
    "PROJECT.md", "UI_UX_GUIDELINES.md", "PIPELINE_CATALOG.md", "PIPELINE_CHOSE.md", "PIPELINE_QUICK.md", "PIPELINES_AND_DATA.md",
    "AI_ML_FOUNDATION.md", "AI_REPORTS_AND_EXPORT.md", "ROBOTICS.md", "THEME_INTEGRATION.md", "JAVASCRIPT_LOGGING.md", "VALIDATION_CHECKLIST.md",
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
    for asset in ("ui/theme-controller.js", "assets/js/runtime.js", "assets/js/app.js"):
        if asset not in text:
            errors.append(f"{page.name}: required shared asset missing: {asset}")

for asset in required_assets:
    if not (ROOT / asset).exists():
        errors.append(f"Missing shared asset: {asset}")

page_script_contracts = {
    "project.html": ["assets/js/runtime.js", "assets/js/workbook.js", "assets/js/app.js"],
    "knowledge.html": ["assets/js/runtime.js", "assets/js/diagrams.js", "assets/js/knowledge-pages.js", "assets/js/app.js"],
    "robotics.html": ["assets/js/runtime.js", "assets/js/robotics-bundle.js", "assets/js/robotics.js", "assets/js/app.js"],
    "tools.html": ["assets/js/runtime.js", "assets/js/workbook.js", "assets/js/diagrams.js", "assets/js/tools-page.js", "assets/js/app.js"],
    "documentation.html": ["assets/js/runtime.js", "assets/js/docs-bundle.js", "assets/js/diagrams.js", "assets/js/app.js"],
    "pipeline-studio.html": ["assets/js/runtime.js", "assets/js/pipeline-studio.js", "assets/js/app.js"],
    "ui-kit.html": ["assets/js/runtime.js", "assets/js/workbook.js", "assets/js/app.js"],
}
for page_name, scripts in page_script_contracts.items():
    source = (ROOT / page_name).read_text(encoding="utf-8")
    positions = [source.find(f'src="{script}"') for script in scripts]
    if any(position < 0 for position in positions):
        errors.append(f"{page_name}: page-specific script contract is incomplete: {scripts}")
    elif positions != sorted(positions):
        errors.append(f"{page_name}: page-specific scripts are not in dependency order")

ui_kit_source = (ROOT / "ui-kit.html").read_text(encoding="utf-8")
if ui_kit_source.find('assets/js/workbook.js') < 0 or ui_kit_source.find('assets/js/workbook.js') > ui_kit_source.find('assets/js/app.js'):
    errors.append("ui-kit.html: workbook.js must load before app.js for the report preview")

for source in [ROOT / "assets/js/app.js", ROOT / "assets/js/pipeline-runtime.js", ROOT / "assets/js/state.js", ROOT / "assets/js/exporters.js", ROOT / "assets/js/workbook.js", ROOT / "assets/js/knowledge-pages.js", ROOT / "assets/js/robotics.js", ROOT / "assets/js/tools-page.js", ROOT / "assets/js/pipeline-studio.js", ROOT / "assets/js/diagrams.js"]:
    text = source.read_text(encoding="utf-8")
    if re.search(r"\bconsole\.(?:log|info|warn|error|debug)\s*\(", text):
        errors.append(f"{source.relative_to(ROOT)}: use LabFlowLogger instead of direct console calls")

if not (ROOT / ".nojekyll").exists():
    errors.append("Missing .nojekyll for direct GitHub Pages delivery")

actual_docs = {path.name for path in (ROOT / "docs").glob("*.md")}
if actual_docs != canonical_docs:
    errors.append(f"Canonical docs mismatch: expected {sorted(canonical_docs)}, found {sorted(actual_docs)}")

for forbidden in ("manifest.json", "manifest.webmanifest", "service-worker.js", "sw.js"):
    if any(path.name == forbidden for path in ROOT.rglob("*")):
        errors.append(f"Forbidden PWA artifact found: {forbidden}")

runtime_sources = [*html_pages, ROOT / "assets/js/app.js", ROOT / "assets/js/pipeline-runtime.js", ROOT / "assets/js/runtime.js", ROOT / "assets/js/state.js", ROOT / "assets/js/knowledge-pages.js", ROOT / "assets/js/robotics.js", ROOT / "assets/js/tools-page.js", ROOT / "assets/js/pipeline-studio.js", ROOT / "assets/js/diagrams.js", ROOT / "ui/theme-controller.js"]
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
pipeline_runtime_source = (ROOT / "assets/js/pipeline-runtime.js").read_text(encoding="utf-8")
validator_block_match = re.search(r"const validators = \{(.*?)\n  \};", pipeline_runtime_source, re.DOTALL)
implemented_pipeline_validators = set(re.findall(r"^    ([a-z][a-z0-9_]+)\(", validator_block_match.group(1), re.MULTILINE)) if validator_block_match else set()
if not implemented_pipeline_validators:
    errors.append("pipeline-runtime.js: validator registry could not be inspected")
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

robotics_source = ROOT / "robotics/robot-arm-01.yaml"
try:
    robotics = yaml.safe_load(robotics_source.read_text(encoding="utf-8"))
    if len(robotics.get("joints", [])) != 3:
        errors.append("robot-arm-01.yaml: the POC must define exactly three joints")
    expected_robotics_bundle = "/* Generated from robotics/robot-arm-01.yaml. Do not edit by hand. */\nwindow.LabFlowRoboticsConfig=" + json.dumps(robotics, ensure_ascii=False, separators=(",", ":")) + ";\n"
    if (ROOT / "assets/js/robotics-bundle.js").read_text(encoding="utf-8") != expected_robotics_bundle:
        errors.append("Robotics bundle is not synchronized with robotics/robot-arm-01.yaml")
except Exception as exc:
    errors.append(f"robot-arm-01.yaml could not be parsed: {exc}")

pipeline_ids = set()
built_pipelines = {}
built_pipeline_sources = {}
known_chose_components = {
    "chose.process.chemistry", "chose.process.fabrication", "chose.process.stack_review",
    "chose.experiment.setup", "chose.experiment.execution", "chose.experiment.summary",
    "chose.results.files", "chose.results.mapping", "chose.results.quality",
    "chose.review.overview", "chose.review.compare", "chose.review.findings", "chose.review.report_export",
}
try:
    sys.path.insert(0, str(ROOT / "tools"))
    from build_pipeline_bundle import build_pipeline, source_registry
except Exception as exc:
    build_pipeline = None
    errors.append(f"Pipeline builder could not be imported: {exc}")

for source in sorted((ROOT / "pipelines").glob("*/pipeline.yaml")):
    try:
        data = yaml.safe_load(source.read_text(encoding="utf-8"))
        built = build_pipeline(source) if build_pipeline else data
    except Exception as exc:
        errors.append(f"{source.relative_to(ROOT)} could not be resolved: {exc}")
        continue
    for key in ["id", "name", "version", "description", "project_type", "steps"]:
        if key not in data:
            errors.append(f"{source.relative_to(ROOT)}: missing {key}")
    pipeline_id = data.get("id")
    if pipeline_id in pipeline_ids:
        errors.append(f"Duplicate pipeline id {pipeline_id}")
    pipeline_ids.add(pipeline_id)
    built_pipelines[pipeline_id] = built
    if build_pipeline:
        built_pipeline_sources[pipeline_id] = source_registry(source)
    step_ids = set()
    for index, step in enumerate(data.get("steps", []), 1):
        for key in ["id", "title", "short_title", "view", "description", "output"]:
            if key not in step:
                errors.append(f"{source.relative_to(ROOT)}: step {index} missing {key}")
        if step.get("id") in step_ids:
            errors.append(f"{source.relative_to(ROOT)}: duplicate step id {step.get('id')}")
        step_ids.add(step.get("id"))

    if pipeline_id != "chose":
        continue

    for key in ["schema_version", "domain", "compatibility", "runtime", "entities", "resource_refs", "data_boundaries", "review_policy", "exports"]:
        if key not in data:
            errors.append(f"pipelines/chose/pipeline.yaml: missing executable contract key {key}")
    if data.get("schema_version") != "labflow.pipeline.v1":
        errors.append("CHOSE pipeline must use schema_version labflow.pipeline.v1")
    if data.get("compatibility", {}).get("remote_requests") is not False:
        errors.append("CHOSE pipeline compatibility.remote_requests must remain false")
    if data.get("runtime", {}).get("resource_loading") != "build-time-bundled":
        errors.append("CHOSE pipeline resources must be build-time bundled")
    if data.get("runtime", {}).get("component_registry") != "strict":
        errors.append("CHOSE pipeline must use the strict component registry")
    if data.get("runtime", {}).get("modules") != ["assets/js/pipeline-runtime.js", "assets/js/app.js"]:
        errors.append("CHOSE runtime modules must load pipeline-runtime.js before app.js")
    if data.get("contract", {}).get("strict") is not True or data.get("contract", {}).get("fail_closed_completion") is not True:
        errors.append("CHOSE contract must be strict and fail-closed")

    expected_groups = {
        "schemas": {"process", "experiment", "results", "review"},
        "defaults": {"solution_types", "operation_types", "units"},
        "mappings": {"jv", "nomad"},
        "demo": {"process", "experiment", "results", "review"},
    }
    for group, expected_keys in expected_groups.items():
        refs = data.get("resource_refs", {}).get(group, {})
        resources = built.get("resources", {}).get(group, {})
        if set(refs) != expected_keys:
            errors.append(f"CHOSE resource_refs.{group} must contain {sorted(expected_keys)}")
        if set(resources) != expected_keys:
            errors.append(f"CHOSE bundled resources.{group} must contain {sorted(expected_keys)}")
        for key, document in resources.items():
            if not isinstance(document, dict):
                errors.append(f"CHOSE resource {group}.{key} must resolve to a mapping")
            elif not str(document.get("schema_version", "")).startswith("labflow."):
                errors.append(f"CHOSE resource {group}.{key} is missing a LabFlow schema_version")

    if [step.get("id") for step in data.get("steps", [])] != ["process", "experiment", "results", "review"]:
        errors.append("CHOSE pipeline step order must be process, experiment, results, review")
    seen_components = set()
    for step in data.get("steps", []):
        for key in ["reads", "creates", "sections", "completion"]:
            if not step.get(key):
                errors.append(f"CHOSE step {step.get('id')} must define {key}")
        section_ids = set()
        for section in step.get("sections", []):
            for key in ["id", "title", "component", "description"]:
                if not section.get(key):
                    errors.append(f"CHOSE step {step.get('id')} section is missing {key}")
            if section.get("id") in section_ids:
                errors.append(f"CHOSE step {step.get('id')} has duplicate section id {section.get('id')}")
            section_ids.add(section.get("id"))
            component = section.get("component")
            seen_components.add(component)
            if component not in known_chose_components:
                errors.append(f"CHOSE section component is not registered: {component}")
        completion = step.get("completion", {})
        for key in ["label", "mode", "requires", "rules", "expected_evidence"]:
            if not completion.get(key):
                errors.append(f"CHOSE step {step.get('id')} completion is missing {key}")
        rule_ids = set()
        for rule in completion.get("rules", []):
            for key in ["id", "validator", "severity"]:
                if not rule.get(key):
                    errors.append(f"CHOSE step {step.get('id')} completion rule is missing {key}")
            if rule.get("severity") not in {"error", "warning", "information"}:
                errors.append(f"CHOSE step {step.get('id')} has unsupported severity {rule.get('severity')}")
            if rule.get("id") in rule_ids:
                errors.append(f"CHOSE step {step.get('id')} has duplicate rule id {rule.get('id')}")
            if rule.get("validator") not in implemented_pipeline_validators:
                errors.append(f"CHOSE step {step.get('id')} references unimplemented validator {rule.get('validator')}")
            rule_ids.add(rule.get("id"))
        contract = step.get("contract", {})
        for key in ["schema_ref", "demo_ref", "depends_on"]:
            if key not in contract:
                errors.append(f"CHOSE step {step.get('id')} contract is missing {key}")
        for ref_key in ["schema_ref", "demo_ref"]:
            ref = contract.get(ref_key, "")
            group, _, resource_key = ref.partition(".")
            if not group or not resource_key or resource_key not in built.get("resources", {}).get(group, {}):
                errors.append(f"CHOSE step {step.get('id')} has unresolved {ref_key}: {ref}")
        for dependency in contract.get("depends_on", []):
            if dependency not in step_ids:
                errors.append(f"CHOSE step {step.get('id')} depends on unknown step {dependency}")
    if seen_components != known_chose_components:
        errors.append(f"CHOSE component registry mismatch: expected {sorted(known_chose_components)}, found {sorted(seen_components)}")
    for component in known_chose_components:
        if f'"{component}"' not in app_source:
            errors.append(f"app.js does not register CHOSE component {component}")

    boundaries = data.get("data_boundaries", {})
    if "actual_parameters" not in boundaries.get("process", {}).get("forbids", []):
        errors.append("CHOSE Process boundary must forbid actual_parameters")
    if "process_snapshot" not in boundaries.get("experiment", {}).get("owns", []):
        errors.append("CHOSE Experiment boundary must own process_snapshot")
    if "immutable_source_files" not in boundaries.get("results", {}).get("preserves", []):
        errors.append("CHOSE Results boundary must preserve immutable_source_files")
    if "researcher_conclusion" not in boundaries.get("review", {}).get("separates", []):
        errors.append("CHOSE Review boundary must separate researcher_conclusion")

    resources = built.get("resources", {})
    process_demo = resources.get("demo", {}).get("process", {})
    experiment_demo = resources.get("demo", {}).get("experiment", {})
    results_demo = resources.get("demo", {}).get("results", {})
    review_demo = resources.get("demo", {}).get("review", {})
    for step in data.get("steps", []):
        schema_ref = step.get("contract", {}).get("schema_ref", "")
        demo_ref = step.get("contract", {}).get("demo_ref", "")
        schema_group, _, schema_key = schema_ref.partition(".")
        demo_group, _, demo_key = demo_ref.partition(".")
        schema_doc = resources.get(schema_group, {}).get(schema_key, {})
        demo_doc = resources.get(demo_group, {}).get(demo_key, {})
        for required_path in schema_doc.get("document", {}).get("required", []):
            current = demo_doc
            for part in str(required_path).split("."):
                current = current.get(part) if isinstance(current, dict) else None
            if current in (None, "", [], {}):
                errors.append(f"CHOSE schema {schema_key} requires missing demo path {required_path}")
        record_path = schema_doc.get("record_path")
        entity = demo_doc.get(record_path, {}) if record_path else demo_doc
        for field, definition in schema_doc.get("fields", {}).items():
            if definition.get("required") and entity.get(field) in (None, "", [], {}):
                errors.append(f"CHOSE schema {schema_key} requires missing field {record_path}.{field}")
    operations = process_demo.get("fabrication_operations", [])
    operation_ids = [item.get("id") for item in operations]
    if len(operation_ids) != len(set(operation_ids)) or any(not item for item in operation_ids):
        errors.append("CHOSE demo fabrication operation IDs must be non-empty and unique")
    layer_ids = {item.get("id") for item in process_demo.get("stack", {}).get("layers", [])}
    for operation in operations:
        producer = operation.get("produces_layer")
        if producer and producer not in layer_ids:
            errors.append(f"CHOSE operation {operation.get('id')} produces unknown layer {producer}")
    allowed_external_producers = {"substrate", "process_variant"}
    for layer in process_demo.get("stack", {}).get("layers", []):
        producer = layer.get("producer")
        if producer not in operation_ids and producer not in allowed_external_producers:
            errors.append(f"CHOSE stack layer {layer.get('id')} has unknown producer {producer}")
    process_id = process_demo.get("process", {}).get("process_id")
    snapshot = experiment_demo.get("experiment", {}).get("process_snapshot", {})
    if process_id and snapshot.get("process_id") != process_id:
        errors.append("CHOSE demo experiment snapshot does not reference the demo process")
    for record in experiment_demo.get("execution_records", []):
        if record.get("operation_id") not in operation_ids:
            errors.append(f"CHOSE execution record references unknown operation {record.get('operation_id')}")
    sample_ids = {item.get("id") for item in experiment_demo.get("samples", [])}
    if not sample_ids:
        errors.append("CHOSE demo experiment must define sample instances")
    measurement_required = {"sample", "voc", "jsc", "ff", "pce", "stability", "hysteresis", "result_set_id", "experiment_id", "source_file"}
    normalized_records = results_demo.get("normalized_records", [])
    if not normalized_records:
        errors.append("CHOSE demo results must define normalized_records")
    for index, row in enumerate(normalized_records, 1):
        missing = measurement_required - set(row)
        if missing:
            errors.append(f"CHOSE normalized record {index} missing {sorted(missing)}")
    for index, source_file in enumerate(results_demo.get("source_files", []), 1):
        missing = {"file_name", "experiment_id", "demo_identity", "parser_profile", "parsing_status"} - set(source_file)
        if missing:
            errors.append(f"CHOSE source file {index} missing {sorted(missing)}")
    review_demo = resources.get("demo", {}).get("review", {})
    finding_ids = set()
    for finding in review_demo.get("findings", []):
        for key in ["finding_id", "type", "statement", "evidence_refs", "review_status"]:
            if not finding.get(key):
                errors.append(f"CHOSE demo finding is missing {key}")
        if finding.get("finding_id") in finding_ids:
            errors.append(f"CHOSE demo finding has duplicate id {finding.get('finding_id')}")
        finding_ids.add(finding.get("finding_id"))
    if not review_demo.get("report", {}).get("section_catalog"):
        errors.append("CHOSE review demo must define the report section catalog")
    if not review_demo.get("provenance_manifest"):
        errors.append("CHOSE review demo must define provenance_manifest")

    jv_mapping = resources.get("mappings", {}).get("jv", {})
    if jv_mapping.get("allow_silent_conversion") is not False:
        errors.append("CHOSE JV mapping must forbid silent conversion")
    if not jv_mapping.get("require_unit_confirmation"):
        errors.append("CHOSE JV mapping must require unit confirmation")
    if not jv_mapping.get("fields") or not jv_mapping.get("quality_checks"):
        errors.append("CHOSE JV mapping must define fields and quality checks")
    nomad_mapping = resources.get("mappings", {}).get("nomad", {})
    if nomad_mapping.get("remote_submission") is not False:
        errors.append("CHOSE NOMAD mapping must keep remote submission disabled")
    if data.get("exports", {}).get("nomad", {}).get("mapping_profile") != nomad_mapping.get("id"):
        errors.append("CHOSE export NOMAD mapping_profile must match mappings/nomad.yaml")

try:
    expected_pipeline_bundle = (
        "/* Generated from pipeline YAML sources and referenced resources. Do not edit by hand. */\n"
        + "window.LabFlowPipelines = "
        + json.dumps(built_pipelines, ensure_ascii=False, indent=2)
        + ";\n"
        + "window.LabFlowPipelineSources = "
        + json.dumps(built_pipeline_sources, ensure_ascii=False, indent=2)
        + ";\n"
    )
    if (ROOT / "assets/js/pipeline-bundle.js").read_text(encoding="utf-8") != expected_pipeline_bundle:
        errors.append("Pipeline bundle is not synchronized with pipeline YAML contracts and resources")
except Exception as exc:
    errors.append(f"Pipeline bundle synchronization could not be checked: {exc}")

if errors:
    print("VALIDATION FAILED")
    print("\n".join(f" - {error}" for error in errors))
    sys.exit(1)
print(f"VALIDATION OK: {len(html_pages)} pages, {len(pipeline_ids)} pipelines, volatile state and no external runtime requests")
