#!/usr/bin/env python3
from pathlib import Path
import json
import yaml

ROOT = Path(__file__).resolve().parents[1]
pipelines = {}
for source in sorted((ROOT / "pipelines").glob("*/pipeline.yaml")):
    data = yaml.safe_load(source.read_text(encoding="utf-8"))
    pipelines[data["id"]] = data
out = ROOT / "assets/js/pipeline-bundle.js"
out.write_text(
    "/* Generated from pipeline YAML sources. Do not edit by hand. */\n"
    + "window.LabFlowPipelines = "
    + json.dumps(pipelines, ensure_ascii=False, indent=2)
    + ";\n",
    encoding="utf-8",
)
print(f"Wrote {out.relative_to(ROOT)} with {len(pipelines)} pipelines")
