# LabFlow agent contract

This file is the non-negotiable implementation contract for coding agents working on the static POC.

## Product constitution

1. **LabFlow is a static POC, not a SaaS.** Use vanilla HTML, CSS and JavaScript. Do not add frameworks, cookie infrastructure, analytics, trackers or unnecessary platform layers.
2. **There is one global UI.** Every root page loads `assets/app.css`. Shared controls, cards, forms, headers, shell and navigation must never be reimplemented page-by-page.
3. **There is one primary mental model:** `User → Workspace → Project → Pipeline → Step`.
4. **Project is the primary unit of scientific work.** Detailed samples, runs, measurements, results and future Experiment records live inside Project data.
5. **Pipeline metadata is authored in YAML.** Do not duplicate CHOSE/Quick names, ordered steps, descriptions, inputs or outputs by hand in `app.js` or another manifest. `assets/pipeline-bundle.js` is the sole exception because it is generated from YAML + step HTML by `tools/sync_pipeline_bundle.py` and validator-checked.
6. **Step HTML has one source.** Do not copy step HTML into JavaScript fallback strings.
7. **CHOSE is the showcase Pipeline.** Preserve and improve the five steps: Materials & Solutions; Stack & Fabrication; Data Ingest; Analysis; Report & Export.
8. **Workspace tools are not another workflow.** Lab Cabinet, Knowledge & RAG, AI Assistant and Common Tools remain shared utilities. Project-specific tools belong to Pipeline steps.
9. **UI Kit is the UI ground truth.** HTML pages link only `assets/app.css`, which imports the shared modules in `assets/styles/`. Page-specific and Pipeline-step CSS files are forbidden. Reusable shell, layout, controls and scientific visuals must be promoted to the shared design system. Structural inline styles are forbidden; inline values are allowed only for genuinely data-driven values such as progress widths, chart values or scientific ratios.
10. **Do not delete useful capability casually.** Older Process/Experiment pages are compatibility/detail views. Their demo model is quarantined in `assets/compatibility-domain.js` and must not be loaded by primary routes. They may be simplified or eventually removed only after useful concepts are intentionally migrated.
11. **Keep data backend-ready without overengineering.** Stable IDs, explicit units, provenance and clear structures matter; a giant production schema does not belong in the POC.
12. **AI and NOMAD are optional consumers.** Core laboratory work must remain usable without AI or a NOMAD service.

## Before finishing any change

Run:

```bash
python3 tools/validate_poc.py
```

Then validate the static repository and check at minimum:

- `index.html`
- `project.html`
- `project.html?step=stack`
- `project.html?step=data`
- `catalogs.html`
- `editors.html`
- `ui-kit.html`

Do not consider a change complete if the browser console contains application errors.


## UI review requirement

Before changing layout or reusable UI, read `ui-kit.html`, `docs/DESIGN_SYSTEM.md` and `docs/UI_STANDARDS.md`. Scientific graphics are 2D; normal controls use the global compact dimensions; the sidebar must not accumulate duplicate context or administrative links.
