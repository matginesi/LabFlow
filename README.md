# LabFlow

Local-first browser workbench for perovskite/JV laboratory experiments.

```text
Upload & Review → Results → Design → Report → NOMAD
```

LabFlow treats the uploaded laboratory ZIP as **immutable source evidence**. It creates one separate editable **Working Copy**, builds a deterministic semantic/analysis layer over it, and uses optional AI only for bounded interpretation, suggestions and scientific writing.

## What LabFlow does

From one experiment ZIP, LabFlow can:

- inventory and parse known laboratory files;
- recover deterministically available JV information from redundant source representations;
- resolve canonical sample identities while retaining filenames/aliases as provenance;
- calculate deterministic JV Results, rankings, comparisons and quality findings;
- review safe corrections and genuine ambiguities;
- maintain solution chemistry and device-stack Design;
- optionally use AI to enrich context, suggest missing Design, interpret Results and draft/edit documents;
- keep Lab Report and Scientific Paper as editable Markdown sources of truth;
- validate and prepare deterministic Canonical → NOMAD exports;
- autosave the Working Copy locally and create explicit durable exports.

## Core logic

```text
Original ZIP (immutable)
        ↓
Deterministic import / recovery
        ↓
Working Copy  ←──── accepted researcher changes
        ↓
Canonical Store + evidence / relations
        ↓
Deterministic analysis
   ┌────┼───────────────┬─────────────┐
   ↓    ↓               ↓             ↓
Review Results         Design        NOMAD
        │               │
        └──────┬────────┘
               ↓
       bounded AI Context Packs
               ↓
        optional AI provider
               ↓
 interpretation / proposal / draft
               ↓
 local validation + researcher review
```

The Canonical Store is a deterministic semantic index over the Working Copy, not a second editable experiment.

## Documentation

Start with **[`docs/README.md`](docs/README.md)**. It contains reading paths for researchers, scientific/data work, AI/provider integration and engineering.

Recommended first pages:

- [`docs/guides/GETTING_STARTED.md`](docs/guides/GETTING_STARTED.md) — first import and normal workflow;
- [`docs/guides/HOW_LABFLOW_WORKS.md`](docs/guides/HOW_LABFLOW_WORKS.md) — the logic behind LabFlow end to end;
- [`docs/guides/DATA_LIFECYCLE.md`](docs/guides/DATA_LIFECYCLE.md) — RAW → Working Copy → Canonical Store → derived outputs;
- [`docs/guides/AI_ASSISTANCE.md`](docs/guides/AI_ASSISTANCE.md) — where AI is allowed and where it is not;
- [`docs/guides/AI_TOKENS_AND_RATE_LIMITS.md`](docs/guides/AI_TOKENS_AND_RATE_LIMITS.md) — request budgets, streaming, local truncation and provider cooldowns;
- [`docs/guides/TROUBLESHOOTING.md`](docs/guides/TROUBLESHOOTING.md) — how to read common LabFlow logs.

Canonical technical references include:

- [`docs/WORKFLOW.md`](docs/WORKFLOW.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/specs/DATA_MODEL.md`](docs/specs/DATA_MODEL.md)
- [`docs/specs/ACTIONS.md`](docs/specs/ACTIONS.md)
- [`docs/specs/TOOLS.md`](docs/specs/TOOLS.md)
- [`docs/AI.md`](docs/AI.md)
- [`docs/specs/AI_PROVIDERS.md`](docs/specs/AI_PROVIDERS.md)
- [`docs/specs/IMPORT_EXPORT.md`](docs/specs/IMPORT_EXPORT.md)
- [`docs/NOMAD.md`](docs/NOMAD.md)
- [`docs/UI.md`](docs/UI.md)
- [`docs/VISUAL_LANGUAGE.md`](docs/VISUAL_LANGUAGE.md)
- [`docs/LOGGING.md`](docs/LOGGING.md)
- [`docs/VALIDATION.md`](docs/VALIDATION.md)
- [`LABFLOW_POC_SPEC.md`](LABFLOW_POC_SPEC.md)

The in-app **Documentation** page is generated from the versioned Markdown under `docs/` and works without a documentation backend.

## AI design

AI is not required for the core import/Results/NOMAD pipeline.

Every AI Action is a versioned contract under `actions/` with explicit context profile, input cap, output target/ceiling, deadline and retry policy. Structured Actions also use JSON schemas.

`analysis.enrich` is intentionally a **micro semantic layer**, not a second analysis engine. It receives a compact experiment summary and adds only likely goal, variables, comparisons, labelled interpretations/hypotheses and important metadata gaps. Current defaults are bounded to roughly **3,200 input tokens**, **320 target output tokens** and a **700-token ceiling**; failure never blocks import.

For Z.AI `glm-4.7-flash`, LabFlow does **not** change model or fall back automatically. A 429/`1305` opens a provider-wide persisted cooldown; no hidden HTTP retry is sent, and bulk workflows stop while preserving completed work. See [`docs/guides/AI_TOKENS_AND_RATE_LIMITS.md`](docs/guides/AI_TOKENS_AND_RATE_LIMITS.md).

## Storage and privacy

The POC is static and local-first:

- source snapshot + Working Copy are autosaved in IndexedDB;
- provider/model/UI preferences and provider-scoped API keys are stored browser-locally;
- short-lived provider cooldown metadata is stored locally to prevent immediate retry storms after reload;
- scientific parsing/calculation/validation/export runs in the browser;
- only configured AI Actions send bounded request context to the selected external provider.

API credentials are redacted from structured logs. The uploaded ZIP is never overwritten.

## Local providers

LM Studio, Ollama and llama.cpp (`llama-server`) use the same OpenAI-compatible Chat Completions transport as cloud providers. No Python application backend is required. The local server must be running and allow the browser origin (CORS). The llama.cpp preset defaults to `http://127.0.0.1:8080/v1`, discovers served model IDs through `/v1/models`, and reads the effective **per-slot** context plus slot count from `/props`.

For LabFlow, the recommended llama.cpp runtime is deliberately **single-slot**: `--parallel 1 --ctx-size 65536`. With that profile, `/props.default_generation_settings.n_ctx` should report `65536` and `total_slots` should report `1`; LabFlow uses the full 65K runtime context and does not divide it again. Detect reports a clear runtime-profile mismatch if the server is started with a different slot/context configuration. Reasoning remains a per-Action concern: LabFlow sends explicit reasoning-off controls only for Actions that declare `thinking: off`, while reasoning-capable Actions may use the server/model default. The connection probe distinguishes HTTP/API reachability from final-text quality, so an HTTP 200 reasoning-only bounded probe is reported as reachable/inconclusive rather than as a network failure.

Recommended launcher core:

```bash
llama-server \
  --model /path/to/model.gguf \
  --alias local-model \
  --ctx-size 65536 \
  --parallel 1 \
  --host 127.0.0.1 \
  --port 8080 \
  --jinja
```

A local provider returning HTTP 200 while a remote provider returns immediate 429 is a useful diagnostic distinction: it isolates provider availability from LabFlow's deterministic import/Action pipeline.

## Build and verify

After changing prompts, Actions, schemas or documentation, rebuild generated assets before testing:

```bash
python tools/build_prompt_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py
```

Then run:

```bash
python tools/validate_action_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
find assets/js tests -name '*.js' -print0 | xargs -0 -n1 node --check
```

`ui-kit.html` is the visual component/theme ground truth. The application uses the same token/primitive system and the in-app UI Kit is a generated file-safe mirror.
