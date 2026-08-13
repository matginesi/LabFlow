# LabFlow

Local-first browser workbench for perovskite/JV laboratory experiments.

The researcher workflow is deliberately small:

```text
Upload ZIP → Review → Results → Design → Report → Changes → NOMAD
```

The uploaded ZIP is immutable source evidence. LabFlow immediately snapshots its bytes and performs all work on one separate in-memory **Working Copy**.

## Start here

For architecture, data lifecycle, OPERATION behavior, Review/Design/Results/Report/NOMAD flow and AI boundaries, read:

**[`docs/WORKFLOW.md`](docs/WORKFLOW.md)**

Supporting specifications:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/specs/DATA_MODEL.md`](docs/specs/DATA_MODEL.md)
- [`docs/specs/OPERATIONS.md`](docs/specs/OPERATIONS.md)
- [`docs/AI.md`](docs/AI.md)
- [`docs/specs/IMPORT_EXPORT.md`](docs/specs/IMPORT_EXPORT.md)
- [`docs/NOMAD.md`](docs/NOMAD.md)
- [`LABFLOW_POC_SPEC.md`](LABFLOW_POC_SPEC.md)

## Core model

```text
Original ZIP (immutable)
        ↓
Working Copy
        ↓
Canonical Store
        ↓
Analysis Dossier / deterministic Results
        ↓
Research Context Packs
        ↓
Chat / AI assists / Report
```

Original filenames remain provenance and aliases; they are not blindly treated as scientific identity.

## Researcher OPERATIONS

Settings → Operations Workshop exposes every executable OPERATION in the webapp:

- Analyze dataset — deterministic automatic;
- Apply safe corrections — deterministic action;
- Resolve ambiguities — AI assist;
- Infer missing design — AI assist;
- Interpret results — AI assist;
- Generate report — AI assist;
- Improve report — AI assist;
- Prepare NOMAD export — deterministic action.

`assistant.chat` is also visible in the Workshop so its prompt/runtime definition can be inspected and edited. Internal helper functions remain implementation details rather than OPERATIONS.

Internal compute/index/apply/validation functions are not Workshop OPERATIONS.

## Save and export

The uploaded source is never rewritten.

**Save** persists the internal LabFlow representation in browser storage and marks that revision saved. **Export** explicitly creates the LabFlow ZIP; it does not replace the saved internal state.

LabFlow ZIP, Report PDF/DOCX and NOMAD ZIP are explicit derived exports: they read the current Working Copy but do not implicitly mark later edits saved.

Normal LabFlow export includes `canonical.json`, a compact portable semantic snapshot with identities, aliases, measurements, relations, evidence, findings, patches, Design and provenance. RAW source remains separate.

## Report

The current Markdown editor is the textual source of truth for document exports. PDF/DOCX use that text plus only the figures explicitly selected in Report Studio.

## NOMAD

NOMAD is deterministic-first. One Canonical → NOMAD mapping plan powers the UI, local validation and generated package. AI never decides readiness.

## Run

No Node.js application server or backend is required. The POC is static. AI providers are called directly from the browser and connection settings are stored locally in the browser.

For **local LLM providers**, do not open `index.html` through `file://`. Start the bundled static server with `python tools/serve_static.py --port 8765` and open `http://127.0.0.1:8765`. Ollama accepts localhost web origins by default. LM Studio direct browser access additionally requires CORS; start its server with `lms server start --cors` (or enable the equivalent CORS option in LM Studio). LabFlow uses the OpenAI-compatible `/v1/chat/completions` contract and always sends a `messages` array.

## Build and verify

```bash
python tools/build_prompt_bundle.py
python tools/build_operation_registry.py
python tools/validate_operation_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
find assets/js tests -name '*.js' -print0 | xargs -0 -n1 node --check
```

`ui-kit.html` is the visual ground truth.
