# LabFlow

Local-first browser workbench for perovskite/JV laboratory experiments.

The researcher workflow is deliberately small:

```text
Upload & Review → Results → Design → Report → Changes → NOMAD
```

The uploaded ZIP is immutable source evidence. LabFlow immediately snapshots its bytes and performs all work on one separate in-memory **Working Copy**.

## Start here

For architecture, data lifecycle, Action behavior, Review/Design/Results/Report/NOMAD flow and AI boundaries, read:

**[`docs/WORKFLOW.md`](docs/WORKFLOW.md)**

Supporting specifications:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/specs/DATA_MODEL.md`](docs/specs/DATA_MODEL.md)
- [`docs/specs/ACTIONS.md`](docs/specs/ACTIONS.md)
- [`docs/specs/TOOLS.md`](docs/specs/TOOLS.md)
- [`docs/AI.md`](docs/AI.md)
- [`docs/specs/IMPORT_EXPORT.md`](docs/specs/IMPORT_EXPORT.md)
- [`docs/NOMAD.md`](docs/NOMAD.md)
- [`LABFLOW_POC_SPEC.md`](LABFLOW_POC_SPEC.md)

## Core model

```text
Original ZIP (immutable)
        ↓
Working Copy
        ↓
Canonical Data Model / Store
        ↓
Tool Registry
   ┌────┴──────────────┐
   ↓                   ↓
Actions          Assistant (read-only)
   ↓                   ↓
validated writes   selected observations
   └──────────┬────────┘
              ↓
          Working Copy
```

Original filenames remain provenance and aliases; they are not blindly treated as scientific identity.

## Researcher Actions

Settings → Actions exposes every executable Action in the webapp:

- Analyze dataset — deterministic automatic;
- Apply safe corrections — deterministic action;
- Resolve ambiguities — AI assist;
- Infer missing design — AI assist;
- Interpret results — AI assist;
- Generate report — AI assist;
- Improve report — AI assist;
- Prepare NOMAD export — deterministic action.

`assistant.chat` is also visible in Actions so its prompt/runtime definition can be inspected and edited. Internal helper functions remain implementation details rather than Actions.

Internal compute/index/apply/validation functions are not Actions.

## Tools and bounded agentic Assistant

LabFlow separates **Tools** from **Actions**. A Tool is a small typed capability over the Canonical Data Model; an Action is a researcher-understandable workflow that composes deterministic tools and optional AI steps. Deterministic Action checkpoints now reference Tool IDs from the shared registry instead of calling page-specific logic.

The Assistant is the first deliberately constrained agentic consumer of that registry. It may ask the model to choose among an explicit allowlist of **read-only** tools, execute one tool per bounded round, then answer from the returned observations. It cannot invoke write tools, mutate the Working Copy or autonomously run mutating Actions. See [`docs/specs/TOOLS.md`](docs/specs/TOOLS.md).

## Save and export

The uploaded source is never rewritten.

**Save** marks an explicit checkpoint for the current revision. The Working Copy is autosaved locally and restored when LabFlow is reopened; **Reset session** deliberately clears that persisted scientific session. Provider/model settings, API key and UI preferences remain browser-local but separate. **Export** explicitly creates the durable LabFlow ZIP.

LabFlow ZIP, Report PDF/DOCX and NOMAD ZIP are explicit derived exports: they read the current Working Copy but do not implicitly mark later edits saved.

Changes audits the current Working Copy against the immutable post-import baseline, including manual versus AI-attributed Report/Paper edits.

Normal LabFlow export includes `canonical.json`, a compact portable semantic snapshot with identities, aliases, measurements, relations, evidence, findings, patches, Design and provenance. RAW source remains separate.

## Report

Report and Paper keep separate Markdown text, titles and figure selections. The active editor is the textual source of truth and supports standard inline `$...$` and display `$$...$$` LaTeX. Preview typesets equations locally; `.tex` preserves LaTeX and DOCX/PDF embed display equations together with only the explicitly selected deterministic figures.

## NOMAD

NOMAD is deterministic-first. One Canonical → NOMAD mapping plan powers the UI, local validation and generated package. AI never decides readiness.

## Run

No Node.js application server or backend is required. The POC is static. AI providers are called directly from the browser and connection settings are stored locally in the browser.

For **local LLM providers**, LabFlow calls LM Studio or Ollama directly through the OpenAI-compatible `/v1/chat/completions` contract; no Python application server is required. The provider only needs to be running and accept the current browser origin. Active-model detection runs only when **Detect** or the connection test is explicitly started; thinking/no-thinking fields are applied only when the provider adapter declares them. See [`docs/specs/AI_PROVIDERS.md`](docs/specs/AI_PROVIDERS.md).

## Build and verify

```bash
python tools/build_prompt_bundle.py
python tools/build_action_registry.py
python tools/build_ui_kit_inline.py
python tools/validate_action_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
find assets/js tests -name '*.js' -print0 | xargs -0 -n1 node --check
```

`ui-kit.html` is the visual ground truth. The in-app UI Kit route renders a generated inline mirror (`assets/js/pages/ui-kit-inline.js`) so the POC remains safe when opened directly with `file://`; rebuild it with `python tools/build_ui_kit_inline.py` after changing the UI Kit.


### Action progress and adaptive output budgets

Long Actions expose monotonic semantic progress: checkpoint, work unit, provider phase and bounded SSE/token telemetry. Streaming events refine only the response-generation segment, so a model can no longer leave the UI at 99% while it is still producing output. Sequential helpers such as Design completion and Report/Paper **All** project child progress into one global bar.

AI output uses per-step `min_output_tokens`, `target_output_tokens` and `max_output_tokens`. The selected model/provider maximum is a ceiling, never an automatic generation target. Report/Paper work units also carry word targets so writing requests can be substantially longer than compact analysis/enrichment Actions without requesting unnecessarily huge outputs.

Design supports **Apply all AI inferences** across per-variant proposals. Applying a proposal does not imply that a variant is complete; unresolved source gaps remain visible. Report and Paper have independent figure selections through a dedicated figure picker.
