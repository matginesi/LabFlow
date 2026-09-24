---
title: LabFlow documentation
section: Start here
summary: Authoritative map of product, scientific, UI and engineering documentation.
order: 0
---

# LabFlow documentation

LabFlow is deterministic-first. RAW evidence and canonical experiment data are primary; optional model calls are narrow helpers for unresolved semantics, never owners of scientific state.

## Researcher path

1. [Getting started](guides/GETTING_STARTED.md)
2. [Research workflow](guides/RESEARCH_WORKFLOW.md)
3. [Results analysis](guides/RESULTS_ANALYSIS.md)
4. [Lab Cabinet](guides/LAB_CABINET.md)
5. [Knowledge Base](guides/KNOWLEDGE_BASE.md)
6. [Design inference and confidence](guides/DESIGN_INFERENCE.md)
7. [Export projections](guides/EXPORT_PROJECTIONS.md)
8. [AI assistance](guides/AI_ASSISTANCE.md)
9. [Troubleshooting](guides/TROUBLESHOOTING.md)

## Contributor path

1. [Architecture](ARCHITECTURE.md)
2. [Data model](specs/DATA_MODEL.md)
3. [Deterministic pipeline](specs/PIPELINE.md)
4. [Actions](specs/ACTIONS.md)
5. [Context hygiene](CONTEXT_HYGIENE.md)
6. [AI providers](specs/AI_PROVIDERS.md)
7. [JavaScript modules](specs/JAVASCRIPT_MODULES.md)
8. [UI contract](UI.md)
9. [Validation](VALIDATION.md)
10. [Contributing](CONTRIBUTING.md)
11. [Code review](CODE_REVIEW.md)

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
| UI behavior | `UI.md`, `ui-kit.html`, `.agent/skills/labflow-ui/SKILL.md` |
| release quality | validators/tests, `VALIDATION.md` |

Executable manifests, schemas and validators take precedence over prose if a mismatch is found; the documentation should then be corrected.

## Generated artifacts

The in-app Documentation bundle and Action runtime matrix are generated. Do not hand-edit:

- `assets/js/pages/docs-bundle.js`
- `docs/reference/ACTION_RUNTIME_MATRIX.md`
- generated Action/KB/UI bundles

Use the builders or `./release_check.sh --fix` after changing source documentation, manifests, prompts, Knowledge Base records, or UI Kit source.
