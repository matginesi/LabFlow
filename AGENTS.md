# LabFlow agent instructions

These rules apply to the whole repository.

- Analyse the relevant pages, references, data and documentation before modifying them.
- Reuse an existing UI block or extend an allowed variant before creating a new block. Keep the UI Kit aligned whenever the product UI changes.
- Keep the product a static vanilla HTML/CSS/JavaScript POC. Do not add a backend, application framework, CDN runtime dependency or mandatory build step.
- Do not create mock APIs, repositories, service layers or connected controls that imply a backend exists.
- Do not add cookies, browser persistence APIs, PWA manifests, service workers, trackers, analytics, telemetry or automatic external requests.
- Keep secrets and real credentials out of source, runtime state, exports and examples. NOMAD controls remain a local, non-transmitting demonstration.
- Store mutable UI state only in JavaScript memory. Reloading a page must restore checked-in defaults.
- Treat `settings.yaml` as the configuration source and rebuild `assets/js/settings-bundle.js` after editing it. The default content theme is light; the shell remains dark.
- Keep global search local, ephemeral and keyboard/mobile accessible. Never retain queries or introduce network-backed search.
- Reuse the shared shell, components, tools and pipeline views. Pipeline files describe workflow; they do not duplicate markup or visual systems.
- Every new page must use the checked-in shared Application Shell and the documented Page Composition Contract. Keep breadcrumb, header, actions, summary, tabs and toolbar in their canonical order rather than positioning them arbitrarily.
- Document and render a recurring layout variant in the UI Kit before using it. Do not create one-off page widths or page-specific header, summary or toolbar systems.
- Never reconstruct the complete application shell after `DOMContentLoaded`. Do not hide first paint with opacity, a global fade or page-entry animation, and do not introduce a SPA or simulated navigation to avoid full-page loads.
- Remove superseded shell, layout, header, summary and responsive CSS after a migration. Verify first paint and repeated cross-page navigation at desktop, tablet and mobile widths.
- Keep demonstration records in the checked-in data source and access them through small, recognizable functions when rendering or interaction code would otherwise depend on their physical location.
- Keep Solution Builder/Review and Stack Builder/Review structured, reusable and synchronized with report/export representations.
- Theme components consume semantic tokens. Keep foundations, theme variants, palettes, components and layout separated under `ui/`.
- Product-facing Documentation and UI Kit views must not expose raw source/configuration file links or behave like file browsers.
- Preserve the distinction among raw data, derived results, researcher statements and AI suggestions. AI output requires visible provenance and human control.
- Preserve the domain flow User → Workspace → Project → Process → Experiment; a pipeline step organizes work but does not replace record identity or provenance.
- Never create parallel files or names such as `old`, `new`, `v2` or `final` for an implementation. Replace the active implementation and remove the superseded one after verifying references.
- Do not leave broken pages, empty primary actions, dead listeners, console errors or undocumented visual variants.
- Prefer simple functions, explicit initialization and readable duplication over an internal framework or premature abstraction.
- Update the relevant canonical document whenever behavior, contracts or validation change. Remove obsolete documentation rather than leaving competing guidance.
- A change is not complete until the superseded implementation has been removed and the affected documentation has been updated.
- Rebuild checked-in bundles after editing pipeline YAML or Markdown docs, then run the commands in `docs/VALIDATION_CHECKLIST.md`.
- Verify native PDF, DOCX and ten-sheet XLSX packages structurally and visually after exporter changes.
