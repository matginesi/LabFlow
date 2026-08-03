#!/usr/bin/env python3
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "settings.yaml"
target = ROOT / "assets/js/settings-bundle.js"
config = yaml.safe_load(source.read_text(encoding="utf-8"))
if not isinstance(config, dict):
    raise SystemExit("settings.yaml must contain a YAML mapping at the document root")
target.write_text(
    "window.LabFlowConfig=" + json.dumps(config, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)
print(f"Wrote {target.relative_to(ROOT)}")
