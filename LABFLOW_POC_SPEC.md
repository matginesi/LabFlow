# LabFlow POC specification

## 1. Product objective

LabFlow turns a researcher-supplied archive into one inspectable LabFlow Data with deterministic Results, minimal review burden, explicit Design reconstruction, optional AI assistance and deterministic export preparation.

A successful import must not depend on AI availability.

## 2. Source of truth

`ExperimentData` is the only scientific aggregate used by importer, pipeline, Results, Review, Design, Actions, Assistant and NOMAD services.

Hierarchy:

```text
Experiment → Sample/Cell → Run → Measurement → FW/RV scans
```

RAW files are immutable. LabFlow Data changes are patch/provenance tracked.

## 2a. Architecture kernel

The codebase must keep these responsibilities separate:

- `DomainSchema`: canonical record/root definitions and persistence metadata;
- `ExperimentData`: one aggregate/query/mutation API;
- `DataContracts`: fail-closed graph/invariant validation;
- `DerivedState`: declarative invalidation of recomputable projections;
- `DataPipeline`: deterministic lifecycle;
- `ActionData`: the only persisted store for Action proposals/annotations/status.

No feature may introduce a parallel editable scientific model or ad-hoc Action-output root fields.

## 3. Import and deterministic pipeline

The import pipeline is:

```text
normalize
→ link
→ validate-structure
→ analyze
→ index
→ review
→ auto-cleanup
→ project-design
→ summarize
→ validate-final
```

Requirements:

- canonical naming is automatic;
- hierarchy/backlinks are rebuilt deterministically;
- JV metrics/results are deterministic;
- mechanically provable corrections are detected automatically, shown as pending, and applied only to LabFlow Data after explicit researcher acceptance;
- every automatic correction has provenance;
- semantic ambiguity is never guessed deterministically;
- pipeline validation fails closed on an inconsistent domain graph;
- the pipeline never performs an AI request.

## 4. Review UX

Review should demand researcher attention only when necessary:

- show how many names/corrections were handled automatically;
- show semantic ambiguities separately;
- offer one `Resolve with AI` action when ambiguities exist;
- store AI suggestions without auto-applying them;
- allow `Apply all suggestions` plus individual review/override;
- keep diagnostics/provenance available but secondary.

If no semantic ambiguity exists, the researcher should be able to proceed directly to Results.

## 5. Results contract

Results are calculated from the LabFlow Data and retain JV semantics from the reference analyzer:

- paired FW/RV scans;
- Voc, Jsc, Vmpp, Jmpp, Pmpp, Rs, Rsh, FF, Eff;
- hysteresis `(EffRV - EffFW) / EffRV` where defined;
- best measurement per sample/cell;
- group/experiment summaries and rankings;
- deterministic quality/eligibility state;
- raw FW/RV curve arrays when available.

AI may interpret these results but may not recalculate or replace them.

## 6. Action catalog

| Action | Target | Result | Effect |
|---|---|---|---|
| `dataset.resolve-ambiguities` | active semantic ambiguities | structured correction proposal | store proposal |
| `design.infer` | one incomplete design experiment | structured qualitative design suggestion | store proposal |
| `results.interpret` | current deterministic Results | structured interpretation | store derived annotation |
| `results.compare` | 2+ selected result groups | structured comparison | store derived annotation |
| `assistant.chat` | current page/experiment context | text answer | read-only |

Anything that merely normalizes, analyzes, indexes, validates or exports belongs to deterministic pipeline/services rather than the Action catalog.

## 7. Action manifest contract

Every Action must declare:

```text
contract.target
  kind
  cardinality

contract.context
  profile
  scope

contract.result
  format
  schema?
  kind

contract.effect
  mode
  writes[]

contract.guards[]

execution
  mode
  result_step
  steps[]

ui                   # public Actions
  command
  routes[]            # recommendation only
  bindings?           # Action parameter -> application-state path
```

The manifest is the source of truth for execution, target bindings, command discovery and UI introspection.

## 8. Guard contract

Current guard families include:

- `dataset.loaded`
- `review.ambiguities_available`
- `design.incomplete_target`
- `results.available`
- `results.compare_groups`
- `assistant.question`

`ActionCapabilities` resolves manifest bindings and evaluates these guards before any execution UI/provider check. Every public Action remains visible in the global catalog; the current page only changes whether it is recommended. Guard failure means the Action is unavailable for the current state, not that the provider failed. The Runner resolves/rechecks the same bindings and guards immediately before execution.

## 9. AI boundary

AI is explicit and optional. It may:

- resolve semantic ambiguity by proposal;
- complete missing qualitative Design content by reviewable proposal;
- bulk Design completion reuses the same per-experiment inference Action, verifies persistence for each target, and preserves pending/error states truthfully when a run stops or fails;
- interpret deterministic Results;
- compare selected Results groups;
- answer read-only questions.

It must not silently mutate RAW data, recalculate deterministic metrics, or fabricate missing quantitative evidence. Insufficient scientific evidence is a valid non-error outcome where the Action schema allows it.

## 10. Extensibility

A new Action is added under `actions/<action-id>/` with `action.json` and optional `prompt.md` / `schema.json`. Public Actions declare their command, recommended routes and any state bindings in the manifest. Registry discovery, capability preflight, context profiles, guards and Action-step tools are extensible without a central Action whitelist or Action-ID switches in the Assistant.

A new deterministic transformation should normally be a `DataPipeline.register(...)` stage or internal service, not an Action.

## 11. NOMAD

NOMAD export is deterministic and built from the current validated LabFlow Data. It is not an AI Action. Export also exposes an explicitly labelled direct-upload stub; Settings may retain the future endpoint/account/token locally, but the stub performs no network request and no upload.

## 12. Console API

The running data model and contracts are inspectable through:

```js
LabFlow.Data.current()
LabFlow.Data.summary()
LabFlow.Data.tree()
LabFlow.Data.validate()
LabFlow.Data.pipeline()
LabFlow.Data.actions()
LabFlow.Data.contracts()
```

## 13. Validation

A release must pass unit tests, Action/State/UI/Privacy validators, JavaScript syntax checks and the real JV fixture hierarchy regression.
