---
title: Agent orientation
section: Engineering reference
summary: How coding agents should navigate, change and verify LabFlow.
order: 40
---

# Agent orientation

This folder is the fast path for a coding agent (or a new contributor) working in this repository. It complements, and does not replace, the authoritative specs.

Read in this order:

1. `AGENTS.md` (root) — non-negotiable invariants.
2. `docs/ARCHITECTURE.md` — ownership and authority order.
3. `docs/agents/DATA_FLOW.md` — how data actually moves, with entry points.
4. `docs/agents/UI_MAP.md` — shell, routes, pages, primitives.
5. `docs/specs/*` and `docs/guides/*` for the specific feature you touch.

## How the repository is built

- Static, local-first browser app. Vanilla JavaScript, no bundler, no framework, no build step for the app itself.
- Classic `<script>` tags with an explicit order in `index.html`; modules attach to `window.LabFlow` and required dependencies fail fast at load time.
- Some assets are generated from sources and must be rebuilt, never hand-edited:
  - `assets/js/ai/prompt-bundle.js` ← `prompts/**`
  - `assets/js/ai/action-registry.js` ← `actions/*/action.json`
  - `assets/js/knowledge/kb-bundle.js` ← `knowledge/kb.jsonl`
  - `assets/js/pages/docs-bundle.js` ← `docs/**/*.md`
  - `docs/reference/ACTION_RUNTIME_MATRIX.md` ← Action manifests
  - The UI Kit catalogue `assets/js/pages/ui-kit-inline.js` is **authored source**, not generated.
- `./release_check.sh --fix` regenerates derived assets and stamps `LABFLOW_ASSET_REV`; `./release_check.sh` verifies everything and is the gate.

## Working rules

- Find the owner before editing. Pages render, controllers coordinate, owner modules mutate.
- Keep `LF.State.state.experiment` as the only mutable scientific aggregate. Never keep a parallel copy.
- Deterministic code owns parsing, arithmetic, ranking, validation and export mapping; the model only fills unresolved semantics and only as a proposal.
- Prefer small, explicit changes. Do not add a framework, migration layer, second registry or a new storage system.
- Keep UI text English and use existing tokens/primitives (see `.agent/skills/labflow-ui/SKILL.md`).
- Comments explain *why*, invariants and boundaries — not syntax.
- When you retire a component, remove its markup, CSS and tests instead of leaving a hidden parallel implementation.

## Verification loop

```bash
./release_check.sh          # gate: generated assets, contracts, syntax, unit suites, regressions
./release_check.sh --fix    # only when you intentionally changed generated sources
./release_check.sh --full   # adds the responsive browser audit when a browser is available
```

Add the smallest test that proves the changed contract:

- owner-level unit test under `tests/unit/` for a module invariant;
- source-contract assertion when the invariant is structural (no DOM needed);
- `node tests/regression/import-page-check.js` when the change touches import/review;
- private fixture suites (`tests/unit/real-dataset-test.js`, `tests/unit/results-integration-test.js`) when real JV data is available — they are excluded from the distributable gate.

## Where to look first

| You want to change… | Start at |
|---|---|
| ZIP parsing / identity / hierarchy | `assets/js/data/parser.js`, `assets/js/data/importer.js` |
| metric calculations, findings, rankings | `assets/js/data/analysis.js`, `assets/js/data/analysis-summary.js` |
| lifecycle order / recomputation | `assets/js/data/pipeline.js`, `assets/js/experiment/derived-state.js` |
| canonical record shape or persistence | `assets/js/experiment/domain-schema.js`, `assets/js/experiment/data-model.js` |
| Design fields, proposals, acceptance | `assets/js/experiment/design-model.js`, `assets/js/experiment/design-analysis.js` |
| an Action (capability, prompts, output) | `actions/<id>/action.json`, `assets/js/ai/action-steps.js` |
| model context or provider transport | `assets/js/ai/context.js`, `assets/js/ai/transport.js` |
| a page or a shell surface | `assets/js/pages/*.js`, `index.html`, `assets/css/*` |
| reusable reference data | `assets/js/cabinet/cabinet.js`, `assets/js/knowledge/knowledge-base.js` |
| export projections | `assets/js/export/*.js` |
