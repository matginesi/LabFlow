#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
documents = []
for source in [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md"))]:
    markdown = source.read_text(encoding="utf-8")
    heading = re.search(r"^#\s+(.+)$", markdown, re.MULTILINE)
    body = re.sub(r"^#\s+.+$", "", markdown, count=1, flags=re.MULTILINE).strip()
    description_match = re.search(r"(?:^|\n\s*\n)(?!\s*(?:#|[-*+]\s|\d+[.)]\s|>|```|\|))([^\n]+(?:\n(?!\s*\n|\s*(?:#|[-*+]\s|\d+[.)]\s|>|```|\|)).+)*)", body)
    description = " ".join(description_match.group(1).split()) if description_match else ""
    documents.append({
        "id": source.stem.lower().replace("_", "-"),
        "title": heading.group(1) if heading else source.stem.replace("_", " ").title(),
        "path": source.relative_to(ROOT).as_posix(),
        "updated": "03 Aug 2026",
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
