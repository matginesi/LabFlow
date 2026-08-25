# LabFlow Knowledge Base

This directory is the versioned source for LabFlow's bundled starter Knowledge Base.

LabFlow bundles `library.json` into the app and initializes a separate browser-internal library automatically. No folder authorization is required. The **Knowledge Base** page manages that internal copy, independently enables/disables its optional use by RAG, and can optionally synchronize it with a researcher-selected folder. Every Action and the Assistant work without retrieval. When enabled and healthy, a deterministic lexical retriever may select a small relevant slice; retrieved records never become evidence about the imported experiment.

The Knowledge Base is retrieval-only at runtime: it has no API that writes records directly into Design. A retrieved record can influence an AI proposal, but only the normal locally validated, fill-only proposal workflow may change the Working Copy.

`library.json` uses schema version `1` and currently contains 42 records: 34 reusable scientific `material`, `solution`, `process`, and `stack` records plus 8 `guide` records about LabFlow. Scientific records are transcribed from the primary literature cited in each record's `sources` array; guides are derived from the canonical repository documentation. At startup this JSON is merged automatically into the IndexedDB library, adding new bundled IDs while preserving personal records and same-ID local edits. Design filling retrieves only relevant scientific records and attaches every used record ID to the AI proposal before deterministic fill-only application; the Assistant may retrieve guides for LabFlow questions.

After changing the curated source, rebuild the browser bundle with `python tools/build_knowledge_bundle.py`.
