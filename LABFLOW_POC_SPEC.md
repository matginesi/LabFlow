# LabFlow POC specification

## 1. Objective

LabFlow converts a researcher-supplied laboratory archive into one inspectable scientific aggregate with deterministic Results, minimal review burden, explicit Design reconstruction, optional AI assistance, reusable lab references, and deterministic export preparation.

A successful import and deterministic analysis must not depend on network access or AI availability.

## 2. Product principles

- **Local first:** scientific state, parsing, analysis, validation and export preparation run in the browser.
- **Evidence preserving:** RAW bytes and source paths remain immutable.
- **One scientific truth:** `ExperimentData` is the only mutable scientific aggregate.
- **Deterministic by default:** anything mechanically provable is handled without AI.
- **Human authority:** ambiguous semantics and AI proposals remain reviewable.
- **Traceable extension:** each cross-module structure declares an owner and persistence class.

## 3. Workspace and scientific Process

LabFlow uses the product hierarchy **User → Workspace → Process → Experiment**. Workspace is browser-local scientific context, not a second experiment database. It contains institution, role-based responsibilities, test locations, normal storage descriptors and reusable Process definitions.

A scientific Process describes a data-generating workflow (measurement, characterization, simulation, fabrication or other) and can declare sample types, controlled variables, observables, typical frequency/output size/capacity, metadata/linkage policy and stable references to Cabinet instruments, acquisition software, setups and file formats.

This Process is distinct from the per-device fabrication `Design.process`. Experiments bind to the reusable context through `meta.workspaceId` and `meta.processId`.

## 4. Scientific model

Canonical acquisition hierarchy:

```mermaid
flowchart LR
    E[Experiment] --> S[Sample / Cell]
    S --> R[Run]
    R --> M[Measurement]
    M --> Q[parameters / observables]
    M --> F[technique-specific payload; current JV FW / RV scans]
```

`DomainSchema` defines record/root contracts. `DataModel` owns aggregate mechanics. `DataContracts` validates graph invariants. `DerivedState` owns recomputable projection invalidation. `ActionData` is the only persisted Action-output store.

## 5. Deterministic lifecycle

The current pipeline is:

```mermaid
flowchart TD
    N[Normalize] --> L[Link]
    L --> VS[Validate structure]
    VS --> A[Analyze]
    A --> I[Index]
    I --> R[Review]
    R --> AC[Auto cleanup]
    AC --> PD[Project design]
    PD --> S[Summarize]
    S --> VF[Validate final]
```

Requirements:

- canonical naming and hierarchy reconstruction are deterministic;
- structural validation fails closed before dependent scientific calculations;
- JV metrics, ranking, quality state and summaries are deterministic;
- mechanically safe corrections may be detected automatically but require explicit acceptance before mutation;
- applied corrections carry provenance and trigger deterministic refresh;
- semantic uncertainty is represented as a finding/ambiguity rather than guessed;
- pipeline code never invokes an AI provider.

## 6. Review

Review exists for decisions, not for exposing parser internals. It must:

- distinguish deterministic cleanup from semantic ambiguity;
- show enough evidence to make each decision traceable;
- allow safe corrections to be accepted explicitly;
- allow AI only as a proposal mechanism for unresolved semantics;
- preserve individual override/rejection paths;
- permit clean datasets to proceed without unnecessary clicks.

## 7. Results

Results are derived exclusively from LabFlow Data and preserve JV semantics including FW/RV scans, core metrics, hysteresis, per-sample best measurement, group/experiment summaries, deterministic eligibility/quality state and raw curves when present.

AI may interpret or compare deterministic Results but may not replace or recalculate authoritative measurements.

## 8. Design and Cabinet

Design is experiment-owned scientific state. `DesignModel` is its write owner.

Lab Cabinet stores reusable laboratory references such as formulations, device stacks, fabrication recipes, materials, substrates, instruments, acquisition software, setups and file-format profiles. Cabinet is not inventory, a LIMS, or a second experiment model. Applying a Cabinet item copies a detached snapshot into Design and records the Cabinet source reference.

Cabinet content may be supplied as optional context to `design.infer`; reuse context is never evidence that an experiment actually used that recipe or device definition.

## 9. Knowledge Base

The KB consists of a bundled baseline plus a browser-local editable JSONL overlay. Each entry is validated and can carry sources, facts, cautions, aliases and relations.

The KB is reference knowledge. Assistant/Actions may retrieve bounded active entries, but experiment evidence always takes precedence. Model answers relying on KB entries use explicit `[KB:<id>]` references that the UI resolves to stored sources.

## 10. Action catalog

Current public Actions:

| Action | Target | Semantic result | State effect |
|---|---|---|---|
| `dataset.resolve-ambiguities` | unresolved review ambiguity | correction proposal | stores proposal |
| `design.infer` | one incomplete design experiment | qualitative Design proposal | stores proposal |
| `results.interpret` | deterministic Results | interpretation | stores annotation |
| `results.compare` | selected Results groups | comparison | stores annotation |
| `assistant.chat` | bounded page/experiment context | text answer | read-only |

Normalization, analysis, indexing, validation, safe cleanup and export remain deterministic services rather than Actions.

## 11. Action contract

Each public Action declares target, context profile/scope, result format/schema, effect, guards, execution steps and UI metadata in `actions/<id>/action.json`.

`ActionCapabilities` resolves bindings and guards before provider work. The Runner re-checks the same contract at execution time. Page routes influence recommendation only.

AI structured output must satisfy the declared schema and semantic validators before it can be stored.

## 12. Assistant

The Assistant is a read-only conversational surface over bounded page/experiment context, Action capability metadata, bounded Action outputs, Cabinet context when relevant, and validated KB references. It may recommend Actions but must not claim an Action executed unless LabFlow actually ran it.

## 13. AI/provider boundary

Providers are contacted directly from the browser using the configured endpoint. No hidden relay/fallback may change the request path. Provider/model configuration stays in the transport layer rather than scientific context.

Provider failures, browser/CORS failures and model-output validation failures remain distinct diagnostic categories.

## 14. Export and NOMAD

Export is a deterministic projection of validated current state. Portable saves include a redacted Workspace snapshot when available. NOMAD mapping/package generation is local and deterministic and carries stable Workspace/Process identifiers plus generic measurement technique metadata alongside optional JV metrics. The current direct-upload control is explicitly a non-networking stub until a real connector exists.

## 15. Extensibility

A new cross-module feature must declare:

- owner and mutation API;
- persistence class;
- dependency direction;
- invalidation rules for derived state;
- Action contract if researcher-facing;
- structure-catalog metadata when the shape crosses module boundaries;
- tests proving the new boundary.

Frameworks or abstraction layers are introduced only when they remove demonstrated duplication or make an invariant enforceable.

## 16. Release acceptance

A distributable release must pass `./release_check.sh`. Private real-dataset integration checks and browser automation are additional gates when their fixtures/environment are available.
