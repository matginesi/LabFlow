---
title: LabFlow documentation map
section: Researcher guide
summary: Choose the shortest path through the LabFlow documentation, from first import to engineering reference.
order: 0
---

# LabFlow documentation map

LabFlow is a local-first scientific workbench that turns an immutable laboratory ZIP into one reviewed **Working Copy**, deterministic Results, an explicit Design, scientific documents and a deterministic NOMAD export.

The easiest way to understand the application is to keep four rules in mind:

1. **The uploaded ZIP is evidence, not editable state.** LabFlow never rewrites it.
2. **There is one Working Copy.** Every accepted correction, Design edit and document edit belongs to it.
3. **Scientific calculations are deterministic-first.** AI adds interpretation, suggestions and writing; it does not become the authority for measurements or NOMAD readiness.
4. **External AI is bounded.** Every AI Action has an input cap, output target/ceiling, deadline and retry policy. Provider throttling stops work rather than creating uncontrolled traffic.

## Recommended reading paths

### I just want to use LabFlow

1. [Start with LabFlow](guides/GETTING_STARTED.md)
2. [How LabFlow works](guides/HOW_LABFLOW_WORKS.md)
3. [Research workflow](guides/RESEARCH_WORKFLOW.md)
4. [AI assistance](guides/AI_ASSISTANCE.md)
5. [Troubleshooting](guides/TROUBLESHOOTING.md)

### I want to understand the scientific/data logic

1. [Data lifecycle](guides/DATA_LIFECYCLE.md)
2. [Experiment model](EXPERIMENT_MODEL.md)
3. [Workflow and Action lifecycle](WORKFLOW.md)
4. [Data model specification](specs/DATA_MODEL.md)
5. [Import/export specification](specs/IMPORT_EXPORT.md)
6. [NOMAD](NOMAD.md)

### I am working on AI/provider integration

1. [AI assistance](guides/AI_ASSISTANCE.md)
2. [Tokens, limits and rate limiting](guides/AI_TOKENS_AND_RATE_LIMITS.md)
3. [AI architecture](AI.md)
4. [AI provider specification](specs/AI_PROVIDERS.md)
5. [Action specification](specs/ACTIONS.md)
6. [Action runtime matrix](reference/ACTION_RUNTIME_MATRIX.md)

### I am modifying the UI or codebase

1. [Architecture](ARCHITECTURE.md)
2. [JavaScript](JAVASCRIPT.md)
3. [JavaScript module map](specs/JAVASCRIPT_MODULES.md)
4. [UI](UI.md)
5. [Visual language](VISUAL_LANGUAGE.md)
6. [Validation](VALIDATION.md)
7. [Logging](LOGGING.md)

## Canonical vs explanatory documentation

The documentation deliberately has two layers.

**Guides** explain the mental model and normal operation in researcher language. **Specifications/reference** define exact runtime contracts and are the source to use when changing code.

If prose and an executable Action definition ever disagree, `actions/*/action.json`, `actions/schemas/*.json`, the validators and the current implementation must be reconciled before release. Generated registries are never the editing source.

## Build-generated documentation

The in-app **Documentation** page is generated from `docs/**/*.md` by:

```bash
python tools/build_docs_bundle.py
```

Action/reference data is generated independently from the executable Action definitions. After changing Action budgets or schemas, rebuild both registries and documentation before packaging LabFlow.
