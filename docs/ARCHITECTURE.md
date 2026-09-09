---
title: Architecture
section: Core architecture
summary: Authoritative boundaries, ownership and extension rules for the LabFlow codebase.
order: 5
---

# LabFlow architecture

This document is the architectural source of truth for contributors. LabFlow is intentionally a small local-first browser application; extensibility comes from explicit contracts and registries, not from adding framework layers. LabFlow can be opened as static browser content or served by a normal static server; no application backend or provider relay owns scientific state.

## 1. Core rule

There is exactly one mutable scientific aggregate:

```text
LF.State.state.experiment : ExperimentData
```

Everything else is either immutable source evidence, a deterministic projection/cache, an Action output, interaction history, or an export projection.

```text
ZIP bytes (immutable)
      ↓
Importer / Parser
      ↓
ExperimentData  ← DomainSchema + DataContracts
      ↓
DataPipeline
      ├─ deterministic Analysis
      ├─ CanonicalStore read index
      ├─ Review projection
      ├─ Design projection
      └─ deterministic summaries
      ↓
Pages / NOMAD / Actions / Assistant
```

## 2. Architectural kernel

Five modules define the stable core.

### `DomainSchema`
`assets/js/experiment/domain-schema.js`

Owns:
- record factories and normalization;
- root-field ownership/layer/persistence metadata;
- the persistent snapshot contract;
- supported mutation/invalidation scopes.

No other module should redefine the canonical default shape of `ExperimentData` records.

### `ExperimentData`
`assets/js/experiment/data-model.js`

The single aggregate root and public domain API. Records remain plain objects; LabFlow deliberately does not create a class hierarchy for every record type.

Use `ExperimentData` query/mutation methods or feature services. Do not create a second editable experiment object.

### `DataContracts`
`assets/js/experiment/data-contracts.js`

Validates record shape, IDs, typed relations, backlinks, patches, Design references and the single Action-output boundary. Structural violations fail closed with `DATA_CONTRACT_INVALID`.

### `DerivedState`
`assets/js/experiment/derived-state.js`

Declares which recomputable projections depend on which mutation scopes and how they are invalidated. `State` must not know feature-specific cache paths.

### `DataPipeline`
`assets/js/data/pipeline.js`

Runs the deterministic lifecycle. Stages declare dependency order, phase, read set, write set and description. A stage may request a bounded restart instead of directly invoking other stages.

## 3. Data layers and ownership

`DomainSchema.rootFields()` is authoritative. The main layers are:

| Layer | Examples | Owner | Persistence |
|---|---|---|---|
| immutable source | `raw`, `files`, `manifest`, format/auxiliary evidence | importer | persistent |
| LabFlow Data | experiments, samples, runs, measurements, patches, Design | domain / design | persistent |
| deterministic scientific result | `analysis`, findings | analysis | persistent |
| Action output | `actionData` | Actions | persistent |
| interaction history | `derived.actions`, `derived.chat` | runtime/state | persistent |
| runtime derived cache | canonical/review/brief/pipeline caches | owning projection | runtime only |
| export projection | NOMAD state | NOMAD | persistent where required |

A module may read other layers when its contract requires it, but it should write only fields it owns.

## 4. Scientific hierarchy

```text
ExperimentData / imported batch
└─ Experiment / condition
   └─ Sample / physical cell
      └─ Run / acquisition session
         └─ Measurement / repeated JV acquisition
            ├─ FW scan
            └─ RV scan
```

FW/RV are scans of one measurement. A result row or scan is never promoted to a new experiment.

Stable IDs define relations. Human-readable names are labels/search aliases and must not become the primary relational key when an ID exists.

## 5. Source, LabFlow Data and provenance

The uploaded archive is immutable source evidence. Automatic/manual corrections affect only the LabFlow Data.

All LabFlow Data correction provenance uses the single `patch` record shape with a typed target:

```js
{
  kind: 'patch',
  target: { kind: 'measurement', id: 'm_...' },
  operation: 'set',
  field: '...',
  from: ...,
  to: ...,
  source: 'automatic | researcher | action',
  reason: '...',
  evidence: [...],
  status: 'applied | proposed | rejected | superseded'
}
```

Do not create parallel provenance arrays or feature-specific patch formats.

## 6. Canonical Store

`CanonicalStore` is a **read projection/index**, not another data model. Its internal collection is called `records` specifically to avoid introducing a second scientific concept called “entity”.

It may create aliases, relations and evidence indexes for retrieval, but building it must not mutate LabFlow Data records.

## 7. Action outputs

All persisted Action-specific proposals/annotations/status live under:

```js
experiment.actionData = {
  proposals: {},
  annotations: {},
  status: {}
}
```

Use `LF.ActionData` as the single persistent boundary for Action proposals, annotations and per-target status. Canonical scientific projections remain deterministic and do not embed AI annotations.

Scientific data changes occur only after an explicit apply/accept path owned by deterministic code.

`ActionCapabilities` is the single availability/preflight service. Public Actions are globally discoverable from manifests. A route may mark an Action as recommended, but cannot add/remove it. Manifest `ui.bindings` resolve current selections/filters into Action parameters; guards, Context Packs, validators and storage checkpoints consume those resolved parameters instead of reading page UI state independently.

## 8. State and invalidation

`State.touch(scope)` advances the LabFlow Data revision and delegates feature invalidation to `DerivedState`.

Typical scopes are:

```text
dataset · analysis · design · metadata · ai · nomad · validation
```

A new derived feature registers its dependency instead of modifying `State.touch()`.

## 9. Pipeline vs Actions vs services

```text
Pipeline  = establish/repair/validate deterministic scientific state
Action    = explicit researcher capability with a contract and trace
Service   = reusable deterministic implementation detail
Page      = render/interact with the above; never own scientific truth
```

Import, naming normalization, hierarchy rebuild, analysis, safe mechanical cleanup and final validation are pipeline work. They are not Actions.

## 10. Persistence

Persistence is schema-driven. `DomainSchema.snapshot(exp)` copies only roots declared persistent and returns a detached snapshot. Unknown temporary properties and runtime caches do not silently enter storage.

When a persisted object is restored, `DataModel.hydrate()` recreates the current aggregate shape and the deterministic pipeline rebuilds runtime projections.

## 11. Extension points

Use registries instead of editing central switch statements:

- record/root contract: `DomainSchema`;
- deterministic stage: `DataPipeline.register({...})`;
- derived cache invalidation: `DerivedState.register(...)`;
- Action: `actions/<id>/action.json` plus optional prompt/schema;
- Action guard: guard registry;
- Action deterministic checkpoint: Tool/Action-step registry;
- Context profile: `ContextBuilder.registerProfile(...)`.

See `docs/guides/EXTENDING_LABFLOW.md`.

## 12. Anti-patterns

Do not add:
- a second editable experiment/store;
- page-owned scientific arrays;
- duplicate record defaults outside `DomainSchema`;
- direct filename-to-identity guessing in pages;
- feature-specific patch/provenance formats;
- Action outputs at arbitrary root paths;
- pipeline stages that manually call downstream stages;
- AI parsing/calculation of deterministic scientific metrics;
- an Action for an internal service merely to expose it;
- alternate NOMAD mapping logic in the UI.
