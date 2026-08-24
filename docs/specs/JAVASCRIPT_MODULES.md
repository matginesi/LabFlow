# JavaScript module map

LabFlow is a static browser application. Modules attach a bounded namespace to `window.LabFlow`; page modules render from the single Working Copy and do not own scientific state. The list below documents every shipped JavaScript module. Comments inside source explain contracts and non-obvious decisions; ordinary expressions are intentionally not narrated line by line.

## Application shell and shared services

- `core.js` — escaping, Markdown rendering, IDs, cloning and shared formatting helpers.
- `logger.js` — structured in-browser logs with credential-aware request redaction.
- `math.js` — deterministic numeric and statistical helpers.
- `storage.js` — browser-local preferences, provider-scoped API keys, versioned Design Knowledge Base and persisted Working Copy access plus bounded compatibility migrations.
- `state.js` — the sole Working Copy lifecycle, autosave, dirty/revision tracking and compact Action history.
- `page-context.js` — current route/selection context shared with bounded AI contexts.
- `app.js` — boot, route normalization, event delegation and top-level page orchestration.

## Scientific data and experiment model

- `data/importer.js` — immutable ZIP-byte cloning, archive inventory and import orchestration.
- `data/parser.js` — deterministic known-format parsing and identity evidence.
- `data/analysis.js` — deterministic JV metrics, ranking and findings.
- `data/analysis-summary.js` — deterministic Analysis Dossier/group statistics bundle.
- `experiment/data-model.js` — normalized experiment construction.
- `experiment/model.js` — Working Copy query/mutation helpers.
- `experiment/canonical-store.js` — canonical-v2 semantic index, stable relations, aliases and evidence.
- `knowledge/knowledge-base.js` — separate versioned local Design library, JSON interchange and deterministic fill-only application with provenance.

## AI, Actions and Tools

- `tools/registry.js` — typed Tool registry and Assistant read-only allowlist boundary.
- `ai/providers.js` — declarative provider capabilities and provider-specific payload mappings.
- `ai/transport.js` — Chat Completions URL/auth adapter, discovery, capability probes, SSE/JSON normalization, thinking policy, budgets, timing and bounded retry.
- `ai/api-diagnostics.js` — stable error classification and safe environment guidance.
- `ai/settings.js` — provider form persistence, explicitly triggered local-model detection and rich connection-test report.
- `ai/context.js` — bounded Context Pack construction over Canonical Store references.
- `ai/structured.js` — structured response parsing and schema validation used by Actions.
- `ai/action-steps.js` — deterministic Action step implementations behind Tools.
- `ai/actions.js` — single-run sequential Action runner, bounded semantic retries and Assistant read-tool loop.
- `ai/action-ui.js` — truthful Action progress, sequential multi-Action projection and result publication.
- `ai/assistant.js` — constrained Chat UI integration and reasoning/final-content presentation.
- `ai/action-registry.js` — generated Action contract bundle; edit `actions/*`, not this file.
- `ai/prompt-bundle.js` — generated prompt bundle; edit `actions/*` and `prompts/*`, not this file.

## Pages and UI

- `pages/shared.js` — page-level shared rendering and scientific status helpers.
- `pages/import-page.js` — mandatory Upload & Review entry point and integrated review workbench.
- `pages/understand-page.js` — review-workbench renderer composed by Import; it is not an alternate route.
- `pages/results-page.js` — deterministic Results tables, plots and comparisons.
- `pages/design-page.js` — direct Design editing, provenance and bounded missing-field proposals.
- `pages/knowledge-page.js` — searchable Knowledge Base catalog and record editor, available independently of an experiment.
- `pages/report-page.js` — Report/Paper editor, writing controls, preview and figure picker.
- `pages/changes-page.js` — Working Copy versus immutable-baseline audit.
- `pages/nomad-page.js` — deterministic mapping, readiness and export controls.
- `pages/settings-page.js` — provider, Action and preference forms.
- `pages/logs-page.js` — local structured diagnostic log viewer.
- `pages/docs-page.js` — searchable Markdown documentation browser and local Mermaid flowchart renderer.
- `pages/docs-bundle.js` — generated `file://`-safe bundle of canonical Markdown sources; edit `docs/**/*.md`, not this file.
- `pages/ui-kit-page.js` — in-app UI Kit route.
- `pages/ui-kit-inline.js` — generated inline UI Kit mirror for `file://` use.
- `ui/feedback.js` — toasts, progress totem and provider-output disclosure.
- `ui/icons.js` — shared icon markup.
- `ui/theme.js` — theme selection and persistence.

## Report, export and NOMAD

- `report/report.js` — the two Markdown documents, document-scoped figures and PDF/DOCX/TeX export from current editor text.
- `export/export.js` — durable LabFlow ZIP serialization while preserving original source bytes.
- `nomad/nomad.js` — single Canonical-to-NOMAD mapping plan, validation, staging and ZIP generation.

## Compatibility and deletion policy

Compatibility code is retained only where it migrates browser-persisted user data or normalizes a historical public route. Current retained migrations cover the old `experiment-understand` route, legacy Report figure selection, older Action overrides and canonical aliases. The obsolete boolean AI thinking preference is discarded and replaced by the validated `auto|off|on` policy. Persisted-data migrations must be removed only with an explicit version boundary.

Unused convenience exports, empty Report/Paper templates and obsolete diagnostic aliases are not compatibility contracts and have been removed. Generated files are rebuilt, never hand-edited. Every module must pass `node --check`; behavior is covered by the unit suites under `tests/unit/`.
