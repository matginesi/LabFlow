---
title: UI contract
section: Engineering reference
summary: Shared interaction model, themes, density, Totems and task-specific scientific presentation.
order: 30
---

# UI contract

LabFlow keeps one compact scientific UI language. Feature pages compose shared primitives rather than introducing page-specific design systems.

## Primary workflow

```text
Upload & Review → Results → Design → Export
```

Cabinet, Knowledge Base, Settings, Logs, Documentation and UI Kit support that workflow.

## Ownership

- `assets/css/tokens.css`: design/density tokens
- `assets/css/ui.css`: shared controls, panels, tables, badges and Totem shell
- `assets/css/components.css`: compact runtime metrics, Results insight cards and Design completion primitives shared by production and UI Kit
- `assets/css/app.css`: application/page composition
- `assets/js/pages/ui-kit-inline.js` and `.agent/skills/labflow-ui/SKILL.md`: implementation examples/rules

## Action Totem

The normal view is intentionally small:

1. **Overall progress**
2. only useful secondary progress bars (for example current work unit or token completion)
3. elapsed time
4. operation-specific speed only when it has a real unit/meaning
5. transferred bytes (`downloaded / total`) while a model or asset is being fetched
6. generated tokens when a provider is involved
7. tok/s when the provider exposes or LabFlow can measure it

Everything diagnostic belongs under **Technical data**: provider/request details, input tokens, TTFT, budgets, payload excerpts, the model source/file/transfer/ETA/backend detail, checklist, internal steps and history. Do not make the user read transport internals to understand whether work is progressing.

The Browser Local startup checks (runtime, model cache and adapter) use the same Action Totem with a blurred backdrop (`activity-shade.blurred`) because they block local AI availability. The blur is opt-in per Totem and is removed with the Totem; other Actions keep the standard shade.

Closing contract: a finished or failed Totem stays open until the researcher closes it with its dedicated button, presses **Escape**, or leaves it untouched for **5 seconds**. Any interaction inside the Totem (click, key, wheel, touch, focus) restarts that window. A running Action is never auto-hidden: Escape stops it when it is cancellable, otherwise the Totem stays until the Action completes.

## Message Totem

Use the shared Message Totem for application feedback and confirmation. Inline notices remain page content. Do not create route-specific toast hosts.

## Results

Calculated statistics and deterministic Action output must be labelled as calculated/deterministic, not as AI. Descriptive correlations must not imply causality or significance.

## Assistant

Assistant is a local themed surface. Its menus, badges, notices, Markdown, code and structured output use Assistant tokens. `LOCAL · 0 tokens` means no provider was used; `LOCAL · LLM router` means a tiny language-agnostic routing call selected a deterministic LabFlow answer; `LLM` means an answer-generation request was also used. The Assistant never opens the Action Totem.

The Assistant starts closed in the initial markup, so a fresh session never flashes an open panel. It reopens only when the researcher left it open in the previous browser session (`labflow.ui.settings.assistantOpen`), and only on wide viewports.

## Cabinet

Keep one searchable reusable-resource shelf and one focused editor. Mental model: **Save → Reuse → the experiment keeps its own copy**.

## Responsive behavior

Pages reflow locally. Tables/charts may use contained scrolling when scientifically necessary; the whole page should not become a horizontally scrolling desktop canvas. Assistant becomes a dedicated mobile surface.

## Verification

Run UI validators, unit tests and the browser audit when available. When replacing a component, remove obsolete selectors/markup instead of leaving hidden parallel implementations.


## UI Kit parity

The UI Kit catalogue is authored source in `assets/js/pages/ui-kit-inline.js` and renders inside Settings with the same shared styles as production; there is no separate standalone page to keep in sync. Reusable components added to production must be represented in the catalogue; examples must not depend on a private stylesheet. Edit the catalogue module directly, then run `./release_check.sh`.
