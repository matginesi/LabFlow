# Validation checklist

Use this checklist after changes to behavior, data contracts, pipelines, documentation, themes, diagrams or exporters. Refresh every affected checked-in browser snapshot before testing.

## Automated checks

Run the repository’s static validator and the local export package test. The static validator checks entry pages, required local assets, canonical-source parity, light defaults, privacy constraints and internal links. The export test inspects generated PDF, DOCX, XLSX and ZIP structures; PDF and DOCX are also rendered to page images for visual inspection.

```bash
node tools/test_exports.mjs
```

An automated pass is necessary but does not replace browser and document inspection.

## Privacy and dependency audit

Search runtime sources for browser persistence, tracking, service-worker registration and automatic request APIs. Evaluate each result in context. Policy text may name forbidden capabilities, while XML/SVG namespace declarations are ordinary format metadata.

Confirm that fonts, icons, graph rendering, documentation, search and editors use checked-in assets only. Browser network activity should remain empty during normal navigation and tool use.

## Structure and dead-code audit

- Trace every candidate file through HTML, JavaScript, CSS, documentation, dynamic references and static deployment needs before removal.
- Confirm root entry pages remain thin and load only checked-in shared modules.
- Confirm every root entry page contains the same non-empty static application shell, loads the checked-in CSS/runtime bundles and defers only the modules needed by that page. Run the frontend-bundle and shell maintenance helpers and inspect the diff when shared sources or shell markup change.
- Check that project, Cabinet, Knowledge, experiment and measurement identifiers are unique and that every project step exists in its declared pipeline.
- Verify new record lookups use the small demo-data boundary where physical mock location would otherwise leak into interaction code.
- Search for obsolete parallel names, unreferenced selectors, duplicate helpers, dead listeners, empty primary actions and internal links with no target.
- Confirm replaced code, CSS and documentation were removed rather than retained as a second implementation.

## JavaScript diagnostics

- Confirm every page emits `logger.ready`, `page.init-start` and `page.init.complete` entries without an error.
- Open UI Kit directly from `file://` and from a static HTTP server; verify the page renders and no unique-origin History API error is produced.
- Verify UI Kit loads its page-specific report module before `app.js`; `E.buildReportDocument` must be available.
- Trigger a report draft update and a local export; verify structured report/export/download entries appear.
- Temporarily request a missing local image or script in development and confirm a redacted `resource.load.failed` entry contains only the asset filename.
- Run `LabFlowLog.setLevel("debug")`, inspect `LabFlowLog.snapshot()` and confirm the bounded records contain no credentials, report body text, assistant questions or uploaded data.
- Search runtime sources for direct `console.log`, `console.info`, `console.warn` and `console.error`; only the logger implementation may call the native console.
- Confirm logging performs no network request, browser persistence or background transmission.

## Browser matrix

- Open Workspace, Project, Lab Cabinet, Knowledge, Tools, Settings, Documentation and UI Kit.
- Confirm every main page begins with the canonical breadcrumb and page header; Workspace shows a single current-page breadcrumb.
- Confirm every main page exposes Ask LabFlow once in the global topbar, that no duplicate page-header action is rendered, and that the topbar control opens the shared assistant drawer.
- Check the console and verify every internal navigation target.
- Open multiple projects and confirm the current project appears directly below Workspace in the sidebar, with its name, stable identifier, active state and current-step link; verify the same entry in the mobile drawer.
- Exercise desktop, tablet and mobile widths and confirm no page-level overflow.
- Test both themes, all eight palettes and both densities.
- Navigate repeatedly between pages in both themes and confirm there is no light/dark flash.
- Inspect first paint with JavaScript disabled or paused: sidebar, fixed topbar and the page bootstrap must already exist, with no empty `#app`, opacity gate or global fade. Scroll short and long pages at desktop, tablet and mobile widths; the topbar must remain visible and content must begin below it without jumping or being obscured.
- Check standard, wide workbench and reading width assignments at 1600, 1024, 768 and 390 pixels.
- Verify search icon alignment, icon-only accessible names and missing-icon fallbacks.
- Test global search by mouse and keyboard, including empty results and mobile overlay.
- Click every primary action on each main page; it must navigate, update explicit in-memory state, download a local artifact or clearly identify itself as a non-interactive status.

## Ask LabFlow

- Confirm the left and right columns extend with the conversation on wide screens.
- Test knowledge, analytical, relationship and inspection questions.
- Change scope and source controls and inspect evidence details.
- Open the relationship graph and verify its labels, edges, caption and theme contrast.
- Preview each proposed action; confirm that no action writes automatically.
- Open, rename and delete session-only saved views, then reload to clear them.

## AI-ready foundation

- Open AI & Models and verify Knowledge, Datasets, Models and Predictions without console errors.
- Confirm the readiness score exposes its component checks and blocking issues.
- Verify dataset snapshots show stable IDs, versions, features, target, exclusions and split policy.
- Verify model cards identify task, algorithm, dataset, version, metrics and demonstration scope.
- Verify predictions display predicted and observed values, uncertainty, input coverage, model/dataset provenance and human review state.
- Confirm no control actually trains a model, calls a remote LLM, creates embeddings or persists a dataset in this static POC.
- Confirm raw data, calculated results, predictions, suggestions and approved conclusions remain visibly distinct.

## Tools and diagrams

- Exercise TXT, Markdown, LaTeX, YAML and JSON editing and validation.
- Add and rename workbook sheets; generate a local XLSX.
- Edit DOCX title, subtitle and body; generate an editable document.
- In Diagram Studio, test all templates, `TD` and `LR`, boxes, rounded/stadium nodes, decisions, process nodes, milestones, chained edges, labels, dashed and strong paths, invalid syntax, line numbers, validation counts, fit and zoom controls.
- Download the SVG and inspect it at multiple sizes; confirm it contains no external resource.
- Reload Tools and confirm all examples return to defaults.

## Project workflow

- Open every CHOSE step at 1600, 1024, 768 and 390 pixels; verify zero page-level horizontal overflow.
- Confirm the current pipeline step is visible without manual horizontal scrolling on tablet and mobile.
- Exercise Solution Builder/Review and Stack Builder/Review; add, copy, delete and reorder layers.
- Confirm Solution Review contains no vessel illustration or reserved empty column; volume, concentration, state, solvent ratios, solutes, quantities and validation must remain visible and update after recalculation.
- In Stack Builder, verify desktop action controls remain inside the Builder panel and mobile fields retain visible labels.
- In Stack Review, verify material, role and thickness remain readable without clipped or vertically broken values.
- Select every stack band and confirm its structured detail.
- Inspect Smart Import mappings, units, conversions and normalized preview.
- Compare experiments and ensure data-quality limitations remain attached.
- Keep deterministic issues separate from correlation, hypothesis and suggestion.
- Switch among PCE, Stability and Hysteresis charts and confirm the chart title, active control and canvas update together.

## UI Kit alignment

- Compare every major application block with the Shared Block Registry and its rendered UI Kit example.
- Confirm no speculative block remains in the UI Kit and no recurring product block is undocumented.
- Exercise the modal, drawer, toast, tabs, segmented controls and selectable stack example.
- Verify light/dark, tablet and mobile behavior without adding UI Kit-only component variants.

## Documentation rendering

- Open every managed document initially and through the document navigation; confirm active state, previous/next links and heading anchors.
- Inspect headings, paragraphs, nested lists, blockquotes, inline code, fenced code, tables, local images and Mermaid diagrams in light and dark themes.
- Confirm prose remains near 72 characters while tables, code and diagrams use local overflow without creating page-level overflow.
- Follow relative links between managed Markdown documents and verify fragments scroll to the requested heading after rendering.
- Test an unknown document identifier and confirm the friendly not-found state and safe console diagnostic.
- Confirm rendering performs no remote request and that the checked-in Markdown bundle remains the single source used by the page.

## Export inspection

- Modify the Report Composer title, publication metadata, narrative fields, custom section and included sections. Generate PDF and DOCX, then confirm both contain the same report state, data table, selected chart metric, findings, source appendix and approval.
- Generate DOCX, XLSX and ZIP from the project.
- Open the DOCX, update its table of contents, edit each researcher content-control type and inspect headings and tables.
- Open and recalculate all ten XLSX sheets in an Office-compatible application. Confirm pale amber input cells, pale green formula cells, frozen headers, filters and updated Dashboard values after a Raw Data edit.
- Inspect package manifests, identifiers, provenance, statement classes and NOMAD readiness.
- Regenerate `examples/` artifacts when exporter contracts change.

## Standalone and reset behavior

Open the theme integration example and test appearance controls. Open the application from a local folder and from a static subpath. Change settings, tabs, drafts and demonstration NOMAD fields, reload, and confirm that checked-in defaults—including Matteo Ginesi as example author—are restored.

Record an accepted exception next to the relevant check. Do not silently weaken a contract or leave obsolete guidance in place.


## AI model workbench and LaTeX export

- Open AI & Models → Models and verify model comparison bars, learning curves, learning-rate history, residual plot, confusion matrix, registry cards and training-run table render from the checked-in demonstration records.
- Confirm every metric is labelled as demonstration data and model outputs remain distinct from measured results and researcher conclusions.
- Generate the LaTeX report package from the Report Composer; inspect `scientific-report.tex`, `measurements.csv`, `README.md` and `compile.sh`.
- Compile the source locally with `latexmk -pdf scientific-report.tex` when TeX Live is available and verify title page, tables, chart, running header, footer, page numbers and provenance.
- Reorder solution components and stack layers by keyboard-accessible arrow controls and by drag. Confirm the review updates immediately and no row is lost or duplicated.
- Confirm product controls use only the checked-in icon set and that branding SVG files remain separate.


## Appearance continuity and user management

- Select every palette, navigate among Workspace, Project, AI & Models, Tools, Documentation, UI Kit and Settings, and confirm theme, palette and density remain unchanged. Repeat from a direct `file://` opening and from static HTTP hosting.
- Confirm internal file links remain relative and do not trigger unique-origin security errors.
- Inspect shared tabs and segmented controls: one contained bar, one active surface, aligned heights and local horizontal scrolling on narrow screens.
- Edit the current profile and confirm sidebar, topbar and report defaults update for the session.
- Add, edit and remove a demonstration workspace user; verify no real invitation, account or permission claim is made and reload clears the directory.
- Confirm page metadata, sidebar attribution, README and license consistently identify **© 2026 Matteo Ginesi**.

## Runtime page smoke checks

- Open Workspace, Project, Lab Cabinet, AI & Models, Tools, Settings, Documentation and UI Kit and confirm each page produces content rather than the generic render-failure notice.
- Verify page-specific module order: workbook before Project/UI Kit, diagrams before Documentation/AI & Models, and page modules before `app.js`.
- Temporarily replace one optional AI demonstration array with an empty array and confirm the affected view shows an empty state without blanking the page.

## Lab Cabinet browser

- Filter every resource family, search by name/tag/metadata and test all three sort options.
- Select resources of every type and confirm the inspector updates stable ID, status, metadata, tags, usage and snapshot behavior.
- Verify selected state and family filters are keyboard operable and do not rely on color alone.
- Check desktop sticky inspector, tablet stacked inspector and single-column mobile cards with no page-level horizontal overflow.
- Compare the production Cabinet pattern with the corresponding UI Kit section.
