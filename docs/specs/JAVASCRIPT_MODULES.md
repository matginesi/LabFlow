---
title: JavaScript module ownership
section: Core architecture
summary: Source-level module map and write boundaries for contributors.
order: 25
---

# JavaScript module ownership

LabFlow is a local-first browser application. Modules attach bounded APIs to `window.LabFlow`; scientific/application ownership remains in the browser modules and no application-specific server is required.

## Architectural kernel

- `experiment/domain-schema.js` — canonical record factories, root ownership/persistence, detached snapshot contract.
- `experiment/data-model.js` — `ExperimentData` aggregate/query/mutation API.
- `experiment/data-contracts.js` — graph/invariant validation.
- `experiment/derived-state.js` — derived dependency/invalidation registry.
- `data/pipeline.js` — declarative deterministic stage registry/executor.
- `experiment/action-data.js` — single Action proposal/annotation/status store.

## Import and scientific processing

- `data/importer.js` — archive orchestration and source evidence creation.
- `data/parser.js` — known source-format/naming parsing.
- `data/analysis.js` — deterministic JV analysis/findings.
- `data/analysis-summary.js` — deterministic statistics/brief projections.
- `experiment/canonical-store.js` — pure read index/aliases/relations/evidence.
- `experiment/design-model.js` — Design-owned projection and Design mutation helpers; it does not define the global experiment shape.

## State/persistence

- `state.js` — single LabFlow Data lifecycle, revision, autosave and route/UI state; feature invalidation delegates to `DerivedState`.
- `storage.js` — browser persistence/preferences/provider keys.

## Actions/AI

- `ai/action-registry.js` — generated bundle from `actions/*/action.json`.
- `ai/action-guards.js` — pure Action precondition checks over resolved Action context/parameters.
- `ai/action-capabilities.js` — global public catalog, manifest state bindings, availability reasons, recommendations and slash-command resolution; the single preflight API for UI/Assistant.
- `ai/action-steps.js` — deterministic Action checkpoint implementations/apply services.
- `ai/actions.js` — generic sequential runner/retry/contract execution.
- `ai/action-ui.js` — Action UI orchestration; Design “Suggest all” sequences `design.infer`.
- `ai/context.js` — bounded Context profile registry/builders.
- `ai/structured.js` — structured parse/schema normalization/validation.
- `ai/providers.js` / `ai/transport.js` / `ai/settings.js` — provider capabilities, direct browser transport and settings; provider-specific request behavior is declarative and no hidden relay fallback is used.
- `ai/assistant.js` — read-only Assistant turns plus presentation of the global Action catalog; it does not own Action availability rules.
- `tools/registry.js` — typed deterministic/internal tools.

Generated files (`action-registry.js`, `prompt-bundle.js`) must be rebuilt from sources, not manually edited.

## Feature projections/exports

- `export/nomad.js` — deterministic NOMAD projection/validation/export.
- `export/export.js` — original/LabFlow Data package export.
- `page-context.js` — bounded page context for Assistant/Actions.
- `experiment/data-console.js` — live introspection facade.

## Pages

Files under `pages/` render/query the current aggregate/projections and may retain UI-only selection/filter state. They must not become scientific owners.

## Shared/UI

- `core.js`, `math.js`, `logger.js` — shared deterministic infrastructure.
- `ui/*`, `pages/shared.js` — presentation helpers.

## Write boundary summary

| Owner | May write |
|---|---|
| Importer | source evidence roots during import |
| Domain services | LabFlow Data records/patches through explicit APIs |
| Analysis | analysis/findings/owned derived values |
| DesignModel | `design` |
| Actions | `actionData`, interaction history; scientific apply only via deterministic services |
| Pipeline | runtime trace plus stage-owned outputs |
| Pages | UI state only, except through owner APIs |
| NOMAD | NOMAD projection/export state |
