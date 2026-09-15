---
title: JavaScript module map
section: Engineering reference
summary: Responsibility map for authored browser modules and write boundaries.
order: 20
---

# JavaScript module map

LabFlow uses classic browser scripts rather than a bundler/module framework. Load order is explicit in HTML and required dependencies fail fast inside owner modules.

## Core and state

- `core.js` — generic deterministic helpers and required-module checks.
- `logger.js` — structured sanitized diagnostics.
- `storage.js` — browser persistence/preferences and Action overrides.
- `state.js` — one application state object: scientific aggregate, UI runtime state and active Action run.
- `data-structures.js` — descriptive cross-module structure catalog.

## Scientific aggregate

- `experiment/domain-schema.js` — canonical records, roots and persistence metadata.
- `experiment/data-model.js` — `ExperimentData` aggregate mechanics/query/restore/serialize.
- `experiment/data-contracts.js` — graph/snapshot validation.
- `experiment/derived-state.js` — derived dependency/invalidation registry.
- `experiment/canonical-store.js` — pure read indexes/evidence.
- `experiment/design-model.js` — Design owner/mutator API.
- `experiment/action-data.js` — persisted Action proposals/annotations/status.
- `experiment/data-console.js` — runtime introspection facade.

## Data lifecycle

- `data/importer.js` — ZIP materialization into canonical source/domain records.
- `data/parser.js` — deterministic parsing mechanics driven by policy rules.
- `data/dataset-corrections.js` — review analysis and correction commit semantics.
- `data/analysis.js` — deterministic measurement/experiment analysis.
- `data/analysis-summary.js` — deterministic aggregate summaries/briefs.
- `data/pipeline.js` — declarative deterministic refresh lifecycle.

## Reference systems

- `cabinet/cabinet.js` — reusable lab-resource registry, validation, persistence and Design application delegation.
- `knowledge/knowledge-base.js` — bundled/custom JSONL knowledge validation, retrieval and source references.

## AI and Actions

- `ai/providers.js` — provider registry/defaults.
- `ai/transport.js` / `http.js` / `stream.js` — direct-browser request mechanics.
- `ai/structured.js` — structured-response parsing/validation support.
- `ai/action-registry.js` — generated Action registry.
- `ai/action-capabilities.js` / `action-guards.js` — bindings, availability and recommendation.
- `ai/context.js` — bounded Action/Assistant Context Packs.
- `ai/actions.js` — Action runner, retries, deadlines and semantic outcomes.
- `ai/action-steps.js` — deterministic step implementations.
- `ai/assistant.js` — conversational UI orchestration over `assistant.chat`.
- `ai/settings.js` / `console.js` / `api-diagnostics.js` — configuration and diagnosis.

## Pages/controllers

Controllers bind shared application events to owner APIs. Pages render current state and retain only UI selection/filter/draft state. Neither layer owns scientific arrays or reference-schema definitions.

## Export

- `export/export.js` — deterministic LabFlow package export.
- `export/nomad.js` — deterministic NOMAD mapping/validation/package state.

## Write boundary

| Owner | Writes |
|---|---|
| Importer | source/domain roots during canonical construction |
| Domain services | owned scientific values through explicit APIs |
| `DesignModel` | Design |
| `DatasetCorrections` | accepted correction + patch/provenance |
| `ActionData` | Action proposal/annotation/status |
| Cabinet | Cabinet reference store; Design only via `DesignModel` |
| KnowledgeBase | custom KB JSONL/reference state |
| State | app/UI/active-run coordination |
| Pages | UI state only, except through owner APIs |
| NOMAD/export | derived export projections/packages |
