# Validation checklist

Use this checklist after changes to behavior, data contracts, pipelines, documentation, themes, diagrams or exporters. Refresh every affected checked-in browser snapshot before testing.

## Automated checks

Run the repository’s static validator and the local export package test. The static validator checks entry pages, required local assets, canonical-source parity, light defaults, privacy constraints and internal links. The export test inspects generated DOCX, XLSX and ZIP structures; PDF parity is verified in the browser because it is printed from the visible Report Composer DOM.

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

## Browser matrix

- Open Workspace, Project, Lab Cabinet, Knowledge, Tools, Settings, Documentation and UI Kit.
- Check the console and verify every internal navigation target.
- Open multiple projects and confirm the current project appears directly below Workspace in the sidebar, with its name, stable identifier, active state and current-step link; verify the same entry in the mobile drawer.
- Exercise desktop, tablet and mobile widths and confirm no page-level overflow.
- Test both themes, all eight palettes and both densities.
- Navigate repeatedly between pages in both themes and confirm there is no light/dark flash.
- Inspect first paint with JavaScript disabled or paused: sidebar, topbar and the page bootstrap must already exist, with no empty `#app`, opacity gate or global fade. Confirm sidebar/topbar geometry and the stable scrollbar gutter do not shift between short and long pages.
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

## Tools and diagrams

- Exercise TXT, Markdown, LaTeX, YAML and JSON editing and validation.
- Add and rename workbook sheets; generate a local XLSX.
- Edit DOCX title, subtitle and body; generate an editable document.
- In Diagram Studio, test `TD` and `LR`, ordinary, rounded and decision nodes, invalid syntax and both examples.
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

- Modify the Report Composer title, narrative fields and included sections, then choose Print / Save PDF. Confirm the browser print preview reproduces the visible report composition, data table, charts, findings and current approval state.
- Generate DOCX, XLSX and ZIP from the project.
- Open the DOCX, update its table of contents, edit each researcher content-control type and inspect headings and tables.
- Open and recalculate all ten XLSX sheets in an Office-compatible application. Confirm pale amber input cells, pale green formula cells, frozen headers, filters and updated Dashboard values after a Raw Data edit.
- Inspect package manifests, identifiers, provenance, statement classes and NOMAD readiness.
- Regenerate `examples/` artifacts when exporter contracts change.

## Standalone and reset behavior

Open the theme integration example and test appearance controls. Open the application from a local folder and from a static subpath. Change settings, tabs, drafts and demonstration NOMAD fields, reload, and confirm that checked-in defaults—including Matteo Ginesi as example author—are restored.

Record an accepted exception next to the relevant check. Do not silently weaken a contract or leave obsolete guidance in place.
