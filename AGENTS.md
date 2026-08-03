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
- Treat simplicity and AI readiness as linked product requirements: ordinary project work must produce structured, traceable records without forcing a separate technical workflow on the researcher.
- Keep one AI & Models workspace with Knowledge, Datasets, Models and Predictions sections. Do not create separate RAG, Graph RAG, ML, DL or prediction products unless a distinct user workflow is proven.
- Preserve AI-ready records and provenance: dataset snapshots, transformations, features, labels, model versions, training runs, predictions, AI outputs and human reviews must have stable identifiers and explicit source links.
- A dataset used for training or evaluation must be an immutable versioned snapshot with selection, exclusions, feature/target schema, units and split policy. Do not train from an unidentified live query.
- Never present a prediction as a measurement or an LLM suggestion as a researcher conclusion. Show uncertainty, applicability/input coverage, model and dataset versions, evidence and review state.
- Prefer inspectable baselines and grouped scientific validation before advanced ML or DL. Guard against sample, batch, experiment and temporal leakage.
- Future AI integrations must use small provider-neutral contracts rather than coupling UI code directly to a model vendor, vector database or ML framework.
- Preserve the domain flow User → Workspace → Project → Process → Experiment; a pipeline step organizes work but does not replace record identity or provenance.
- Never create parallel files or names such as `old`, `new`, `v2` or `final` for an implementation. Replace the active implementation and remove the superseded one after verifying references.
- Do not leave broken pages, empty primary actions, dead listeners, console errors or undocumented visual variants.
- Use the shared `LabFlowLogger` for JavaScript lifecycle, operation and error diagnostics. Do not add ad-hoc `console.log`, remote logging, telemetry or persistent log storage.
- Log identifiers, counts, status and timings rather than scientific payloads. Never log credentials, API keys, assistant questions, report body text or uploaded file contents.
- JavaScript pages must fail visibly and safely: log the structured error, preserve the static shell and render a useful local fallback instead of leaving an empty page.
- Preserve direct `file://` compatibility. Do not call History API URL rewrites for file origins or append appearance parameters to local file navigation.
- Prefer simple functions, explicit initialization and readable duplication over an internal framework or premature abstraction.
- Update the relevant canonical document whenever behavior, contracts or validation change. Remove obsolete documentation rather than leaving competing guidance.
- A change is not complete until the superseded implementation has been removed and the affected documentation has been updated.
- Rebuild checked-in bundles after editing pipeline YAML or Markdown docs, then run the commands in `docs/VALIDATION_CHECKLIST.md`.
- Verify that native PDF and professional DOCX consume the current Report Composer state, respect selected sections and author text, and pass structural and visual rendering checks after exporter changes.
## Static delivery performance

- Root pages load `ui/labflow.bundle.css` and `assets/js/runtime.js` to avoid a large request waterfall on GitHub Pages.
- The readable source files remain canonical. After changing shared CSS, settings, data, pipelines, exporters or volatile state, run `python tools/build_frontend_bundles.py`.
- Keep full documentation, workbook, diagram, Knowledge and Tools modules page-specific; do not add them back to every entry page.
- Do not add a framework, service worker, remote CDN or runtime build dependency as a performance shortcut.


## Model visualisation contract

- Training curves, metrics, residuals, confusion matrices and comparisons must identify their model, run and dataset snapshot.
- Demonstration metrics must remain explicitly labelled as demonstration data.
- Never show a single headline metric without baseline and validation context when the surrounding view is intended for model evaluation.

## LaTeX export contract

- LaTeX source must consume `buildReportDocument`; it must not rebuild an independent report state.
- Browser export produces a local compile-ready package, not a claim that TeX was compiled remotely.
- New report sections must be implemented consistently in preview, native PDF, DOCX and LaTeX where the format supports them.

## Icon and reorder contract

- Use `assets/icons/labflow-icons.json` / `assets/js/icons.js` for product icons; branding assets are excluded.
- Every drag-reorder interaction must retain visible keyboard-accessible move buttons.
- Reordering solution components or stack layers must refresh the corresponding review immediately.
