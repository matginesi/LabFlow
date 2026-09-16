---
title: LabFlow documentation
section: Start here
summary: Authoritative map of product, architecture, scientific and engineering documentation.
order: 0
---

# LabFlow documentation

The documentation is split by **authority**, not by implementation accident. When two documents overlap, the more specific contract listed below wins.

## Start here

For a researcher:

1. [Getting started](guides/GETTING_STARTED.md)
2. [Research workflow](guides/RESEARCH_WORKFLOW.md)
3. [Lab Cabinet](guides/LAB_CABINET.md)
4. [Knowledge Base](guides/KNOWLEDGE_BASE.md)
5. [Design inference and confidence](guides/DESIGN_INFERENCE.md)
6. [AI assistance](guides/AI_ASSISTANCE.md)
7. [Troubleshooting](guides/TROUBLESHOOTING.md)

For a contributor or reviewer:

1. [Architecture](ARCHITECTURE.md)
2. [Data model](specs/DATA_MODEL.md)
3. [Deterministic pipeline](specs/PIPELINE.md)
4. [Actions](specs/ACTIONS.md)
5. [JavaScript modules](specs/JAVASCRIPT_MODULES.md)
6. [Extending LabFlow](guides/EXTENDING_LABFLOW.md)
7. [Contributing](CONTRIBUTING.md)
8. [Code review](CODE_REVIEW.md)
9. [Validation](VALIDATION.md)

## Authority map

| Concern | Authoritative source |
|---|---|
| aggregate/root ownership and dependencies | `ARCHITECTURE.md` + `DomainSchema` |
| scientific record shape/persistence | `specs/DATA_MODEL.md` + `DomainSchema` |
| deterministic lifecycle | `specs/PIPELINE.md` + `DataPipeline` registry |
| Action behavior | `specs/ACTIONS.md` + `actions/*/action.json` |
| AI transport/provider behavior | `specs/AI_PROVIDERS.md` + provider/transport modules |
| reusable lab resources | `guides/LAB_CABINET.md` + `Cabinet` registry |
| reference knowledge | `guides/KNOWLEDGE_BASE.md` + JSONL schema/validator |
| Design inference source hierarchy/confidence | `guides/DESIGN_INFERENCE.md` + `design.infer` runtime/validators |
| UI primitives and interaction | `UI.md` + `.agent/skills/labflow-ui/SKILL.md` |
| release gates | `VALIDATION.md` + validator/test source |

Executable manifests, schemas and validators take precedence over prose when a mismatch is discovered. The mismatch should then be fixed as documentation debt.

## Generated documentation

The in-app Documentation route is generated from `docs/**/*.md` by `tools/build_docs_bundle.py`. `assets/js/pages/docs-bundle.js` is an artifact and must not be edited directly.

The Action runtime matrix is generated from Action manifests. Rebuild generated references after source changes.


## Design inference semantics

The authoritative explanation of Design source hierarchy, Cabinet/KB reference fallback, known unknowns and confidence calibration is [Design inference and confidence](guides/DESIGN_INFERENCE.md). Keep other documentation consistent with that guide rather than redefining confidence ad hoc.
