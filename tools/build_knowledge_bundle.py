#!/usr/bin/env python3
"""Build the tiny bundled LabFlow Knowledge Base from two readable JSON files."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ("science", ROOT / "knowledge-base" / "science.json"),
    ("labflow", ROOT / "knowledge-base" / "labflow.json"),
]
OUT = ROOT / "assets" / "js" / "knowledge" / "library-bundle.js"

records = []
updated = []
for collection, path in SOURCES:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get("records"), list):
        raise SystemExit(f"{path}: records must be an array")
    if data.get("updatedAt"):
        updated.append(str(data["updatedAt"]))
    for raw in data["records"]:
        record = dict(raw)
        record["collection"] = collection
        records.append(record)

ids = [str(r.get("id", "")) for r in records]
if not all(ids) or len(ids) != len(set(ids)):
    raise SystemExit("Knowledge Base record IDs must be non-empty and unique")

payload = {
    "version": 1,
    "records": records,
    "updatedAt": max(updated) if updated else None,
}
OUT.write_text(
    "window.LabFlow=window.LabFlow||{};window.LabFlow.KnowledgeSeed="
    + json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    + ";\n",
    encoding="utf-8",
)
print(f"Built {OUT.relative_to(ROOT)} with {len(records)} records from science.json + labflow.json")
