---
title: Agent data flow
section: Engineering reference
summary: End-to-end deterministic data flow, owner modules and the AI boundary.
order: 41
---

# Agent data flow

Authoritative detail: `docs/specs/DATA_MODEL.md`, `docs/specs/PIPELINE.md`, `docs/specs/ACTIONS.md`, `docs/CONTEXT_HYGIENE.md`. This page is the working map.

## One aggregate, many services

`LF.State.state.experiment` is the only mutable scientific aggregate (`ExperimentData`). Everything else is either a rebuildable read model, an external reference store, an Action proposal or UI state.

```text
RAW ZIP
  → importer + parser        (canonical construction)
  → ExperimentData           (single aggregate, revision + pending scopes)
      → DataPipeline stages  (deterministic derive/validate)
      → CanonicalStore       (read indexes)
      → Analysis/Summary     (metrics, findings, brief)
      → DesignModel          (design owner)
      → ActionData           (proposals, annotations, status)
  → views (pages) / context packs (Actions, Assistant) / export projections
```

## 1. Import — RAW becomes canonical

Entry point: `assets/js/app.js` `importDataset(file)` (Choose ZIP file button, the upload-card dropzone, or the hidden `#datasetInput`).

1. `LF.Importer.parseDataset(arrayBuffer, sourceName, onProgress)` (`assets/js/data/importer.js`):
   - size/ratio/file-count preflight (`importLimits`, fail-closed errors with code `IMPORT_RESOURCE_LIMIT`);
   - if the ZIP is a LabFlow export it is restored through `restoreLabFlowSave` instead of re-parsed;
   - otherwise builds a `manifest` and classifies each entry with `LF.Parser.classify` (policy-driven);
   - `assets/js/data/parser.js` reads the machine-readable rules from `LF.PromptRegistry.effectiveRules()` (source: `prompts/policies/data-ground-truth.md` + `data-format-repair.md`) — it consumes policy and never invents laboratory semantics;
   - records are created through `LF.DomainSchema.create`, raw tables/metadata become `blocks`, and `buildAcquisitionHierarchy` links experiment → sample → run → measurement using the configured naming grammar.
2. The result is a fresh `ExperimentData`. `LF.State.setExperiment(exp)` installs it (hydrates through `DataModel`, binds the workspace, notifies `experiment`).

`raw.sourceArchive` holds the immutable bytes when present (a LabFlow export embeds `raw/source.zip`); ordinary instrument ZIPs keep paths/bytes as provenance only.

## 2. Deterministic lifecycle

`LF.DataPipeline.refresh(exp, {reason})` (`assets/js/data/pipeline.js`) runs the declared stages in dependency order:

```text
normalize → link → validate-structure → analyze → index → review → auto-cleanup → project-design → summarize → validate-final
```

- Stages are deterministic and may not call a provider; `reads`/`writes` are architectural declarations.
- A stage may request a bounded restart (`{restartFrom:'link'}`) after an accepted mutation instead of calling downstream stages itself.
- `validate-structure` fails closed before analysis.

## 3. Mutation and invalidation

Owner API → `LF.State.touch(scope)` (or `markDraft`/`commitDraft`/`commitAllDrafts`):

- `DataModel.touch` bumps `sync.revision` and records pending scopes;
- `DerivedState.invalidate` drops recomputable projections;
- `notify(reason)` tells subscribers (`app.js` re-renders for reasons other than `actionRun`/`assistant`).

Never write canonical fields from a page/controller; call the owner (`DesignModel`, `DatasetCorrections`, `ActionData`, importer construction, `Workspace`, Cabinet/KB owners).

## 4. Read models

| Module | Role |
|---|---|
| `experiment/canonical-store.js` | pure, rebuildable indexes and evidence lookup over current data |
| `data/analysis.js` | deterministic JV metrics, rankings, quality findings |
| `data/analysis-summary.js` | aggregate summaries and the experiment brief |
| `experiment/design-model.js` | Design owner: normalize, query, mutate, provenance, acceptance |
| `experiment/design-analysis.js` | Design completeness, proposal sanitization/confidence, apply paths |
| `experiment/action-data.js` | persisted proposals/annotations/status per Action + target |

Design source evidence is projected deterministically in `project-design` (`DesignModel.projectRawDesign`) from `auxiliaryEvidence` and must never overwrite researcher/imported values.

## 5. Reference stores

- **Cabinet** (`assets/js/cabinet/cabinet.js`, localStorage `labflow.cabinet`): the kind registry owns fields, validation, summaries, UI grouping and Design-application capability. Applying a resource copies a detached snapshot and records provenance.
- **Knowledge Base** (`knowledge/kb.jsonl` bundled + custom JSONL in localStorage `labflow.knowledge`): two model-facing views — `compactForDesign` (source-free hints) and `compactForAssistant` (compact facts plus limited sources). KB is reference knowledge, never experiment evidence.

## 6. AI boundary

```text
guard/preflight (ActionCapabilities + action-guards)
  → bounded context (LF.ContextBuilder.pack(profile, {exp, params}))
  → LF.Actions.run(actionId, {...})   (manifest steps)
      → DETERMINISTIC step (ActionStepRegistry tool) | AI step (provider)
  → ai/transport.js (+ http.js, stream.js) for the provider request
  → ai/structured.js validation
  → deterministic validate_with step
  → store step (ActionData or owner API)
  → researcher acceptance
```

- Context profiles select the target, compact evidence and small candidate lists; authority is labelled per item.
- HTTP success is not Action success: a syntactically valid but semantically incomplete model response is downgraded (for example to unresolved Design domains), never reported as success.
- Provider-backed scientific Actions use no automatic semantic retry loops; budgets, deadlines and max output tokens are declared in the manifest.
- The model never mutates scientific state. It produces proposals that only become data through an owner-controlled acceptance path.

## 7. Export

- `export/export.js` builds the portable LabFlow ZIP; `export/nomad.js` maps/validates the NOMAD-oriented package; `export/projections.js` renders NOMAD/Ready-PV views.
- Export is a projection of canonical data. Projection overrides are export-only and never rewrite canonical scientific truth.

## 8. Persistence and trust boundary

| Storage | Contents |
|---|---|
| IndexedDB `labflow.workspace.current` | saved workspace + RAW archive bytes |
| localStorage `labflow.ai.settings`, `labflow.assistant.settings`, `labflow.ui.settings`, `labflow.export.settings`, `labflow.nomad.settings` | preferences |
| localStorage `labflow.ai.keys`, `labflow.nomad.token` | credentials (session-only variant in sessionStorage) |
| localStorage `labflow.cabinet`, `labflow.knowledge` | reference stores |
| localStorage `labflow.action.overrides`, `labflow.user.profile`, `labflow.workspace.profile` | overrides and profiles |
| sessionStorage / module state | Assistant session memory, uploaded Browser Local GGUF bytes |

`DataModel.restore()` is the strict trust boundary for external or persisted snapshots; `hydrate()` is not a migration layer.

## 9. Invariants to protect

- One mutable scientific aggregate; no parallel copy in pages, context or derived state.
- RAW bytes and paths are immutable provenance.
- Deterministic code owns parsing, arithmetic, ranking, validation and export mapping.
- Stable IDs link scientific relations; a file identity never substitutes a sample identity.
- Derived state is disposable and invalidated declaratively, never mutated by feature-specific branches in `State.touch()`.
- Action proposals, annotations and statuses live under `actionData` until explicitly accepted.
- Required runtime dependencies fail fast; do not hide load-order errors behind fallbacks.
