# LabFlow

LabFlow is a local-first browser application for importing experimental archives, turning them into one explicit scientific data model, calculating deterministic results, reviewing only genuine ambiguities, reconstructing experiment design, and preparing deterministic NOMAD-oriented exports.

The product is deliberately researcher-first: a normal import should require as few decisions as possible.

## Researcher workflow

```text
ZIP
 ↓
automatic import + canonical naming
 ↓
deterministic safe-cleanup detection
 ↓
explicit acceptance when a safe correction is pending
 ↓
Review only genuine semantic ambiguities
 ↓
Results / Design / Export
```

If deterministic evidence is sufficient, the researcher can go directly from import to Results. AI is optional and never blocks import.

## Scientific data model

The in-memory source of truth is one `ExperimentData` aggregate:

```text
ExperimentData
└─ experiments[]
   └─ samples[]
      └─ runs[]
         └─ measurements[]
            ├─ FW metrics + curve
            └─ RV metrics + curve
```

For the bundled JV fixture `2026_01_22.zip`, the expected hierarchy is:

```text
5 experiments → 31 samples/cells → 42 runs → 72 measurements
```

RAW source data is immutable. Corrections are patches on the LabFlow Data with provenance.

## Architecture kernel

Contributor-facing stability is centered on five modules: `DomainSchema`, `ExperimentData`, `DataContracts`, `DerivedState` and `DataPipeline`. Action outputs use the separate `ActionData` store. See `docs/ARCHITECTURE.md` and `docs/guides/EXTENDING_LABFLOW.md`.

## Deterministic pipeline

Import runs one deterministic pipeline:

1. `normalize`
2. `link`
3. `validate-structure`
4. `analyze`
5. `index`
6. `review`
7. `auto-cleanup`
8. `project-design`
9. `summarize`
10. `validate-final`

Canonical naming is automatic. Mechanically provable cleanup is detected deterministically by the pipeline, but changes LabFlow Data only after explicit researcher acceptance. The pipeline never calls an AI provider.

## Actions

Only user-facing capabilities are Actions. The current catalog is intentionally small:

| Action | Purpose | Effect |
|---|---|---|
| `dataset.resolve-ambiguities` | Suggest resolutions for semantic ambiguities deterministic rules cannot settle | stores proposals only |
| `design.infer` | Complete missing qualitative chemistry, device architecture and/or fabrication process by proposal | stores proposal only |
| `results.interpret` | Interpret deterministic Results | stores derived annotation |
| `results.compare` | Explain differences between selected result groups | stores derived annotation |
| `assistant.chat` | Answer questions about current data/page | read-only |

There is no “analyze dataset” Action: analysis is pipeline work. Safe mechanical cleanup is detected by the pipeline and accepted directly in Review; it is not an AI Action. NOMAD preparation is a deterministic service, not an Action.

## Action contract

Every Action declares:

```text
contract.target   → what it acts on
contract.context  → what data it may read
contract.result   → what it must return
contract.effect   → what state it may write
contract.guards   → when it is available
execution         → how it runs and which step is the semantic result
```

AI structured output is validated before any proposal/annotation is stored. `design.infer` must cover every Design domain that is currently missing; stack coverage uses the same completeness predicate as the Design page, so a partial architecture stays inside the bounded retry flow instead of being stored as a successful suggestion. Accept/Accept all re-check the resulting Design state before labelling an experiment accepted.

## Data Console

Open DevTools and run:

```js
LabFlow.Data.help()
LabFlow.Data.summary()
LabFlow.Data.tree()
LabFlow.Data.validate()
LabFlow.Data.pipeline()
LabFlow.Data.actions()
LabFlow.Data.contracts()
```

See `docs/guides/DATA_CONSOLE.md` for the complete API.

## Privacy and storage

LabFlow is local-first. AI provider keys/preferences and optional NOMAD upload-stub settings remain local to the browser. RAW archives are kept as source evidence and are never modified by cleanup. Accepted scientific LabFlow Data changes carry revision/provenance metadata; the current NOMAD upload control is a non-networking stub.

## Build and verify

```bash
python tools/build_prompt_bundle.py
python tools/build_knowledge_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py
python tools/validate_action_contract.py
python tools/validate_architecture_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
node tests/unit/run.js
```

The generated bundles must be rebuilt after changing their source files.

## Documentation

Start with:

- `docs/guides/GETTING_STARTED.md`
- `docs/guides/RESEARCH_WORKFLOW.md`
- `docs/specs/DATA_MODEL.md`
- `docs/specs/PIPELINE.md`
- `docs/specs/ACTIONS.md`
- `docs/guides/DATA_CONSOLE.md`
- `docs/guides/EXTENDING_LABFLOW.md`

## Run locally

Serve it with any ordinary static server if you do not want to open `index.html` directly:

```bash
python -m http.server 8000
```

LabFlow is a static browser application. A generic static server is sufficient; Z.AI and other hosted providers are called directly from the browser using the configured endpoint. You may also open the page directly when your browser permits local-file module/script access.


## AI provider console

Open browser DevTools and run `LabFlow.AIConsole.help()` for provider/model diagnostics. See `docs/guides/AI_PROVIDER_CONSOLE.md`.
