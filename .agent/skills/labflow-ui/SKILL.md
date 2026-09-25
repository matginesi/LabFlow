# LabFlow UI skill

Use this skill for any change to the LabFlow interface: the shell in `index.html`, `assets/css/*`, page modules in `assets/js/pages/*`, shared UI in `assets/js/ui/*`, or the UI Kit catalogue in `assets/js/pages/ui-kit-inline.js`.

LabFlow is a local-first scientific instrument, not a dashboard. The UI must stay compact, legible and honest: deterministic numbers look deterministic, AI proposals look like proposals, and progress is visible without opening diagnostics.

## Non-negotiables

- **English UI strings**, sentence case, no emoji, no placeholder text. Keep the existing vocabulary.
- **One component language.** Compose shared primitives; never add a page-private button/panel/notice style or a second toast/Totem host.
- **One mutable scientific aggregate.** Pages and controllers render and coordinate; they never own scientific arrays or write canonical fields directly.
- **Deterministic before AI.** Never present calculated values as AI output, or AI proposals as accepted data.
- **Fail fast.** Required dependencies throw; do not hide a load-order error behind a fallback object or a silent no-op branch.
- **Explicit failure and empty states.** A missing value stays missing; do not invent precision or fill gaps silently.
- **Accessibility.** Keep `sr-only` labels, `:focus-visible` outlines, `aria-live` regions, `[hidden]` semantics and `prefers-reduced-motion` support intact.
- **Do not break the release.** `./release_check.sh` must pass.

## Own the right file

| File | Owns |
|---|---|
| `assets/css/tokens.css` | colors, status semantics, Assistant palette, code/JSON/chart palettes, spacing/density/size tokens, theme blocks |
| `assets/css/ui.css` | shared controls, panels, badges, notices, tables, tabs, Totems, focus rules |
| `assets/css/components.css` | compact shared components: Action Totem runtime metrics, Results insight grid, Design completion flow, Browser model cards |
| `assets/css/app.css` | application shell and page composition |
| `index.html` | the shell: sidebar, topbar, `#main` workspace, Assistant panel, Action/Message Totem hosts |
| `assets/js/pages/*.js` | page markup from current state; UI selection/filter/draft state only |
| `assets/js/ui/feedback.js` | Message Totem and Action Totem lifecycle (shared, app-wide) |
| `assets/js/pages/ui-kit-inline.js` | authored UI Kit catalogue rendered in Settings → Advanced → UI Kit |

If a rule is reused by two pages, it belongs in `ui.css`/`components.css`, not in `app.css` twice. If it is a device/state variation of a shared primitive, extend the primitive.

## Tokens and density

Use tokens, never literals: `--space-1..6`, `--font-micro/xs/sm/md/lg/xl`, `--control-h`, `--control-h-compact`, `--radius-sm/md/lg`, `--page-gap`, `--task-gap`, `--panel-head-py/px`, `--panel-body-pad`, `--page-max-w`, `--sidebar-w`, `--topbar-h`, `--assistant-w`.

Semantic colors: `--accent`, `--success`, `--warning`, `--danger`, `--info`, `--ai`, each with a `-soft` companion and usually a `-border` one (`--accent` has no `-border`). Surfaces: `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--text`, `--text-muted`, `--text-faint`. Assistant chrome uses only `--assistant-*`. Charts use `--chart-1..10`; code/JSON use `--code-*`/`--json-*`.

Rules: no literal sub-10px font sizes; no new spacing scale; dark styling stays local to Assistant/AI chrome while the scientific canvas stays light.

## Shell and layout

```text
.app-shell  →  .sidebar  +  .workspace-shell( .topbar + .main-area[container] )  +  .assistant-panel
```

- `.main-area` is a size container (`container-type: inline-size`). Prefer `@container` rules keyed to the real workspace width over viewport guesses for two-pane pages.
- Page frames use `.page` with `--page-max-w`; do not add a page-private max width.
- Primary responsive breakpoints: 1100, 980, 900, 820, 760, 700, 620, 560, 520, 480, 430 px (the stylesheets also use a few one-off widths such as 1040/1050/1280). The shell collapses at 1100 px; keep existing breakpoints instead of adding new ones.
- No document-level horizontal scrolling. Wide tables/charts scroll inside a contained region (`.table-wrap`, `.scroll-x-region`, chart viewports).
- Never open the Action Totem for an Assistant turn; deterministic answers must not fake progress.

## Navigation and scroll contract

- The workflow Previous/Next card is the first workflow card and stays sticky at the top of the main scroller; utilities never receive workflow arrows.
- A route change starts the new context at the top of the workspace; a same-context rerender preserves the main workspace scroll position, and bounded scroll regions keep their own position.

## Shared primitives

Reuse these before inventing anything: `.panel`/`.panel-head`/`.panel-body`, `.badge` (+`success|warning|danger|info|ai`), `.notice` (+ tone), `.button` (+`primary|ghost|danger|compact|icon-only|button-with-icon`), `.field`/`.input`/`.select`/`.textarea`/`.help`, `.switch-row`, `.checkbox-row`, `.tabs`/`.tab`, `.stepper`/`.step`, `.table-wrap`/`.data-table`, `.empty`, `.meta`/`.eyebrow`, `.fact-strip`, `.metric-grid`, `.progress`, `.markdown-view`, `.code-shell`/`.json-shell`, `.row`/`.row-wrap`/`.stack`/`.spacer`.

Page composition patterns that already exist: upload start card + dropzone, review overview/panels, Results tabs + JV analyzer + chart toolbar, Design completion guide + proposal review, Export projection sections, Cabinet shelf + editor, Knowledge catalog + editor + JSONL panel, Settings rail + section + disclosures, Logs list + detail, Documentation catalog + article + outline.

## Feedback contracts

- **Action Totem** (`LF.UI.activityStart/activityUpdate/activityFinish/activityError`): one foreground lifecycle, never a second job queue.
  - Compact view: overall progress, useful sub-progress, elapsed, operation speed, transferred bytes, tokens/tok-s only when real.
  - Everything diagnostic goes under **Technical data**.
  - A finished/failed Totem closes by its button, `Escape`, or 5 s untouched; any interaction restarts the window; a running Action is never auto-hidden.
  - `shadeBlur: true` is opt-in for blocking setup (Browser Local model setup) only.
- **Message Totem** (`LF.UI.message`, `LF.UI.confirmAction`): the only transient feedback and confirmation surface. Inline `.notice` stays page content. No new toast host, no `window.confirm`/`alert`.
- Browser Local startup, model management and setup progress use the same Totem with the setup steps; a missing/detached/unavailable model must surface the Totem, never only a warning.

## Assistant

The Assistant is a local themed surface: menus, badges, notices, Markdown, code and structured output use `--assistant-*` tokens only. It exposes exactly one compact **Actions** launcher — do not add an always-visible quick-action strip or a second Action palette on the same surface. `LOCAL · 0 tokens` means no provider was used, `LOCAL · LLM router` means a tiny routing call selected a deterministic answer, `LLM` means an answer request was used. Normal Assistant turns never open the Action Totem; explicit Assistant Actions do.

## Reference surfaces

Cabinet keeps one searchable shelf and one focused editor with the mental model **Save → Reuse → the experiment keeps its own copy**. Knowledge uses **Built-in library + My JSONL**: the full local record stays traceable, while Design receives compact source-free hints and the Assistant may receive compact source-bearing entries cited as `[KB:<id>]`. Keep both surfaces free of private component styles.

## Change checklist

1. Reuse or extend a shared primitive; keep markup in the owning page module.
2. Keep UI text English and consistent with the surrounding surface.
3. Check narrow layouts (≈390 px) and the 1100 px shell collapse: no clipped controls, no page-level horizontal scroll.
4. Mirror a new production component in the UI Kit catalogue (`assets/js/pages/ui-kit-inline.js`) so the design reference stays truthful.
5. Remove retired selectors and markup instead of leaving a hidden parallel implementation.
6. Add or extend the smallest owner-level test (source contract or DOM behavior).
7. Run `./release_check.sh`; run `./release_check.sh --full` (responsive browser audit) when a real browser is available.
