---
title: Architecture
section: Core architecture
summary: Authoritative boundaries, ownership and extension rules for the LabFlow codebase.
order: 5
---

# LabFlow architecture

This document is the architectural source of truth for contributors. LabFlow is intentionally a small local-first browser application; extensibility comes from explicit contracts and registries, not from adding framework layers. LabFlow is a static browser application; no server owns scientific state or AI transport. Provider calls are made directly from the browser to the endpoint configured by the user.

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

Scientific data changes occur only after an explicit apply/accept path owned by deterministic code. Dataset proposal acceptance goes through `LF.DatasetCorrections.commitProposals()`: it targets the current `LF.State.state.experiment`, propagates stable relations, advances the revision, invalidates derived projections, runs the deterministic pipeline, validates the final contract and only then notifies the UI/persistence layer. A no-op or a change lost during refresh is not reported as a successful mutation.

`ActionCapabilities` is the single availability/preflight service. Public Actions are globally discoverable from manifests. A route may mark an Action as recommended, but cannot add/remove it. Manifest `ui.bindings` resolve current selections/filters into Action parameters; guards, Context Packs, validators and storage checkpoints consume those resolved parameters instead of reading page UI state independently.

## 8. State and invalidation

`State` keeps scientific truth and transient interface state deliberately separate. The canonical UI namespace is `LF.State.state.ui`; route, selected record, tab, filter, zoom and page-local workbench state belong there. There is no parallel `state.route`; `state.ui.route` is the only route state. Action manifest bindings that consume a UI selection use `ui.*` paths.

Route changes reset the main workspace to its beginning. On the four primary workflow routes, the shared Previous/Next navigation is the first page card and remains sticky at the top of the main scroller. Content-defining switches inside Results, Documentation and Cabinet preserve their shared tab/filter anchor whenever geometry permits; a Settings rail selection deliberately starts the selected utility context at the workspace beginning. Shorter views clamp and never call `scrollIntoView()`. Ordinary same-context rerenders preserve the main workspace position; explicitly bounded local scroll regions are restored only within the same context.

`State.touch(scope)` advances the LabFlow Data revision and delegates feature invalidation to `DerivedState`.

The commit invariant is `state[n + 1] = acceptedMutation(state[n])`. Subsequent Actions, Results, Design, Assistant context, persistence and exports all read that same aggregate. Route changes and rerenders never reconstruct it from `raw.sourceArchive`; only explicit reset/reimport replaces the aggregate.

Typical scopes are:

```text
dataset · analysis · design · metadata · ai · nomad · validation
```

A new derived feature registers its dependency instead of modifying `State.touch()`.

## 9. Reference Knowledge Base

The Scientific Knowledge Base is a global browser/workspace reference service, not part of `ExperimentData`. It lives outside the single mutable scientific aggregate because KB statements are reusable background knowledge rather than facts about the current experiment.

```text
knowledge/kb.jsonl (source-controlled baseline)
        +
browser-local custom JSONL entries (`localStorage`)
        ↓
KnowledgeBase deterministic lexical retrieval
        ↓
ContextBuilder
   ├─ assistant.chat
   └─ design.infer
```

The scientific source baseline, browser-local custom store and portable Settings backup all use JSONL: one normalized knowledge object per line. The generated browser bundle also projects a small allowlisted set of canonical user guides into read-only `guide.*` records, so app-help answers cite the same Markdown rendered by Documentation without copying it into a database. Portable Settings backup uses the same JSONL record format, while the generated browser bundle remains an implementation artifact for `file://` support.

Only validated `active` entries are retrievable. `draft` entries persist but never enter AI context. Every active entry requires a traceable source. KB-supported Design proposals use `knowledge_reference` provenance and remain review-only; they do not become experiment evidence.

Design completion has one deterministic completeness boundary shared by inference validation, the page state and acceptance. A `design.infer` proposal is stored only when it covers every currently missing domain; in particular, stack proposals must satisfy `DesignModel.stackAssessment()`. `Accept` and `Accept all` apply only missing values, then re-run `DesignModel.missingDomains()` before setting an accepted state. Bulk acceptance also keeps same-named solution proposals separate when their scientific composition conflicts.

The browser-local overlay uses the same lightweight persistence pattern as other non-scientific workspace preferences/resources and can be exported/imported as JSON. No database, embeddings or network retrieval are required at runtime.

## 10. Pipeline vs Actions vs services

```text
Pipeline  = establish/repair/validate deterministic scientific state
Action    = explicit researcher capability with a contract and trace
Service   = reusable deterministic implementation detail
Page      = render/interact with the above; never own scientific truth
```

Import, naming normalization, hierarchy rebuild, analysis, safe-cleanup detection and final validation are pipeline work. They are not Actions. Applying a pending mechanically safe correction is an explicit Review mutation that records provenance and refreshes the pipeline.

## 11. Persistence

Persistence is schema-driven. `DomainSchema.snapshot(exp)` copies only roots declared persistent and returns a detached snapshot. Unknown temporary properties and runtime caches do not silently enter storage.

When a persisted object is restored, `DataModel.hydrate()` recreates the current aggregate shape and the deterministic pipeline rebuilds runtime projections.

## 12. Extension points

Use registries instead of editing central switch statements:

- record/root contract: `DomainSchema`;
- deterministic stage: `DataPipeline.register({...})`;
- derived cache invalidation: `DerivedState.register(...)`;
- Action: `actions/<id>/action.json` plus optional prompt/schema;
- Action guard: guard registry;
- Action deterministic checkpoint: Tool/Action-step registry;
- Context profile: `ContextBuilder.registerProfile(...)`.

See `docs/guides/EXTENDING_LABFLOW.md`.

## 13. Anti-patterns

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


## Browser AI transport

The browser remains the application runtime and the only AI transport. Local/LAN and hosted providers are called directly at the endpoint configured by the user. LabFlow has no relay/backend fallback. Local/LAN calls therefore depend on bind address, reachability, Local Network Access policy and CORS; hosted calls depend on the provider exposing browser-compatible CORS. HTTP provider errors pass through unchanged, while a browser-level CORS/network block is reported as such.

