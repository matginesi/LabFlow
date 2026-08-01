# LabFlow design system

## UI Kit is the ground truth

`ui-kit.html` is the visual contract for LabFlow. `docs/UI_STANDARDS.md` is the page-layout and review checklist. If a reusable element looks different on a feature page, the feature page is wrong: fix the shared design system rather than adding a local override.

Every root page links exactly one stylesheet entry point:

```html
<link href="assets/app.css" rel="stylesheet">
```

`assets/app.css` is intentionally tiny. It is a manifest that imports the same shared modules for every page.

## Shared CSS modules

| File | Owns | Must not own |
| --- | --- | --- |
| `assets/styles/tokens.css` | colors, palettes, typography scale, spacing, radii, shell/control dimensions | component selectors |
| `assets/styles/base.css` | reset, body typography, native defaults, icons, focus | page-specific layout |
| `assets/styles/layout.css` | page frame, headers, grids, rows, stacks | buttons/forms/navigation styling |
| `assets/styles/components.css` | buttons, form controls, panels, badges, alerts, tables, tabs, toolbars, popover surfaces | route-specific visuals |
| `assets/styles/shell.css` | topbar, brand, global search, user/context controls, sidebar/navigation | scientific content |
| `assets/styles/feature-foundations.css` | shared Cabinet, tools, data-exchange and UI Kit feature patterns | canonical component geometry |
| `assets/styles/feature-workflows.css` | shared guided workflows, editors, charts and graph patterns | shell/component primitives |
| `assets/styles/feature-workspace.css` | shared Workspace/Project feature layouts | shell/component primitives |
| `assets/styles/feature-reports-ai.css` | shared report, AI, knowledge and export surfaces | shell/component primitives |
| `assets/styles/feature-scientific-workbench.css` | shared Project/Pipeline workbench and scientific capture patterns | alternate button/form/shell systems |
| `assets/styles/scientific.css` | solution/stack/trace/chart and Pipeline scientific visuals | alternate design systems |
| `assets/styles/utilities.css` | small reusable spacing/width helpers | whole component definitions |
| `assets/styles/responsive.css` | shared breakpoints and shell/component adaptation | feature-specific desktop styling |

There are **no page-specific or Pipeline-step stylesheets**.

## Canonical measurements

These values are shown in `ui-kit.html` and originate in `tokens.css`:

- topbar: `56px`;
- sidebar: `244px` desktop;
- standard control/button: `34px`;
- small button: `28px`;
- navigation row: `34px`;
- icon box: normally `16–18px`;
- body text: `13.5px`;
- page title: `27px`;
- section title: `20px`;
- panel radius: `7px`.

Feature code must not alter these values locally.

## Canonical shared classes

Prefer these primitives before creating a new class family:

- layout: `.app-main`, `main.page`, `.grid`, `.split`, `.split-equal`, `.row`, `.stack`;
- page identity: `.page-header`, `.page-actions`, `.section-title`, `.eyebrow`;
- surfaces: `.panel`, `.panel-header`, `.panel-title`, `.panel-body`, `.panel-footer`, `.record-card`;
- controls: `.button`, `.icon-button`, `.field`, `.form-grid`, `.input`, `.input-group`;
- data: `.table-wrap`, `.data-table`, `.badge`, `.alert`, `.progress`;
- navigation: `.topbar`, `.sidebar`, `.nav-section`, `.nav-link`;
- Pipeline: `.pipeline-workspace`, `.pipeline-stepper`, `.pipeline-stage`.

Native text inputs, selects and textareas also receive the same canonical form geometry even when dynamic markup does not add `.input`.

## JavaScript ownership

Appearance bootstrap is in `assets/theme-init.js`, not copied inline into every HTML page. Shared shell rendering, icon injection and global UI behaviour live in shared JavaScript (`assets/app.js` and the small supporting modules), not inside route-specific script blocks.

Inline `<script type="text/graph">` and `<script type="text/markdown">` blocks are data containers, not executable page JavaScript.

## Inline-style rule

Layout, spacing, sizing, borders, typography and component appearance belong in shared CSS.

Inline style values are reserved for genuinely data-driven visual values such as:

- progress width;
- chart/bar value;
- scientific composition ratio;
- dynamically calculated geometry.

A static margin, font size, border or color is not data and must not be inline.

## Themes and palettes

Light/Dark appearance and Blue/Red/Green/Violet palettes are semantic token sets in `tokens.css`. Features use variables such as `--surface`, `--ink`, `--line`, `--accent`, `--teal` and `--amber`; they do not introduce route-specific colors for standard UI components.

## Scientific visuals

A laboratory may need new scientific graphics. Add their reusable classes to `assets/styles/scientific.css` or the appropriate shared `feature-*.css` module and document/show the pattern in UI Kit.

Allowed examples:

- solution composition visual;
- stack specimen;
- measurement trace;
- scientific chart annotation.

Not allowed:

- a second button system;
- different input geometry;
- local page widths;
- a different topbar/sidebar;
- a mini-theme inside a Pipeline.

## Canonical page anatomy

```text
.topbar + .sidebar
└── .app-main
    └── main.page
        ├── optional breadcrumb / context strip
        ├── .page-header
        └── working surfaces composed from UI Kit primitives
```

The Project Pipeline lives inside that frame; it never replaces the application shell.

## Change rule

When a new reusable component is needed:

1. define it in the appropriate shared CSS module;
2. add a representative example to `ui-kit.html`;
3. use that same class in feature pages;
4. run `python3 tools/validate_poc.py`.

Do not solve cross-page inconsistency with another override at the bottom of a feature stylesheet; those stylesheets no longer exist.


## Page consistency checklist

For the canonical shell, compact control density, 2D scientific graphics, sidebar contents and global scrollbar policy, see [`UI_STANDARDS.md`](UI_STANDARDS.md).

## Pipeline accent vs application theme

The LabFlow palette is global. Pipeline accents are contextual markers only. Use `--pipeline-accent` for badges, rail progress and Project markers; never use a Pipeline colour to redefine buttons, fields, panels, topbar or sidebar geometry. This keeps CHOSE and Quick recognisable without creating two visual systems.
