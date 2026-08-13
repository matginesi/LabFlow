# Researcher OPERATION specification

For the complete product flow, read [`../WORKFLOW.md`](../WORKFLOW.md) first.

A LabFlow OPERATION is a **researcher-understandable goal**. Internal parsing, indexing, calculations, proposal application and validation functions are implementation services, not Workshop OPERATIONS.

## 1. OPERATION types

Only two runtime types exist:

- `DETERMINISTIC` — ordered local checkpoints; no model, prompt or provider dependency.
- `AI` — ordered local/AI checkpoints; the AI checkpoint owns a local `prompt.md` and optional structured schema.

The UI additionally describes the researcher-facing role:

- **Automatic** — necessary deterministic work LabFlow performs itself.
- **Researcher action** — deterministic mutation/export explicitly requested by the researcher.
- **AI assist** — interpretation/generation proposed by a model and bounded by deterministic context.

## 2. Public OPERATION catalog

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

`assistant.chat` is an AI capability and is visible in the Workshop so every executable OPERATION can be inspected and edited there. Non-operation helper functions remain hidden.

## 3. Source files

```text
operations/<id>/operation.json       operation contract
operations/<id>/prompt.md       AI operation prompt only
operations/schemas/*.json       structured output schema
prompts/policies/*.md      shared policies
assets/js/ai/operation-steps.js deterministic checkpoint services
assets/js/ai/operations.js      generic sequential runner
```

Generated files:

```text
assets/js/ai/operation-registry.js
assets/js/ai/prompt-bundle.js
```

Never hand-edit generated registries.

## 4. Common execution contract

### Single run

Only one Operation run is active at a time.

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

## 5. Detailed contracts

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

The OPERATION is read-only with respect to scientific values.

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

Purpose: propose missing fields of the currently selected Design experiment/device only.

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

Purpose: create the report/paper Markdown from deterministic evidence.

Checkpoints:

```text
AI generate
 ↓
store in current Report editor
```

The current editor becomes the source of truth for exports.

### `report.improve`

Purpose: revise the current Markdown using an explicit requested mode.

Checkpoints:

```text
AI improve
 ↓
store in current Report editor
```

Do not create separate OPERATIONS for Methods/Results/Discussion when they are only modes of the same document revision operation.

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

## 6. Internal operations that are not OPERATIONS

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

If a new proposed OPERATION merely wraps one of these implementation details, it should usually remain an internal service instead.

## 7. AI output budgets

Output budgets belong to the individual AI Operation contract, not to a single global provider setting.

Current contracts define operation-appropriate budgets, for example:

- ambiguity resolution: 8k output tokens;
- Design inference: 8k;
- Results interpretation: 8k;
- Report generation: 24k;
- Report improvement: 16k;
- Assistant: separate chat output setting.

A OPERATION should request the smallest budget that safely fits its intended output.

## 8. Workshop requirements

Settings → Operations Workshop is the runtime catalog/editor. Settings → AI Helpers is a filtered view of the same definitions with AI checkpoints. For each OPERATION show:

- researcher label;
- role/kind;
- why it exists;
- dependency;
- mutation scope;
- ordered checkpoints;
- prompt/schema when AI;
- output budget when AI;
- last run state.

Runtime edits are browser-local overrides; versioned `operation.json` / `prompt.md` source remains unchanged and is the reset target. AI Helpers must never create duplicate prompt/configuration state.
