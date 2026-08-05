#!/usr/bin/env python3
"""Build the checked-in browser snapshot for the Robotics POC."""
from pathlib import Path
import json
import yaml

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "robotics/robot-arm-01.yaml"
target = ROOT / "assets/js/robotics-bundle.js"
data = yaml.safe_load(source.read_text(encoding="utf-8"))
if not isinstance(data, dict) or not isinstance(data.get("joints"), list):
    raise SystemExit("robot-arm-01.yaml must define a robot mapping with joints")
target.write_text(
    "/* Generated from robotics/robot-arm-01.yaml. Do not edit by hand. */\n"
    + "window.LabFlowRoboticsConfig="
    + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(f"Wrote {target.relative_to(ROOT)}")
