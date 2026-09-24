# LabFlow

LabFlow is a local-first browser application for turning laboratory archives into an inspectable scientific data model, deterministic analysis, reviewable experiment Design, and deterministic export packages. AI is optional and deliberately narrow.

The application is vanilla JavaScript + CSS + static assets. There is no application backend and no in-browser model runtime.

## Core rule

**LabFlow solves what it can in code and asks a model only about unresolved semantics.**

The authority order is:

1. RAW evidence;
2. canonical `ExperimentData`;
3. deterministic rules and analysis;
4. Workspace / Process / Cabinet / Knowledge Base references;
5. optional model suggestion;
6. explicit researcher review when scientific state could change.

A model never owns parsing, arithmetic, ranking, validation, export mapping, or canonical mutation.

## Scientific model

The product model remains:

```text
User → Workspace → Process → ExperimentData
                              ├─ experiments
                              ├─ samples
                              ├─ runs
                              ├─ measurements
                              ├─ findings
                              └─ design
```

RAW archive bytes and original source identity remain evidence. `ExperimentData` is the single mutable scientific aggregate. Workspace, Process, Cabinet and Knowledge Base are contextual/reference stores, not measurement evidence.

## Deterministic pipeline

```text
ZIP
 → inspect archive
 → parse supported files
 → canonicalize names/relations
 → validate structure
 → deterministic analysis
 → detect safe cleanup + review findings
 → Results / Design / Export
```

Import, parsing, normalization, linking, JV calculations, ranking, validation, summaries, Results interpretation/comparison, and export metadata preparation do not require an AI provider.

Results also exposes deterministic quality/reproducibility analytics: eligible/validated coverage, paired FW/RV separation and hysteresis, within-group median/IQR/CV, and descriptive PCE relationships with Voc/Jsc/FF/hysteresis. These calculations use zero AI tokens.

## Actions

Actions remain the typed application boundary. Their JSON contracts are for LabFlow, tests and UI; they are **not copied into model prompts**.

| Action | Mode | Provider use |
| --- | --- | --- |
| `results.interpret` | deterministic | none |
| `results.compare` | deterministic | none |
| `export.prepare` | deterministic | none |
| `dataset.resolve-ambiguities` | hybrid | only unresolved semantic findings |
| `design.infer` | hybrid | only domains unresolved after evidence/Cabinet/KB |
| `assistant.chat` | read-only | only when a deterministic Assistant fast-path cannot answer |

Deterministic Actions still use the normal Action lifecycle so status, logging, UI and provenance remain consistent.

## Small-model strategy

LabFlow is designed so a small model does not need to understand the whole application.

- prompts are task-specific and short;
- Action manifests/contracts and full JSON schemas stay application-side;
- deterministic code reduces the input before generation;
- Design resolves references before creating any model work unit;
- a Design run creates zero model work when all pending domains are covered;
- ambiguity resolution sends only active ambiguous findings plus linked evidence;
- no automatic semantic retry loops are used;
- model output is validated deterministically before it can become a proposal.

This keeps the provider boundary usable with roughly 500–600M-class models without adding WebGPU, wllama, Transformers.js, ONNX, model downloads, or another runtime layer to the browser app.

## Assistant

The Assistant is read-only. A conservative deterministic fast-path answers common factual questions with **zero provider calls**, including:

- measurement/sample/experiment counts;
- best eligible PCE;
- open findings;
- flagged/anomalous measurements;
- a compact Results summary.

Questions that require interpretation beyond those known facts fall through to one bounded provider request. Assistant messages are explicitly labelled **LOCAL · 0 tokens** or **LLM**. Normal Assistant turns stay entirely inside the conversation: transient progress is shown inline and LLM telemetry (provider/model, token usage, TTFT, tok/s, reasoning and grounding) lives under that message's **Details**. The Action Totem is reserved for explicit researcher Actions; the model does not orchestrate hidden workflows.
The Assistant keeps a 2000-token Action input ceiling. If a prepared context is too large, LabFlow compacts it by priority instead of immediately failing: conversation memory and Action history go first, followed by redundant broad context and secondary records, while the current question and focused experiment facts are preserved.

Assistant reasoning is configurable as **Prefer off / Automatic / Prefer on**. Provider-native reasoning and `<think>`, `<thinking>`, `<analysis>` or `<reasoning>` blocks are separated from the visible answer and exposed only under message **Details**. Prefer off is the default for small/fast models.

## Design

Design completion uses this hierarchy:

```text
experiment evidence
 → compatible Cabinet reference
 → targeted Knowledge Base reference
 → optional model inference for unresolved domains
 → unresolved
```

Deterministic/reference-backed values win. Model output may fill only domains still unresolved, is validated, and remains a reviewable proposal. Reference provenance is never rewritten as RAW experiment evidence.

The Knowledge Base has two compact views: Design receives bibliography-free structured candidates (`KB:<id>` + `design_hint`), while reference-seeking Assistant questions may receive compact bibliographic sources so `[KB:<id>]` citations remain traceable. Assistant KB retrieval is based on the user question itself, with a higher relevance threshold; vague questions do not pull unrelated entries. Citations are validated against the exact KB ids supplied to the model, and unsupported ids cause the answer to be rejected rather than shown as grounded. The full KB is never pasted into a model prompt.

## Export

NOMAD mapping, validation, readiness and package generation are deterministic. `export.prepare` reports remaining metadata that cannot be populated from current canonical Workspace/Process/Cabinet/Experiment data; it does not invent values. Manual projection overrides stay export-only and never mutate scientific source truth. Ready-PV remains a secondary projection.

## Providers

Provider configuration is optional. Hosted providers are called directly from the browser through the existing provider boundary. Local OpenAI-compatible endpoints are also supported as external services.

`labflow_engine.sh` is intentionally retained as the supported helper for running/diagnosing a local `llama.cpp` OpenAI-compatible server. LabFlow itself does not download or execute models in the browser.

## Run locally

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`.

## Verification

Run the project release gate:

```bash
./release_check.sh
```

Unit tests can also be run directly:

```bash
node tests/unit/run.js
```

Canonical generated artifacts are rebuilt from source with the scripts under `tools/`; do not edit generated bundles by hand.

Long explicit Actions use one Action Totem: Overall progress and elapsed time stay visible. Deterministic runs show only local progress and relevant operation metrics. Provider/model, generated tokens, tok/s, TTFT, reasoning and request/response traces appear only after that Action actually sends a model request. Request payloads, budgets, checklists and history live under **Technical data**.

## Repository map

```text
actions/             Action manifests, model prompts and output schemas
assets/js/data/      import, deterministic pipeline and analysis
assets/js/experiment canonical scientific model and ownership
assets/js/cabinet/   reusable laboratory references
assets/js/knowledge/ scientific reference library
assets/js/export/    deterministic projections and packages
assets/js/ai/        optional provider transport, compact context and Action runtime
assets/js/pages/     route UI
docs/                canonical documentation
knowledge/           bundled JSONL knowledge
tests/               unit/regression fixtures
tools/               builders and validators
TEST_DATA/           retained test archives
labflow_engine.sh     retained llama.cpp helper
```

## Documentation

Start from [`docs/README.md`](docs/README.md). The most important contracts are:

- `docs/ARCHITECTURE.md`
- `docs/specs/DATA_MODEL.md`
- `docs/specs/PIPELINE.md`
- `docs/specs/ACTIONS.md`
- `docs/CONTEXT_HYGIENE.md`
- `docs/VALIDATION.md`
- `docs/guides/DESIGN_INFERENCE.md`
- `docs/guides/AI_ASSISTANCE.md`
- `docs/guides/EXPORT_PROJECTIONS.md`

LabFlow is a proof of concept, not a production LIMS. Prefer explicit deterministic behavior and traceable evidence over framework complexity.
