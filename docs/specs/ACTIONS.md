# Researcher Action specification

For the complete product flow, read [`../WORKFLOW.md`](../WORKFLOW.md) first.

A LabFlow Action is a **researcher-understandable goal**. Internal parsing, indexing, calculations, proposal application and validation functions are implementation services, not Actions.

## 1. Action types

Three explicit execution types exist in `action.json`:

- `DETERMINISTIC` — local checkpoints only; no model, prompt or provider dependency.
- `AI` — AI checkpoints only.
- `HYBRID` — an explicit ordered mix of deterministic and AI checkpoints.

The validator derives the expected type from `steps[]`, so a mixed Action cannot be mislabeled as plain AI.

The UI additionally describes the researcher-facing role:

- **Automatic** — necessary deterministic work LabFlow performs itself.
- **Researcher action** — deterministic mutation/export explicitly requested by the researcher.
- **AI assist** — interpretation/generation proposed by a model and bounded by deterministic context.

## 2. Public Action catalog

| ID | Researcher label | Role | Provider | Mutates scientific data? | Requires |
|---|---|---|---|---|---|
| `dataset.analyze` | Analyze dataset | Automatic | No | No | current Working Copy |
| `dataset.correct-safe` | Apply safe corrections | Researcher action | No | Yes, dataset | `dataset.analyze` |
| `dataset.resolve-ambiguities` | Resolve ambiguities | AI assist | Yes | No direct write | `dataset.analyze` |
| `design.infer` | Infer missing design | AI assist | Yes | No direct write | selected Design item + deterministic evidence |
| `results.interpret` | Interpret results | AI assist | Yes | No | deterministic Results |
| `report.generate` | Generate report | AI assist | Yes | Report only | deterministic Report Context Pack |
| `report.improve` | Improve report | AI assist | Yes | Report only | current Report Markdown |
| `nomad.prepare` | Prepare NOMAD export | Researcher action | No | No scientific mutation | current Canonical Store |

`analysis.enrich` is an internal automatic hybrid Action used only after import when a provider is configured. It enriches the shared Experiment Brief and is not a researcher-facing trigger. `assistant.chat` is a normal AI Action and is visible in Settings → Actions so every executable Action can be inspected from the same registry. Implementation helper functions remain hidden.

## 3. Source files

```text
actions/<id>/action.json       Action contract
actions/<id>/prompt.md       AI prompt only
actions/schemas/*.json       structured output schema
prompts/policies/*.md      shared policies
assets/js/tools/registry.js shared Tool contracts / routing
assets/js/ai/action-steps.js deterministic service implementations
assets/js/ai/actions.js      generic sequential runner + prerequisite gate
```

Generated files:

```text
assets/js/ai/action-registry.js
assets/js/ai/prompt-bundle.js
```

Never hand-edit generated registries.

## 4. Common execution contract

### Single run

Only one Action run is active at a time.

### Automatic checkpoint advance

A successful checkpoint advances automatically. No Continue/approval gate is inserted between successful checkpoints.

### Cancellation

The running totem exposes **Stop**. Stop aborts the active run.

### AI retry

A failed AI checkpoint may automatically retry:

1. after 5 seconds;
2. after 10 seconds.

After those bounded attempts, the run stops and exposes **Retry checkpoint**. Completed earlier checkpoints are not repeated unnecessarily.

### No background orchestration

Do not introduce:

- provider queue;
- parallel model calls;
- background jobs;
- polling job manager;
- unbounded retries.

### Declarative input and Tool checkpoints

Every Action declares its context profile in `input.context`. The runner does not infer a profile from the Action ID. Deterministic checkpoints declare `tool`, not a direct function name. The shared `LF.ToolRegistry` resolves that Tool to a typed capability/service. This keeps the workflow JSON readable while leaving scientific algorithms in normal JavaScript.

`requires[]` is executable contract, not documentation: before step 1 the runner verifies that every prerequisite has a successful run for the **current Working Copy revision**. `dataset.analyze` may also be satisfied by the current deterministic analysis marker. A stale prerequisite fails closed with `ACTION_PREREQUISITE_REQUIRED`.

An Action may contain an AI step with `agent.mode: read_only_tools`. This is currently reserved for `assistant.chat`; its tool allowlist is validated at build time and again at runtime.

## 5. Detailed contracts

### `analysis.enrich` (internal automatic)

Purpose: add a provenance-marked scientific interpretation layer to the deterministic Experiment Brief when a provider is configured. It may describe likely goal, variables, meaningful comparisons, interpretations, knowledge gaps and recommended focus; it must not recalculate Results or write scientific source values. Failure is non-blocking and leaves the deterministic brief usable. The enriched brief is shared by downstream Assistant, Results, Design and Report/Paper Context Packs.

### `dataset.analyze`

Purpose: establish deterministic facts for the current revision.

Current checkpoint:

```text
analyze → dataset.analyze
```

Expected derived output:

- refreshed Canonical Store;
- deterministic Results;
- Analysis Dossier;
- safe-fix inventory;
- semantic ambiguity inventory.

The Action is read-only with respect to scientific values.

### `dataset.correct-safe`

Purpose: apply only mechanically provable corrections.

Checkpoints:

```text
scan
 ↓
apply
 ↓
commit + refresh
```

A safe correction must have an unambiguous target and deterministic justification. Applying it advances the Working Copy revision and triggers fresh deterministic analysis.

### `dataset.resolve-ambiguities`

Purpose: interpret only unresolved semantic ambiguity.

Checkpoints:

```text
collect deterministic ambiguity scope
 ↓
AI resolve
 ↓
store proposals
```

Structured output schema: `dataset_corrections`.

The model is allowed to return unresolved. It does not apply changes directly.

### `design.infer`

Purpose: propose missing fields of the currently selected Design experiment/device only. Explicit RAW fabrication evidence is projected deterministically before this Action runs; `scope.unknown_fields` is therefore the exact AI completion target, not a request to regenerate the full experiment.

Checkpoints:

```text
collect selected missing Design context
 ↓
AI infer
 ↓
validate selected-sample coverage
 ↓
store proposal
```

Structured output schema: `design_reconstruct`.

Known/user-confirmed values remain authoritative.

### `results.interpret`

Purpose: explain deterministic Results.

Checkpoints:

```text
AI interpret
 ↓
store interpretation
```

The output is prose/Markdown. AI must not replace deterministic calculations.

### `report.generate`

Purpose: create Report/Paper Markdown only after an explicit Draft action. Fresh imports keep both documents empty.

Checkpoints:

```text
collect ordered draft blocks
 ↓
AI draft each bounded block
 ↓
merge/store in current document editor
```

Every block receives the shared Experiment Brief plus bounded Results, Design, findings and provenance. Large datasets therefore do not require one giant prompt. The current editor becomes the source of truth for exports.

### `report.improve`

Purpose: revise non-empty Markdown using an explicit requested mode. Modes are grouped in the UI as **Common**, **Report** and **Paper** aids.

Checkpoints:

```text
collect target section/block(s)
 ↓
AI improve each bounded block
 ↓
merge/store in current document editor
```

Common aids include tightening, clarity and evidence checking. Report/Paper aids target the scientific sections appropriate to that document. Do not create separate Actions for Methods/Results/Discussion when they are only modes of the same document revision Action. The Report and Paper groups each expose an **All** UI orchestration that executes their section-specific modes sequentially using the same `report.improve` Action. `All` is not a new autonomous Action and does not include the Common whole-document passes. Successful researcher-triggered Actions leave a useful result in Assistant chat; textual Actions preserve their text, while non-text Actions emit a compact outcome summary.

### `nomad.prepare`

Purpose: build deterministic Canonical → NOMAD mapping and readiness validation.

Checkpoints:

```text
prepare mapping
 ↓
store revision-scoped plan
 ↓
validate package inputs
```

AI never owns NOMAD readiness.

### `analysis.summarize` (internal, auto-run)

Goal: refresh a compact deterministic statistics bundle over the current analysis.

Why it exists: Compare statistics, Report figures and NOMAD derived analysis must read the **same** per-scan statistics so they cannot diverge when the Working Copy changes. The bundle is that single source.

- kind: `DETERMINISTIC`;
- role: Automatic;
- required input/dependency: `dataset.analyze` (fresh deterministic analysis);
- mutation scope: Working Copy internal derived field only (`exp.analysisSummary`);
- ordered checkpoints: `analysis.collect` → `analysis.store`;
- output: the Analysis Dossier statistics bundle (per-scan `groupStatistics`, `metrics`, `chartData`, findings/anomalies snapshot);
- what it must not do: never mutate analysis or scientific fields; never act as a NOMAD readiness authority.

This is an internal implementation Action, not part of the public researcher catalog; it is auto-run as part of deterministic analysis and never needs a researcher trigger.

## 6. Internal services that are not Actions

The following remain hidden implementation services:

- parsing ZIP entries;
- classifying file families;
- building canonical aliases;
- building evidence/relations;
- calculating Results;
- applying an accepted AI proposal;
- re-running deterministic analysis after mutation;
- validating Design proposal coverage;
- building Report export figures;
- validating NOMAD mappings;
- serializing exports.

If a new proposed Action merely wraps one of these implementation details, it should usually remain an internal service instead.

`analysis.summarize` (§5) is the exception that already exists: it is packaged as an Action so its checkpoints and outputs are inspectable in Settings → Actions, but it stays an internal auto-run service and is not offered to the researcher as a public action.

## 7. AI output budgets

Every AI step declares a bounded `max_output_tokens` target. It is the amount appropriate for that workflow, not a copy of the model's advertised maximum. The model/provider capability is only an upper ceiling.

At runtime the effective output budget is the minimum of the declared Action/step target, any known exact model output limit or safe context-window headroom, the optional Assistant override, and the provider-level forced cap from Settings. If a future AI Action omits a target, the runner defensively falls back to 4096 tokens and the contract validator rejects the definition so the omission cannot ship unnoticed.

The current targets are intentionally task-shaped: compact Experiment Brief/Results work is around 3k, structured Design/repair work around 4k, and individual Report/Paper writing blocks around 6k. Large documents remain split into bounded sequential writing blocks even when a model can emit 64k/128k tokens.

AI steps may also declare `deadline_ms` and `max_retries`. The automatic import enrichment uses a 90 s absolute deadline and zero automatic retries; failure keeps the deterministic Experiment Brief and must not prevent ZIP import completion.

## 8. Settings → Actions requirements

Settings → Actions is the single runtime catalog/editor for deterministic, AI-assisted and hybrid definitions. For each Action show:

- researcher label;
- role/kind;
- why it exists;
- dependency;
- mutation scope;
- ordered checkpoints;
- prompt/schema when AI;
- output budget when AI;
- last run state.

Runtime edits are browser-local overrides; versioned `action.json` / optional `prompt.md` source remains unchanged and is the reset target. There is no second AI-helper configuration surface.
