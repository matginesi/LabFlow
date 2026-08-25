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
Canonical Data Model / Store
        ↓
Tool Registry
   ┌────┴──────────────────┐
   ↓                       ↓
Actions                Assistant
(explicit workflows)   (read-only tool loop)
   ↓                       ↓
validated writes        observations
   └────────────┬──────────┘
                ↓
           Working Copy
```

## 2. Source Vault

The uploaded archive bytes are cloned on import. The source snapshot is immutable by contract.

No editable state shares the caller-owned upload buffer. Exporting the original returns a copy of the original source bytes.

## 3. Working Copy

`LF.State.state.experiment` is the only mutable scientific experiment.

Pages and Actions must not create alternate editable scientific models.

The Working Copy contains parsed scientific collections plus report/NOMAD/derived state belonging to the current experiment.

## 4. Canonical Store

Module: `assets/js/experiment/canonical-store.js`

Responsibilities:

- provide the internal `labflow-canonical-v2` grouped representation used across LabFlow;
- normalize semantic access over imperfect naming;
- maintain sample aliases;
- expose current scientific domains (Design, Results, findings) and current Report/Paper document views;
- build evidence items, relations and provenance views;
- build lookup indexes;
- expose compact retrieval helpers.

The Canonical Store is still a deterministic view/index over the one Working Copy, not a second editable model. It references Working Copy scientific arrays rather than duplicating RAW arrays. Compatibility aliases keep older modules working while new Tools consume the grouped domains.

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

## 6. Tools, Actions and AI architecture

Primary modules:

- `assets/js/tools/registry.js` — shared typed Tool Registry; read Tools expose Canonical data, internal service Tools wrap deterministic implementation functions;
- `assets/js/ai/context.js` — bounded, declarative Context Pack builder;
- `assets/js/ai/action-steps.js` — deterministic service implementations behind internal Tools;
- `assets/js/ai/actions.js` — generic sequential Action runner, prerequisite gate and bounded Assistant read-tool loop;
- `assets/js/ai/transport.js` — provider request/SSE transport;
- `assets/js/ai/structured.js` — structured output parse/validation;
- `assets/js/ai/assistant.js` — Assistant integration.

Provider/model discovery, endpoint adaptation, thinking modes and normalized response behavior are specified in [`docs/specs/AI_PROVIDERS.md`](specs/AI_PROVIDERS.md). The complete source ownership map is in [`docs/specs/JAVASCRIPT_MODULES.md`](specs/JAVASCRIPT_MODULES.md).

Actions remain explicit workflows: pressing an Action never delegates the workflow choice to an autonomous agent. AI never owns parsing, deterministic Results or NOMAD readiness. The Assistant may choose only from an Action-declared allowlist of read-only Tools and cannot invoke write Tools or mutating Actions. Its structured tool planner is best-effort: models that cannot emit a valid tool choice fall through to the ordinary textual answer instead of failing the whole Assistant Action.

## 7. Page architecture

Pages read the current Working Copy/Canonical Store. They do not own parallel scientific projections.

- Review — Analysis Dossier, safe corrections, AI proposals/human decisions;
- Results — deterministic measurements/results; Compare statistics read the Analysis Summary bundle when fresh;
- Design — deterministic known Design + researcher edits + optional bounded retrieval from the separate local Knowledge Base during missing-field inference; empty retrieval continues with ordinary model inference, while field source, confidence and deterministic auto-apply safety remain separate and safe fields are applied through fill-only gates when the researcher invokes Complete;
- Report — current Markdown editor + explicit figure selection; statistics and the six figures read the Analysis Summary bundle when fresh and figures are rasterized on demand and cached per revision;
- NOMAD — one deterministic mapping plan + validation; the derived `analysis.json` bundles deterministic analysis with the Analysis Summary bundle.
- Documentation — read-only browser over versioned Markdown sources with locally rendered Mermaid diagrams; it never reads or mutates scientific state.
- Knowledge Base — a bundled, versioned local library split into `knowledge-base/science.json` and `knowledge-base/labflow.json`. It is ready at startup with no folder, permission, external database or retrieval switch. Scientific Actions perform small optional searches over `science`; the Assistant may also search `labflow` help. A miss simply adds no context. User edits/imports are browser-local overrides and the library remains outside the Working Copy.

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
- parallel model calls for one Action;
- full experiment serialization as default model context;
- alternate NOMAD mapping implementation;
- export-specific regenerated Report prose.
