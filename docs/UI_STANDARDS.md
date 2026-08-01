# LabFlow UI standards

This document is the implementation checklist for every LabFlow page. `ui-kit.html` is the rendered visual ground truth; this file records the layout rules that agents and maintainers must follow.

## 1. One application shell

Every root page uses exactly this structure:

```text
.topbar
.sidebar
.app-main
└── main.page
    ├── .page-header
    └── page content
```

Do not create a second topbar, sidebar, page-width system or route-specific shell.

- Topbar height: `56px`.
- Sidebar width: `244px` on desktop.
- Desktop page maximum width: `1480px`.
- Page horizontal padding is controlled only by `layout.css`.
- The sidebar contains navigation only; Project/workspace context belongs in the topbar.

## 2. Page header

Every primary page starts with one `.page-header`.

The left side contains:

1. optional `.eyebrow` context;
2. one `h1`;
3. one short descriptive paragraph.

The right side contains `.page-actions` with at most the important page-level actions. Do not place large dashboards, filters or secondary navigation inside the page header.

Variants such as `.compact-header`, `.home-header` and `.project-header` may add semantic hooks, but they do **not** change the outer header geometry.

## 3. Content rhythm

Use shared primitives before introducing a feature pattern:

- `.section-title` for section introductions;
- `.panel` for bordered working surfaces;
- `.panel-header`, `.panel-body`, `.panel-footer` for panel anatomy;
- `.grid`, `.grid-2`, `.grid-3`, `.split`, `.stack`, `.row` for layout;
- `.toolbar` for local controls;
- `.table-wrap > .data-table` for tabular data.

A page may have a unique scientific workbench, but it stays inside the canonical page frame.

## 4. Controls

Controls are deliberately compact because LabFlow is a laboratory workbench, not a marketing site.

- Standard button/input/select height: `34px`.
- Small button/icon button height: `28px`.
- Standard textarea minimum height: `68px`.
- Labels: `11.5px`.
- Help text: `10.5px` or larger.

Do not locally change button or input height. Large card-like choices are allowed only when the whole surface is a selectable object, not a normal action button.

## 5. Sidebar

The sidebar should normally fit without scrolling on a desktop viewport.

Keep only:

- My Workspace;
- Current Project / Pipeline and its steps;
- Project Data;
- shared resources (Lab Cabinet, Knowledge & RAG, AI Assistant, Common Tools);
- UI Kit, Documentation and Settings.

Do not duplicate the active Project, user identity, privacy text or administrative destinations in the sidebar footer. Those belong elsewhere in the shell.

## 6. Scientific graphics

Scientific graphics are **2D by default**.

Use position, order, colour, line weight, bar length and labels to encode structure. Do not use perspective, skew, rotated planes or faux depth shadows.

Examples:

- solutions: flat composition bars + ingredient lists;
- stacks: flat ordered layer cross-sections;
- measurements: 2D charts;
- process flows: boxes and connectors.

## 7. Scrollbars

Scrollbars are themed globally in `base.css`. Tables, drawers, code areas, sidebar overflow and workbenches inherit the same treatment.

Do not define custom scrollbar colours in feature modules.

## 8. CSS ownership

Every HTML page links only `assets/app.css`.

`app.css` imports shared modules by responsibility. There are no page CSS files and no Pipeline-step CSS files.

A new reusable UI rule must be added to the appropriate shared module and represented in UI Kit if it defines a new reusable pattern.

## 9. JavaScript ownership

Shared shell, theme, icons and UI behaviour live in shared JavaScript files under `assets/`.

Pipeline JavaScript may implement scientific behaviour for a step, but must not restyle or rebuild the application shell.

## 10. Review checklist

Before accepting a UI change:

1. compare it with `ui-kit.html`;
2. verify the route uses the same page frame as the other routes;
3. check normal buttons/inputs are not oversized;
4. check no text is unreadably small;
5. check scientific diagrams remain flat 2D;
6. check the sidebar has no duplicated destinations/context;
7. run `python3 tools/validate_poc.py`.

## Pipeline identity

Pipeline colour is a **secondary identity**, not a replacement theme. The active application palette still owns navigation, surfaces, buttons and accessibility states. A Pipeline may define one `accent: "#RRGGBB"` in its canonical YAML; LabFlow uses it only for the Pipeline badge, Project card marker, Project selector dot, active Pipeline rail and selected Pipeline step.

Bundled examples:

- CHOSE: laboratory teal (`#2d7a70`)
- Quick Workflow: rapid amber (`#a76128`)

Never hard-code those colours in a page. Read them from Pipeline metadata and pass them through `--pipeline-accent` / `--pipeline-accent-soft`.

## Project examples

The static POC must open with meaningful, connected examples. A showcase Project is not allowed to be only a title and an empty form. CHOSE examples should connect solution → stack → measurement → analysis → report. Quick Workflow examples should connect question → conditions → recorded values → conclusion. The demo seed is session-only and may always be reset.

## Export surfaces

Reports use the selected LabFlow palette and are generated locally. The canonical polished outputs are:

- PDF: presentation/report output with branded header, theme accent, scientific hierarchy and page-oriented layout;
- DOCX: editable report with the same hierarchy and theme accent;
- XLSX: structured workbook with themed headers, readable widths, frozen header row and filters when useful.

CSV, JSON and YAML remain machine-readable companion formats. They do not replace the polished report outputs.

## Documentation files

Repository Markdown guides must render **inside** `documentation.html`. Links in the manual must not navigate the researcher to raw Markdown. `docs/*.md`, `README.md`, `AGENTS.md` and `CONSOLIDATION_NOTES.md` are bundled into `assets/docs-bundle.js` by `tools/sync_docs_bundle.py`; Markdown remains the canonical authoring source.

## Future AI surfaces

Future AI is shown only where it maps to a plausible laboratory task. Prefer small adapters over speculative platforms:

- LLM/RAG: cited explanation, drafting and file/schema assistance;
- bounded agents: multi-step preparation or validation behind explicit approval gates;
- classical ML: regression, ranking, classification and anomaly detection on sufficiently comparable structured runs;
- DL: optional image/spectral models only when labelled data justify them;
- active learning: ranking a researcher-approved, bounded candidate space for the next run.

AI output must remain visually and structurally distinct from raw data, deterministic processing and human conclusions.
