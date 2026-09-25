---
title: LabFlow documentation
section: Start here
summary: Authoritative map of product, scientific, UI and engineering documentation.
order: 0
---

# LabFlow documentation

LabFlow is deterministic-first. RAW evidence and canonical experiment data are primary; optional model calls are narrow helpers for unresolved semantics, never owners of scientific state.

## Researcher path

1. [Getting started](guides/GETTING_STARTED.md) — the shortest end-to-end path.
2. [Using LabFlow](guides/USING_LABFLOW.md) — every route and Settings section at a glance.
3. [Research workflow](guides/RESEARCH_WORKFLOW.md) — how the four workflow steps fit together.
4. [Results analysis](guides/RESULTS_ANALYSIS.md)
5. [Lab Cabinet](guides/LAB_CABINET.md)
6. [Knowledge Base](guides/KNOWLEDGE_BASE.md)
7. [Design inference and confidence](guides/DESIGN_INFERENCE.md)
8. [Export projections](guides/EXPORT_PROJECTIONS.md)
9. [AI assistance](guides/AI_ASSISTANCE.md)
10. [Browser Local AI](guides/BROWSER_LOCAL_AI.md)
11. [Data management](guides/DATA_MANAGEMENT.md)
12. [NOMAD](NOMAD.md)
13. [Troubleshooting](guides/TROUBLESHOOTING.md)

## Contributor path

1. [Architecture](ARCHITECTURE.md)
2. [Data model](specs/DATA_MODEL.md)
3. [Deterministic pipeline](specs/PIPELINE.md)
4. [Actions](specs/ACTIONS.md)
5. [Import/export contract](specs/IMPORT_EXPORT.md)
6. [Context hygiene](CONTEXT_HYGIENE.md)
7. [AI providers](specs/AI_PROVIDERS.md)
8. [JavaScript modules](specs/JAVASCRIPT_MODULES.md)
9. [Tool registry](specs/TOOLS.md)
10. [UI contract](UI.md)
11. [Logging](LOGGING.md)
12. [Privacy](PRIVACY.md) and [Security](SECURITY.md)
13. [Validation](VALIDATION.md) and [test fixtures](specs/TEST_FIXTURES.md)
14. [Extending LabFlow](guides/EXTENDING_LABFLOW.md)
15. [Contributing](CONTRIBUTING.md) and [code review](CODE_REVIEW.md)

## Agent path

Start here when an autonomous coding agent works in this repository:

1. [Agent orientation](agents/README.md) — working rules and verification loop.
2. [Agent data flow](agents/DATA_FLOW.md) — ZIP → canonical → derived → design → export, with entry points.
3. [Agent UI map](agents/UI_MAP.md) — shell, routes, rendering model and page map.
4. [Contributing](CONTRIBUTING.md) and `.agent/skills/labflow-ui/SKILL.md` — change discipline and UI rules.

## Scientific data reference

- [Data format](data/DATA_FORMAT.md), [file naming](data/FILE_NAMING.md), [measurements](data/MEASUREMENTS.md)
- [Recovery rules](data/RECOVERY_RULES.md) and the [glossary](data/GLOSSARY.md)

## Authority map

| Concern | Authority |
|---|---|
| scientific aggregate and ownership | `DomainSchema`, `ARCHITECTURE.md`, `specs/DATA_MODEL.md` |
| deterministic import/analysis | `DataPipeline`, `specs/PIPELINE.md` |
| Action behavior | `actions/*/action.json`, `specs/ACTIONS.md` |
| model context | `assets/js/ai/context.js`, `CONTEXT_HYGIENE.md` |
| provider transport | provider/transport modules, `specs/AI_PROVIDERS.md` |
| reusable lab resources | Cabinet registry, `guides/LAB_CABINET.md` |
| scientific reference knowledge | `knowledge/kb.jsonl`, KB validator, `guides/KNOWLEDGE_BASE.md` |
| Design source hierarchy | `design.infer` runtime, `guides/DESIGN_INFERENCE.md` |
| Results calculations | analysis modules, `guides/RESULTS_ANALYSIS.md` |
| UI behavior | `UI.md`, `assets/js/pages/ui-kit-inline.js`, `.agent/skills/labflow-ui/SKILL.md` |
| agent navigation | `docs/agents/*`, `AGENTS.md` |
| release quality | validators/tests, `VALIDATION.md` |

Executable manifests, schemas and validators take precedence over prose if a mismatch is found; the documentation should then be corrected.

## Generated artifacts

The in-app Documentation bundle and Action runtime matrix are generated. Do not hand-edit:

- `assets/js/pages/docs-bundle.js`
- `docs/reference/ACTION_RUNTIME_MATRIX.md`
- generated Action/KB bundles

Use the builders or `./release_check.sh --fix` after changing source documentation, manifests, prompts or Knowledge Base records. The UI Kit catalogue is authored source, so edit it directly and verify with `./release_check.sh`.

## Browser Local AI

- [Browser Local AI](guides/BROWSER_LOCAL_AI.md) — GGUF lifecycle, cache, WebGPU/WASM fallback and startup warmup.
