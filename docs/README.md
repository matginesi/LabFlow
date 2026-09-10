---
title: LabFlow documentation
section: Start here
summary: The shortest useful path through LabFlow guides and technical contracts.
order: 0
---

# LabFlow documentation

LabFlow turns an immutable laboratory ZIP into one reviewed data model, deterministic Results, an explicit Design and a validated NOMAD export.

## Choose one path

### Use LabFlow

1. [Start with LabFlow](guides/GETTING_STARTED.md)
2. [Research workflow](guides/RESEARCH_WORKFLOW.md)
3. [AI assistance](guides/AI_ASSISTANCE.md)
4. [Troubleshooting](guides/TROUBLESHOOTING.md)

### Understand the scientific model

1. [Data model](specs/DATA_MODEL.md)
2. [Deterministic pipeline](specs/PIPELINE.md)
3. [Actions](specs/ACTIONS.md)
4. [Import and export](specs/IMPORT_EXPORT.md)

### Change the application

1. [Architecture](ARCHITECTURE.md)
2. [Extending LabFlow](guides/EXTENDING_LABFLOW.md)
3. [JavaScript modules](specs/JAVASCRIPT_MODULES.md)
4. [UI contract](UI.md)
5. [Validation](VALIDATION.md)

## Four rules

- The uploaded ZIP is immutable evidence.
- `ExperimentData` is the only mutable scientific aggregate.
- Calculations and mechanically safe-cleanup detection are deterministic; cleanup mutates LabFlow Data only after explicit acceptance.
- AI proposes or interprets; it does not silently change scientific data.

The executable Action definitions, schemas and validators must agree with the specifications. Generated bundles are build artifacts, not editing sources.

## Rebuild generated references

```bash
python tools/build_prompt_bundle.py
python tools/build_knowledge_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py
```
