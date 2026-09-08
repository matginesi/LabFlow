# LabFlow UI skill

Use this skill for every LabFlow visual, layout, responsive, chart, export-surface or interaction change.

## Read first

Before editing UI, read `docs/WORKFLOW.md`, `LABFLOW_POC_SPEC.md`, `docs/UI.md`, `docs/VISUAL_LANGUAGE.md`, `ui-kit.html`, and the relevant feature spec. Inspect the production page and its late CSS overrides before adding selectors: LabFlow has one visual system and later overrides must not silently reintroduce obsolete dimensions.

## One visual source of truth

Use this hierarchy only:

1. `assets/css/tokens.css` — colors, typography, spacing, density, shell dimensions and theme values.
2. `assets/css/ui.css` — reusable controls, fields, panels, tabs, tables, badges and notices.
3. `assets/css/app.css` — shell and page composition plus feature-specific layouts.
4. `ui-kit.html` — executable examples that use production classes.
5. This skill — implementation rules, never an alternate stylesheet/component library.

Do not introduce a page-local design language, duplicated color constants or a second component system. Add a reusable production pattern first, demonstrate it in `ui-kit.html` when useful, then rebuild `assets/js/pages/ui-kit-inline.js`.

## Current product workflow

The primary experiment flow is exactly **Upload & Review → Results → Design → Export**.

- Upload & Review is the mandatory entry point and contains source receipt plus review workbench.
- Results is deterministic analysis and visualization.
- Design holds qualitative experiment architecture, chemistry and process.
- Export is the save/interchange boundary: LabFlow ZIP is the primary portable save; NOMAD artifacts are secondary deterministic exports.
- Cabinet, Documentation and Settings are utilities outside the four-step primary workflow.

Do not restore legacy `Report`, `Paper` or standalone `NOMAD` workflow steps.

## Density and typography

LabFlow is a compact scientific workbench, not an oversized card dashboard and not a micro-font console.

- Normal content should generally use the shared `--font-sm` / `--font-md` scale.
- `--font-xs` is appropriate for labels and compact metadata.
- `--font-micro` is reserved for genuinely secondary technical metadata, never primary actions, Action names, warnings, scientific values or explanatory copy.
- Do not use 7–9 px text for user-facing controls/content.
- Shared controls follow the tokenized normal/compact control heights. Prefer tighter grouping and less decorative padding before shrinking type.
- A heading, eyebrow and supporting meta line need visible vertical rhythm (roughly 2–4 px between related lines); never concatenate visually into one dense line.
- Long names, paths and evidence must wrap or truncate deliberately. Never let text collide with buttons/badges or escape a card.
- Panels stay flat, radii modest, borders meaningful, and whitespace concentrated between scientific tasks rather than inside every tiny element.

## Layout rules

- Every grid/flex child that can contain long scientific content needs `min-width: 0`.
- Keep page-level horizontal scrolling at zero. Wide tables/charts may use an explicit local scroll viewport.
- Put primary action(s) near the title/task they affect; secondary metadata belongs below or alongside, not between label and value.
- Avoid card nesting for decoration. A surface should represent a real task, state or grouping.
- On mobile, reflow before compressing typography. Buttons may stack/full-width; essential labels remain readable.

## Export page pattern

Export is artifact-first, not a settings form.

1. Show a compact current-workspace summary.
2. Present export artifacts as a clear list with **LabFlow ZIP first and primary**.
3. Keep NOMAD entry/staging artifacts visually secondary and disable them when deterministic readiness blocks them.
4. Put package options in a separate compact panel.
5. Keep mapping/readiness in its own panel with blocking issues visible and the detailed field mapping progressively disclosed.
6. Never imply remote upload: export is local unless a future explicit connector says otherwise.

## Results and chart contract

Results are deterministic first. Charts visualize canonical measurements; they do not recalculate scientific truth.

Every primary chart should, where the data supports it:

- react to current metric/scan/group filters rather than being a static screenshot;
- provide pointer **and keyboard** inspection for values (tooltip/focus detail);
- allow series visibility toggles when multiple traces are present;
- preserve readable axes, units and group/sample identity;
- remain useful when interaction is unavailable;
- export the visual as **PNG and SVG** and its underlying plotted rows as **CSV**;
- use the self-contained local SVG renderer and canonical LabFlow data; do not add a runtime CDN/chart dependency merely for basic interaction/export;
- keep RAW curve export at plotted-point granularity and aggregate charts export the canonical rows from which the visual was computed;
- use local horizontal scrolling for many groups rather than crushing labels.

Chart colors come from `--chart-*` tokens. Theme accent is for interaction/state, not for making every data series the same accent color.

## Actions and Assistant

User-facing capabilities use `button[data-action]` and the Action contracts. The Assistant may launch public Actions and show their bounded outcomes, but it must still run them through `ActionUI`/guards/confirmation semantics rather than bypassing contracts.

Action results shown in chat should be readable at normal compact UI sizes. Full JSON/provider telemetry stays behind progressive disclosure. The Assistant can receive a bounded `recent_actions` summary for follow-up conversation, but Action events are not silently rewritten into user messages or scientific state.

AI surfaces must state responsibility: deterministic analysis is authoritative; AI suggests, interprets or drafts. Never style an AI enrichment as if it recalculated a metric.

## Design and Cabinet

Design is one selected experiment/variant at a time: solution chemistry, ordered stack and process. Keep the workbench dense and comparable to Results/Review. AI proposals remain visibly separate until accepted.

Cabinet is a browser-local reusable scientific shelf, not inventory/LIMS. Incomplete resources can be edited but must not be presented as applicable matches. Copying Cabinet content into Design uses snapshots and must preserve chemistry/stack/process content.

## Sidebar and themes

Keep primary workspace destinations together. Settings/provider utilities stay in the utility region. The drawer and bottom utility region must remain usable on narrow screens.

`instrument` and `light` use identical markup and component structure. Theme differences belong in tokens. JSON, Markdown, charts, Assistant, export surfaces and totems inherit active theme variables; do not hard-code light/dark surfaces.

## Verification

After UI changes:

1. rebuild generated UI/docs/action bundles affected by source changes;
2. run `node --check` across production JS;
3. run `python tools/validate_ui_contract.py` and the architecture/state/privacy/action validators when relevant;
4. run the unit suite;
5. run `python tools/test_responsive_browser.py` when the environment permits it;
6. verify every local `<script src>` / stylesheet path exists;
7. search for stale duplicate selectors and obsolete workflow labels after changing a shared pattern.
