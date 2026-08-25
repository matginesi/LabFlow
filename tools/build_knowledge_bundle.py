#!/usr/bin/env python3
"""Bundle the curated Knowledge Base so RAG works without folder permission."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "knowledge-base" / "library.json"
TARGET = ROOT / "assets" / "js" / "knowledge" / "library-bundle.js"


def main() -> None:
    library = json.loads(SOURCE.read_text(encoding="utf-8"))
    payload = json.dumps(library, ensure_ascii=False, separators=(",", ":"))
    output = (
        "(function(){'use strict';"
        "const LF=window.LabFlow=window.LabFlow||{};"
        f"LF.KnowledgeSeed={payload};"
        "}());\n"
    )
    TARGET.write_text(output, encoding="utf-8")
    print(f"Knowledge bundle: {TARGET.relative_to(ROOT)} ({len(library.get('records', []))} records)")


if __name__ == "__main__":
    main()
