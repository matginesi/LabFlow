#!/usr/bin/env python3
"""Build the static pipeline registry from canonical YAML contracts.

Each pipeline has one ``pipeline.yaml`` entry point. Optional files referenced
through ``resource_refs`` are resolved at build time and embedded under
``resources`` so the browser POC remains fully static and performs no runtime
network requests.
"""

from __future__ import annotations

from pathlib import Path
import json
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
PIPELINES_ROOT = ROOT / "pipelines"


def load_document(path: Path) -> Any:
    suffix = path.suffix.lower()
    text = path.read_text(encoding="utf-8")
    if suffix in {".yaml", ".yml"}:
        return yaml.safe_load(text)
    if suffix == ".json":
        return json.loads(text)
    raise ValueError(f"Unsupported pipeline resource type: {path.relative_to(ROOT)}")


def resolve_resource_path(pipeline_dir: Path, relative: str) -> Path:
    candidate = (pipeline_dir / relative).resolve()
    root = pipeline_dir.resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError(f"Pipeline resource escapes its directory: {relative}")
    if not candidate.is_file():
        raise FileNotFoundError(f"Missing pipeline resource: {candidate.relative_to(ROOT)}")
    return candidate


def resolve_group(pipeline_dir: Path, value: Any) -> Any:
    if isinstance(value, str):
        return load_document(resolve_resource_path(pipeline_dir, value))
    if isinstance(value, dict):
        return {key: resolve_group(pipeline_dir, item) for key, item in value.items()}
    if isinstance(value, list):
        return [resolve_group(pipeline_dir, item) for item in value]
    raise TypeError(f"resource_refs entries must be paths, mappings or lists, got {type(value).__name__}")


def build_pipeline(source: Path) -> dict[str, Any]:
    data = load_document(source)
    if not isinstance(data, dict):
        raise TypeError(f"{source.relative_to(ROOT)} must contain a YAML mapping")
    pipeline_dir = source.parent
    refs = data.get("resource_refs", {})
    if refs:
        if not isinstance(refs, dict):
            raise TypeError(f"{source.relative_to(ROOT)} resource_refs must be a mapping")
        data["resources"] = resolve_group(pipeline_dir, refs)
    return data


def main() -> None:
    pipelines: dict[str, dict[str, Any]] = {}
    for source in sorted(PIPELINES_ROOT.glob("*/pipeline.yaml")):
        data = build_pipeline(source)
        pipeline_id = data.get("id")
        if not pipeline_id:
            raise ValueError(f"{source.relative_to(ROOT)} is missing id")
        if pipeline_id in pipelines:
            raise ValueError(f"Duplicate pipeline id: {pipeline_id}")
        pipelines[pipeline_id] = data

    out = ROOT / "assets/js/pipeline-bundle.js"
    out.write_text(
        "/* Generated from pipeline YAML sources and referenced resources. Do not edit by hand. */\n"
        + "window.LabFlowPipelines = "
        + json.dumps(pipelines, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    resource_count = sum(len(item.get("resources", {})) for item in pipelines.values())
    print(f"Wrote {out.relative_to(ROOT)} with {len(pipelines)} pipelines and {resource_count} resource groups")


if __name__ == "__main__":
    main()
