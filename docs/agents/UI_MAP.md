---
title: Agent UI map
section: Engineering reference
summary: Shell, routes, rendering model, shared primitives and where UI changes belong.
order: 42
---

# Agent UI map

The enforceable conventions live in `.agent/skills/labflow-ui/SKILL.md`; this page explains how the UI is assembled.

## Shell (`index.html`)

```text
body[data-theme]
└─ .app-shell[.assistant-closed]
   ├─ .sidebar            primary navigation (workflow + workspace + Settings)
   ├─ .workspace-shell
   │  ├─ .topbar          page title/context, model status, reset, mobile nav toggle
   │  └─ .main-area       rendered page content, size container
   └─ .assistant-panel    themed Assistant surface (sibling of the workspace; wide viewports)
#activityShade            Action Totem host (one foreground lifecycle)
#messageShade             Message Totem host (transient feedback + confirmation)
#datasetInput             hidden ZIP file input used by the upload card
```

Load order is explicit (`build-info` → vendor → `ui/icons` → `redact`/`logger`/`core`/… → `app.js` last). Required modules fail fast; optional surfaces are lazily loaded.

## Routes and rendering

Routes are declared in `assets/js/pages/shared.js` (`ROUTES`): `experiment-import`, `experiment-results`, `experiment-design`, `experiment-export`, `cabinet`, `documentation`, `settings`.

- `LF.State.state.ui.route` is UI state; `LF.State.setRoute(route)` commits drafts, ensures the aggregate shape and notifies `route`.
- `assets/js/app.js render()` dispatches to the page module (`LF.ImportPage`, `LF.ResultsPage`, `LF.DesignPage`, `LF.ExportPage`, `LF.CabinetPage`, `LF.DocsPage`, `LF.SettingsPage`), assigns `main.innerHTML`, then runs post-render steps: page context, field labels, UI-Kit filter, docs/logs binding, scroll restore, `LF.AISettings.decorate()`, theme sync, Assistant render, icon hydration, result inspector, math typesetting.
- Pages return HTML strings from current state. They may hold selection/filter/draft UI state; they never own scientific arrays.
- Settings is a single route with sections (`provider`, `actions`, `assistant`, `knowledge`, `nomad`, `workspace`, `diagnostics`, `ui-kit`); the section lives in `ui.settingsSection`.
- `State.subscribe(fn)` drives re-render; reasons `actionRun` and `assistant` intentionally skip a full page render.

## Events

- `app.js bindEvents()` owns document-level delegation: routing, charts, copy, dataset open/drag-drop, design apply/accept, dataset corrections, NOMAD stub, theme, mobile nav, and the Action Totem flows.
- `assets/js/controllers/*.js` handle scoped surfaces: Settings (`settings-controller.js`), Cabinet (`cabinet-controller.js`), Knowledge (`knowledge-controller.js`). They coordinate and call owner APIs.
- `change`/`input` handling follows the same delegation; page-local listeners are avoided in favour of one delegated path.
- Browser Local state events (`labflow:browser-local-state`) refresh the sidebar model status and the setup Totem.

## Shared primitives and tokens

Ownership: `tokens.css` (colors/density/sizes/theme), `ui.css` (controls, panels, badges, notices, tables, tabs, Totems), `components.css` (compact composed components), `app.css` (shell + page composition). The reusable class inventory and the do/don't rules are in the UI skill — read it before adding styles.

Key feedback surfaces:

- **Action Totem** (`assets/js/ui/feedback.js`, `LF.UI.activityStart/activityUpdate/activityFinish/activityError`): progress, steps, compact metrics, `Technical data` for diagnostics, 5 s idle close, `shadeBlur` opt-in for blocking setup.
- **Message Totem** (`LF.UI.message`, `LF.UI.confirmAction`): the only transient feedback and confirmation UI. Inline `.notice` remains page content.
- **Inline error/empty states**: `.field-error`, `.notice`, `.empty`, `pageFailureHtml()` recovery surface.

## Page map

| Route/surface | Module | Notes |
|---|---|---|
| Upload & Review | `pages/import-page.js`, `pages/review-panel.js`, `pages/shared.js` | start card (button + drag-drop), receipt, review overview, deterministic corrections |
| Results | `pages/results-page.js` | deterministic tabs (Overview/Data/JV/Compare), JV analyzer, chart toolbar, result inspector |
| Design | `pages/design-page.js` | three domains, completion guide, proposal review/accept, source evidence |
| Export | `pages/export-page.js` | LabFlow ZIP, NOMAD projection + validation, Ready-PV views, upload stub |
| Cabinet | `pages/cabinet-page.js` | one searchable shelf + one editor, kind accents from the registry |
| Knowledge | `pages/settings-page.js` (Knowledge section) | catalog + editor + JSONL backup/restore |
| Settings | `pages/settings-page.js` | rail + provider/Actions/Assistant/Knowledge/NOMAD/Workspace/Diagnostics/UI Kit |
| Logs / Diagnostics | `pages/logs-page.js` | bounded structured logs, scope/search filters, diagnostics export |
| Documentation | `pages/docs-page.js` | bundled Markdown catalog + article + outline, lazy-loaded |
| UI Kit | `pages/ui-kit-inline.js` | authored catalogue of shared patterns, loaded lazily inside Settings |
| Assistant | `ai/assistant.js`, `ai/assistant-core.js` | themed side panel, deterministic answers before provider calls |

## Adding or changing a surface

1. Classify the change: shell, page composition, or shared primitive.
2. Put markup in the owning page module; extract a primitive into `ui.css`/`components.css` only when a second consumer exists.
3. Use tokens and existing classes; keep UI text English.
4. Mirror a new production component in the UI Kit catalogue.
5. Remove retired markup/selectors instead of leaving hidden variants.
6. Add the smallest source-contract or DOM test; then run `./release_check.sh`.

## Responsive and accessibility rules

- The shell collapses at 1100 px; other breakpoints in use are 980/900/820/760/700/620/560/520/480/430 px. Prefer `@container` rules for two-pane layouts.
- No document-level horizontal scroll: wide tables/charts scroll inside their own region.
- Assistive tech contracts: `sr-only` labels, `:focus-visible` outlines, `aria-live` regions, `[hidden]` instead of visual-only hiding, `prefers-reduced-motion` respected.
- Toast/Totem surfaces are modal-like: keep `Escape`, explicit close buttons and focus behavior intact.
