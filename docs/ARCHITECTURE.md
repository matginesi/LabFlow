# LabFlow architecture

Read [`WORKFLOW.md`](WORKFLOW.md) first. This document describes module boundaries and invariants.

## 1. Architectural objective

LabFlow is a static, local-first browser workbench. It deliberately avoids a server-side application architecture for the POC.

The scientific architecture is:

```text
Immutable Source Vault
        ↓
Working Copy
        ↓
Canonical Store
        ↓
Derived deterministic views
        ├─ Analysis Dossier
        ├─ Results
        ├─ Design evidence status
        └─ NOMAD mapping
        ↓
Context Builder
        ↓
Chat / AI assists / Report generation
```

## 2. Source Vault

The uploaded archive bytes are cloned on import. The source snapshot is immutable by contract.

No editable state shares the caller-owned upload buffer. Exporting the original returns a copy of the original source bytes.

## 3. Working Copy

`LF.State.state.experiment` is the only mutable scientific experiment.

Pages and OPERATIONS must not create alternate editable scientific models.

The Working Copy contains parsed scientific collections plus report/NOMAD/derived state belonging to the current experiment.

## 4. Canonical Store

Module: `assets/js/experiment/canonical-store.js`

Responsibilities:

- normalize semantic access over imperfect naming;
- maintain sample aliases;
- build evidence items;
- build relations;
- build lookup indexes;
- expose compact retrieval helpers.

The Canonical Store references Working Copy arrays rather than duplicating RAW arrays.

### Current relation families

Examples include:

- `sample_measurement`;
- `measurement_file`;
- `sample_file`;
- `entity_evidence`;
- `file_evidence`;
- `sample_design`.

### Current evidence families

Examples include:

- source file evidence;
- format evidence;
- auxiliary evidence;
- finding evidence.

## 5. Deterministic data pipeline

Primary modules:

- `assets/js/data/importer.js` — archive inventory/import orchestration;
- `assets/js/data/parser.js` — known format parsing and sample naming rules;
- `assets/js/data/analysis.js` — deterministic JV analysis;
- `assets/js/experiment/data-model.js` — normalized experiment shape;
- `assets/js/experiment/canonical-store.js` — semantic indexes/evidence/relations.

Scientific calculation and validation belong here, not in AI prompts.

## 6. AI architecture

Primary modules:

- `assets/js/ai/context.js` — shared bounded Context Pack builder;
- `assets/js/ai/operation-steps.js` — deterministic OPERATION checkpoint functions;
- `assets/js/ai/operations.js` — generic sequential Operation runner;
- `assets/js/ai/transport.js` — provider request/SSE transport;
- `assets/js/ai/structured.js` — structured output parse/validation;
- `assets/js/ai/assistant.js` — Assistant integration.

AI never owns parsing, deterministic Results or NOMAD readiness.

## 7. Page architecture

Pages read the current Working Copy/Canonical Store. They do not own parallel scientific projections.

- Review — Analysis Dossier, safe corrections, AI proposals/human decisions;
- Results — deterministic measurements/results;
- Design — deterministic known Design + researcher edits + optional missing-field inference;
- Report — current Markdown editor + explicit figure selection;
- NOMAD — one deterministic mapping plan + validation.

## 8. Report architecture

The Report Markdown editor is the authoritative textual document.

Report generation/improvement writes into that editor. PDF/DOCX serialize the editor content and selected figures. Export code must not regenerate independent prose.

## 9. NOMAD architecture

Module: `assets/js/nomad/nomad.js`

One revision-scoped Canonical → NOMAD mapping is shared by:

- NOMAD UI;
- validation;
- generated entry YAML;
- exported mapping metadata.

Do not build separate mapping logic inside the page and exporter.

## 10. State and invalidation

Module: `assets/js/state.js`

Scientific mutation advances the Working Copy revision and invalidates dependent derived state as appropriate.

Derived objects must either match the current revision or be visibly stale/absent.

Only **Save** marks the internal browser representation as saved. **Export** and other derived exports create files and do not implicitly mark later changes saved.

## 11. Export architecture

Primary modules:

- `assets/js/export/export.js` — LabFlow original/working package export;
- `assets/js/report/report.js` — Report document/figure export;
- `assets/js/nomad/nomad.js` — NOMAD package export.

All derived exports read the current Working Copy. None rewrites original source bytes.

## 12. Architectural anti-patterns

Do not add:

- second experiment state;
- hidden autosave model;
- page-owned scientific copies;
- AI parsing/calculation;
- background workflow server;
- provider queue;
- parallel model calls for one operation;
- full experiment serialization as default model context;
- alternate NOMAD mapping implementation;
- export-specific regenerated Report prose.
