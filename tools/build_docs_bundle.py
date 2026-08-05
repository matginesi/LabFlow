#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]

DOC_ORDER = [
    ("README.md", "Overview"),
    ("docs/PROJECT.md", "Overview"),
    ("docs/UI_UX_GUIDELINES.md", "Overview"),
    ("docs/PIPELINE_CATALOG.md", "Pipelines"),
    ("docs/PIPELINE_CHOSE.md", "Pipelines"),
    ("docs/PIPELINE_QUICK.md", "Pipelines"),
    ("docs/PIPELINES_AND_DATA.md", "Pipelines"),
    ("docs/ROBOTICS.md", "Capabilities"),
    ("docs/AI_ML_FOUNDATION.md", "Capabilities"),
    ("docs/AI_REPORTS_AND_EXPORT.md", "Capabilities"),
    ("docs/THEME_INTEGRATION.md", "Engineering"),
    ("docs/JAVASCRIPT_LOGGING.md", "Engineering"),
    ("docs/VALIDATION_CHECKLIST.md", "Engineering"),
]

documents = []
for relative_path, group in DOC_ORDER:
    source = ROOT / relative_path
    markdown = source.read_text(encoding="utf-8")
    heading = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
    body = re.sub(r"^#\s+.+$", "", markdown, count=1, flags=re.MULTILINE).strip()
    description_match = re.search(r"(?:^|\n\s*\n)(?!\s*(?:#|[-*+]\s|\d+[.)]\s|>|```|\|))([^\n]+(?:\n(?!\s*\n|\s*(?:#|[-*+]\s|\d+[.)]\s|>|```|\|)).+)*)", body)
    description = " ".join(description_match.group(1).split()) if description_match else ""
    documents.append({
        "id": source.stem.lower().replace("_", "-"),
        "title": heading.group(1) if heading else source.stem.replace("_", " ").title(),
        "path": source.relative_to(ROOT).as_posix(),
        "group": group,
        "updated": "05 Aug 2026",
        "status": "Reviewed" if source.name != "README.md" else "Current",
        "description": description,
        "markdown": markdown,
    })

out = ROOT / "assets/js/docs-bundle.js"
out.write_text(
    "/* Generated from Markdown sources. Do not edit by hand. */\n"
    + "window.LabFlowDocs = "
    + json.dumps(documents, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(f"Wrote {out.relative_to(ROOT)} with {len(documents)} documents")
