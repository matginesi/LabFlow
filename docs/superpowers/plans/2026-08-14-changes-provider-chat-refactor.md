# LabFlow Changes / provider / chat refactor plan — 2026-08-14

Status: implemented and verified.

## Goal

Repair the document-change audit, remove the fixed 8K output assumption, make Report/Paper figures explicit per document, merge Upload and Review without weakening the upload gate, and bring Assistant UI/telemetry back into the LabFlow visual contract.

## Plan and completion

- [x] Audit current state transitions, baseline capture, Report/Paper editing, figure state, provider transport and Assistant streaming UI.
- [x] Rebuild Changes around an immutable import baseline plus current working state and explicit document-edit provenance.
- [x] Make manual Report/Paper edits visible immediately and distinguish user vs AI edit sessions.
- [x] Bound long change tables, diffs and provenance in compact independently scrollable regions.
- [x] Split figure selection into independent Laboratory Report and Paper selections; preserve legacy shared selections on migration.
- [x] Merge Upload and Review into one first-step workbench while retaining ZIP upload as the mandatory experiment gate.
- [x] Add provider/model capability resolution for maximum output/context information where available; replace hidden 8K defaults with automatic limits and optional user caps.
- [x] Omit output-token parameters when neither an exact/provider-derived limit nor a user cap is known, instead of guessing.
- [x] Refactor Assistant messages to compact rows; hide transport streaming counters; separate thinking/reasoning; expose useful latency/token/throughput metadata when available.
- [x] Update Action contracts/registry, README, POC spec, workflow/AI/UI docs, visual language, LabFlow UI skill and canonical UI Kit.
- [x] Update unit and responsive-browser contracts for the six-step workflow and new Changes surface.
- [x] Run contract validators, JavaScript syntax checks, unit tests and responsive browser audit.

## Deliberate POC boundaries

- Provider capabilities use native metadata when exposed and small maintained model-spec fallbacks where APIs do not expose output ceilings. Unknown custom models remain unknown rather than acquiring a fabricated default.
- Changes stores a bounded edit-provenance history rather than implementing a full version-control engine.
- Existing saved figure selections and the legacy Review route are migrated/aliased instead of maintaining duplicate workflows.
