# LabFlow Knowledge Base

The Knowledge Base is deliberately small and local. It is **context for AI**, not a second experiment database and not a separate retrieval service.

Two source files define it:

- `science.json` — reusable scientific knowledge: materials, formulations, process examples, device stacks and mechanism/concept notes. Scientific records keep primary-literature provenance in `sources[]`.
- `labflow.json` — short guides that help the Assistant explain LabFlow itself: Working Copy, Actions, providers, Design, reporting and the Knowledge Base model.

`python tools/build_knowledge_bundle.py` combines both files into `assets/js/knowledge/library-bundle.js`. LabFlow loads that bundle at startup, so there is no folder picker, directory permission, external database, indexing job or retrieval switch.

Runtime behavior is intentionally simple:

1. an Action or the Assistant has a question;
2. LabFlow performs a small deterministic local search;
3. relevant hits, if any, are added as external context;
4. if there is no useful hit, execution continues normally.

Scientific Actions search only the `science` collection. The Assistant may search both collections and uses `labflow` guides for product/workflow questions. Retrieved scientific records never become evidence about the imported experiment merely because they matched a query.

The Knowledge Base has no direct API that mutates Design. `design.infer` may cite retrieved record IDs in a proposal, but the normal Design validation and fill-only apply path remains the only way AI suggestions can enter the Working Copy. Exact model-only recipe quantities remain review-only.

The Knowledge Base page can create/import/edit records. Those changes are small browser-local overrides stored in `localStorage`; bundled records remain the default and can be reset. JSON export remains available for portability.
