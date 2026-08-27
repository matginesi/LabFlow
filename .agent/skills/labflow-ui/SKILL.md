# LabFlow UI skill

Use this skill for any LabFlow visual, layout, responsive, theme or interaction change.

## Read first

Before editing UI, read `docs/WORKFLOW.md`, `LABFLOW_POC_SPEC.md`, `docs/UI.md`, `docs/VISUAL_LANGUAGE.md`, `ui-kit.html`, and the relevant feature spec. Do not design from an isolated page screenshot when the shared contract already exists.

## Single visual source of truth

Use one hierarchy only:

1. `assets/css/tokens.css` — color, typography, spacing, density, shell dimensions and the `instrument` / `light` theme values.
2. `assets/css/ui.css` — reusable controls, panels, tabs, tables, badges, notices and fields.
3. `assets/css/app.css` — shell and page composition.
4. `ui-kit.html` — executable examples using the same production classes.
5. This skill — implementation rules, not an alternate stylesheet or component library.

Never create a page-local visual language that bypasses these layers. If a reusable pattern is needed, implement it in production CSS first and then demonstrate it in `ui-kit.html`. Rebuild `assets/js/pages/ui-kit-inline.js` after UI Kit changes.

## Product workflow

The experiment flow is exactly **Upload & Review → Results → Design → Report → NOMAD**. Upload is the mandatory experiment entry point. The first destination contains both the immutable source receipt and review workbench after import. Do not add a second Review step.

The workflow strip is a primary orientation control: exactly five destinations, readable on desktop, horizontally scrollable on narrow screens, never crushed into micro text.

## Density

LabFlow is a compact scientific workbench, not a dashboard made of oversized cards. It also must not rely on 7–9 px normal UI text. Shared controls use the tokenized 33 px normal / 29 px compact rhythm. Prefer a little more whitespace before reducing font size. Keep headings restrained, panels flat, radii modest and information grouped by scientific task.

## Sidebar

Keep primary workspace destinations together. Settings is utility/configuration and belongs in the sticky bottom sidebar region together with provider status. The bottom region must remain reachable when the sidebar scrolls and must work in the mobile drawer.

## Themes

`instrument` is the default bright scientific canvas with dark structural chrome. `light` is fully light. Both use identical markup and component structure. Theme differences belong in tokens; JSON, Markdown, tables, totems, Assistant and system pages must inherit the active theme rather than hard-code dark/light surfaces.

## AI surfaces

AI must be visually explicit about responsibility. Deterministic analysis is authoritative; AI surfaces explain whether they suggest, interpret or draft. Provider output and reasoning use progressive disclosure. Never present an AI semantic enrichment as if it recalculated scientific metrics.

## Responsive rules

Preserve content readability before density. Tabs and the five-step workflow may scroll locally; they should not wrap into arbitrary stacks or shrink labels. Tables use explicit responsive overflow or deliberate card transformation where documented. Totems remain bounded cards on phones; Assistant may use the full mobile viewport.

## Feature patterns

- **Upload & Review:** immutable RAW receipt, deterministic findings first, AI proposals separate.
- **Results:** deterministic measurements and responsive SVG; Compare prioritizes readable distributions/statistics.
- **Design:** one selected experiment/variant, simple solution chemistry + ordered device stack, AI proposals separate until accepted.
- **Report/Paper:** separate Markdown documents, source-of-truth editor, bounded AI writing helpers, explicit figures.
- **NOMAD:** deterministic mapping/readiness and explicit staging/export actions.
- **Settings → Actions:** single Action catalog/editor; no duplicate helper configuration surface.

## Verification

After UI changes, rebuild the inline UI Kit and run UI/unit/syntax validation. Search for stale duplicate selectors when changing a shared pattern: a later responsive override must not silently reintroduce old dimensions or step counts.
