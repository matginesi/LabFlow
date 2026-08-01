# LabFlow consolidation notes

This snapshot is a structural consolidation of the static POC. The goal is not to add a production backend or a second application layer; it is to make the existing showcase coherent enough that future changes stop reintroducing competing concepts and UI systems.

## Canonical product model

The only primary navigation model is:

`User → Workspace → Project → Pipeline → Step`

A Project is the researcher's working unit. Detailed runs, samples, Measurements and future Experiment records may exist inside Project data, but they are not parallel top-level navigation concepts.

## What changed

- The sidebar is Project-aware and renders the current Pipeline steps dynamically.
- CHOSE is the showcase Pipeline with five steps: Materials & Solutions, Stack & Fabrication, Data Ingest, Analysis, Report & Export.
- Quick Workflow remains as a deliberately simpler second Pipeline proving the mechanism is replaceable.
- Pipeline names, descriptions, ordered steps and asset paths live in `pipeline.yaml`; duplicated metadata and duplicated step HTML were removed from JavaScript.
- Pipeline YAML and step HTML remain canonical authoring files. A generated static browser bundle mirrors them so runtime navigation requires no `fetch()`; Step JavaScript may still use YAML-declared asset paths; visual styling is always supplied by the shared design system.
- Pipeline progress distinguishes the step being viewed from saved progress and has a real 100% completed state.
- Lab Cabinet now initialises with the intended demonstration seed instead of an empty array.
- Common Tools, Knowledge/RAG and AI Assistant are Workspace utilities; Pipeline-specific tools stay inside Project steps.
- Process/Experiment pages are quarantined compatibility/detail views and are absent from primary navigation/search.
- Documentation and the in-app Flow page now describe the same Product model.

## CSS contract

Every root page loads the same `assets/app.css`.

That global file owns tokens, themes, shell, layout, buttons, forms, panels, tables, navigation, common tool surfaces, Project/Pipeline chrome and responsive behaviour. Reusable UI changes belong there.

Pipeline step stylesheets were removed. Scientific visuals now live in the shared `assets/styles/scientific.css`; every page uses the same UI Kit contract.

Structural inline styling is intentionally discouraged. Inline values are reserved for genuinely data-driven visuals such as progress widths, chart heights, scientific ratios and UI Kit swatches.

## Safety rails for future coding agents

- `AGENTS.md` contains the non-negotiable product constitution.
- `tools/validate_poc.py` checks shared CSS usage, Pipeline source-of-truth rules, compatibility quarantine, CSS boundaries, declared Pipeline assets, Lab Cabinet seed and completion-state markers.
- Run the validator after every structural change.

## Verification performed for this snapshot

- All JavaScript files pass `node --check`.
- Both Pipeline YAML files resolve correctly, the generated static bundle is synchronized with them, and every declared asset exists.
- Every asset declared by CHOSE and Quick Workflow was fetched successfully over the local HTTP server.
- `tools/validate_poc.py` passes across all root pages, all CSS files and both Pipelines.

A Chromium smoke test could not be completed in the build environment because navigation to both local HTTP and file URLs was blocked by the environment policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). This is recorded as an unexecuted browser test, not a pass. The POC should still be opened locally in a normal browser before the next visual iteration.

## UI Kit ground-truth pass

- `ui-kit.html` is now the explicit visual contract for shell geometry, typography, controls, forms and shared component anatomy.
- Every HTML route links only `assets/app.css`; the file is a manifest for shared responsibility-based modules under `assets/styles/`.
- Topbar, sidebar, brand/icon alignment, global search, palette/account surfaces and navigation live in `shell.css`.
- Buttons, native inputs/selects/textareas, panels, tables, states and tabs live in `components.css` and share canonical sizes.
- Feature CSS is split by reusable responsibility (`feature-foundations`, `feature-workflows`, `feature-workspace`, `feature-reports-ai`, `feature-scientific-workbench`) rather than by page.
- Pipeline and page-specific CSS remains forbidden; CHOSE/Quick steps use the same global design system.
- Executable appearance/layout behaviour remains in shared JavaScript. Static shell layout is not written through inline styles.
- The validator now rejects direct reimplementation of core UI primitives in feature modules and rejects interface text below the 10 px readability floor.

## UI polish pass — compact 2D scientific workbench

- Standard controls reduced to 34 px; small controls to 28 px.
- Standard textarea minimum reduced to 68 px; large editor surfaces remain intentionally large only where they are actual editors.
- Sidebar simplified to operational destinations only; duplicate Projects/Admin/context/footer entries removed.
- Themed scrollbars added globally in `assets/styles/base.css`.
- Lab Cabinet storage migrated to v2 and now restores/merges a 19-resource demo catalogue, including materials, solutions, substrates, stacks, protocols and instruments.
- Solution Builder live preview replaced with a flat 2D recipe map (solvent composition bar, solute list and batch summary).
- Stack Builder visual replaced with a flat ordered 2D layer cross-section; perspective/3D transforms removed.
- Missing styles for the top AI and Knowledge/RAG capability/retrieval flows added and aligned with the shared design language.
- Canonical page width, page-header geometry and breadcrumb rhythm now apply to every route.
- Added `docs/UI_STANDARDS.md` and updated UI Kit/Design System documentation to encode page anatomy, compact density, 2D scientific graphics, sidebar policy and global scrollbar behaviour.

## Showcase usability fixes

The current static POC also includes a targeted showcase pass rather than a new architecture:

- Both bundled Pipelines ship with coherent, editable Project examples instead of empty forms.
- CHOSE uses laboratory teal (`#2d7a70`) and Quick Workflow uses rapid amber (`#a76128`) as secondary Pipeline identity colors; the selected application palette remains the global UI theme.
- The Project selector in the top bar switches the active Project and keeps contextual routes scoped to the selected Project.
- The Pipeline step rail adapts to the actual number of steps and separates saved progress from the step currently being viewed.
- Materials/Solutions and Stack/Fabrication contain useful 2D work surfaces and reusable Project records.
- Report, CHOSE and Quick outputs include themed PDF, editable DOCX and structured XLSX exports in addition to lightweight text/data formats.
- Repository Markdown documentation is rendered inside the Documentation page through the generated static docs bundle rather than opening raw Markdown.
- AI surfaces show bounded, optional future extensions for LLM assistance, agentic workflows, tabular ML, image/spectrum DL and active-learning suggestions without making AI a dependency of the POC.
