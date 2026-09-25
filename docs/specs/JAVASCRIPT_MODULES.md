---
title: JavaScript module map
section: Engineering reference
summary: Responsibility map for authored browser modules and write boundaries.
order: 20
---

# JavaScript module map

LabFlow uses classic browser scripts rather than a bundler/module framework. Load order is explicit in HTML and required dependencies fail fast inside owner modules.

## Core and state

- `app.js` — bootstrap, routing, top-level event delegation and Action/Assistant wiring.
- `build-info.js` — `LABFLOW_VERSION`, `LABFLOW_BUILD`, `LABFLOW_ASSET_REV`.
- `core.js` — generic deterministic helpers and required-module checks.
- `redact.js` — centralized field-aware redaction shared by logging, diagnostics and shareable exports.
- `logger.js` — structured sanitized diagnostics.
- `math.js` — MathJax typesetting for rendered Markdown/structured output.
- `page-context.js` — bounded current page/focus context for Assistant and Actions.
- `storage.js` — browser persistence/preferences and Action overrides.
- `state.js` — one application state object: scientific aggregate, UI runtime state and active Action run.
- `data-structures.js` — descriptive cross-module structure catalog.
- `ui/theme.js` — theme selection/persistence and document-level application.
- `ui/icons.js` — local icon registry and hydration.
- `ui/feedback.js` — Message Totem and Action Totem lifecycle plus foreground feedback.

## Scientific aggregate

- `experiment/domain-schema.js` — canonical records, roots and persistence metadata.
- `experiment/data-model.js` — `ExperimentData` aggregate mechanics/query/restore/serialize.
- `experiment/data-contracts.js` — graph/snapshot validation.
- `experiment/derived-state.js` — derived dependency/invalidation registry.
- `experiment/canonical-store.js` — pure read indexes/evidence.
- `experiment/design-model.js` — Design owner/mutator API.
- `experiment/action-data.js` — persisted Action proposals/annotations/status.
- `experiment/design-analysis.js` — Design completeness analysis, proposal sanitization/confidence and apply/accept paths.
- `experiment/data-console.js` — runtime introspection facade (DevTools).

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
- `ai/browser-local.js` — local GGUF lifecycle (wllama): download, cache, load, warm-up, inference.
- `ai/transport.js` / `http.js` / `stream.js` / `errors.js` — direct-browser request mechanics and error taxonomy.
- `ai/structured.js` — structured-response parsing/validation support.
- `ai/action-registry.js` — generated Action registry.
- `ai/action-capabilities.js` / `action-guards.js` — bindings, availability and recommendation.
- `ai/contracts.js` — structure-catalog registration for Action/provider/settings metadata.
- `ai/context.js` — bounded Action/Assistant Context Packs.
- `ai/actions.js` — Action runner, retries, deadlines and semantic outcomes.
- `ai/action-steps.js` — deterministic step implementations.
- `ai/action-ui.js` — Action invocation and foreground lifecycle presentation.
- `ai/assistant.js` — conversational UI orchestration over `assistant.chat`.
- `ai/assistant-core.js` — tiny router, deterministic answers and factor selection.
- `ai/settings.js` / `console.js` / `api-diagnostics.js` — configuration and diagnosis.
- `tools/registry.js` — named deterministic tool registry used by Action steps.

## Pages/controllers

Controllers bind shared application events to owner APIs. Pages render current state and retain only UI selection/filter/draft state. Neither layer owns scientific arrays or reference-schema definitions.

- `pages/shared.js` — shared page frame, workflow navigation, stepper and the upload start surface.
- `pages/import-page.js` / `pages/review-panel.js` — Upload & Review.
- `pages/results-page.js` — Results tabs, charts and inspector.
- `pages/design-page.js` — Design workbench and proposal review.
- `pages/export-page.js` — Export projections and package options.
- `pages/cabinet-page.js` / `pages/settings-page.js` / `pages/logs-page.js` / `pages/docs-page.js` — Cabinet, Settings, Logs and Documentation.
- `pages/lazy-assets.js` — optional route assets (`docs-bundle.js`, `ui-kit-inline.js`).
- `pages/ui-kit-inline.js` — authored UI Kit catalogue (lazy, Settings → Advanced).
- `controllers/settings-controller.js` / `cabinet-controller.js` / `knowledge-controller.js` — scoped event binding to owner APIs.

## Export

- `export/export.js` — deterministic LabFlow package export.
- `export/nomad.js` — deterministic NOMAD mapping/validation/package state.
- `export/projections.js` — human-readable NOMAD/Ready-PV projections and override handling.

## Load order and dependency layers

`index.html` loads vendor libraries first (`mathjax`, `jszip`), then framework-free modules in an explicit order: metadata/icons/redaction/logging/core, canonical schema and aggregate, state/storage/workspace, reference stores, providers/transport/structured output, import/analysis/pipeline, AI context/runner, pages/controllers, and finally `app.js`.

Rules:

- a module declares its required dependencies and fails fast (no fallback object) when they are missing;
- dependency direction is enforced by `tools/validate_dependency_layers.py`;
- `docs-bundle.js` and `ui-kit-inline.js` are optional assets loaded lazily by `pages/lazy-assets.js` from the route/section that needs them;
- generated bundles are never hand-edited (`CONTRIBUTING.md`).

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
