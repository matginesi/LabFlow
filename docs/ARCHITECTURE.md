# Frontend architecture

## POC constraints

LabFlow is a static showcase and laboratory UX proof of concept:

- vanilla HTML, CSS and JavaScript;
- no frontend framework;
- no backend requirement;
- no cookie infrastructure;
- no trackers or CDN dependency;
- scientific state is session-scoped in the browser;
- appearance preferences may persist locally.

The goal is not to imitate a large SaaS. The goal is to make the intended laboratory workflow tangible and extensible.

## Product architecture

```text
User
└── Workspace
    ├── Projects
    │   └── Project
    │       ├── Pipeline
    │       │   └── Steps
    │       └── Project Data
    ├── Lab Cabinet
    ├── Knowledge & RAG
    ├── AI Assistant
    └── Common Tools
```

## Shared frontend files

- `assets/app.css` — the single global stylesheet: tokens, palettes, shell, components, Project/Pipeline UI and responsive rules.
- `assets/app.js` — shared shell, navigation, project/session UI and page behaviour.
- `assets/pipeline-bundle.js` — generated, browser-ready mirror of canonical Pipeline YAML + step HTML. Never edit by hand.
- `assets/pipeline-loader.js` — tiny runtime adapter over the generated bundle; it performs no network/file fetch.
- `assets/project-store.js` — Project-scoped session data helpers used by CHOSE steps.
- `assets/cabinet-store.js` — reusable Lab Cabinet records and Project snapshot hand-off.
- `assets/measurement-types.js` — measurement semantics and deterministic mapping helpers.
- `assets/exporters.js` — local browser export helpers.

Lab Cabinet detail views and shared scientific utilities must not define a second application shell or navigation hierarchy.

## Pipeline architecture

Human-edited Pipeline metadata lives only in YAML:

```text
pipelines/<id>/pipeline.yaml
```

The loader reads the YAML at runtime. `app.js` uses the loaded objects for:

- Project cards;
- Project creation wizard;
- sidebar step navigation;
- Project Pipeline workspace;
- step input/output labels;
- dynamic step assets.

No copy of CHOSE/Quick step names belongs in `app.js`.

HTML owns each step surface and JavaScript owns step behaviour. Visual styling always comes from the shared UI Kit design system; Pipeline YAML no longer declares CSS assets. For the static browser runtime, `tools/sync_pipeline_bundle.py` generates `assets/pipeline-bundle.js` from the YAML and step HTML. This generated file is a derived artifact, not a second hand-maintained source of truth. A pipeline-level JS file is allowed for shared behaviour but must not embed hand-maintained copies of step HTML.

## CSS architecture

Every root page loads exactly:

```html
<link href="assets/app.css" rel="stylesheet">
```

`assets/app.css` is a small manifest loaded by every page. It imports the documented shared modules under `assets/styles/`. No route, feature or Pipeline step is allowed to ship its own stylesheet.

Forbidden in step/page CSS:

- redefining `.button`, `.panel`, `.input`, `.field`;
- redefining `.topbar`, `.sidebar`, `.page-header`;
- creating another typography, spacing or palette system;
- copying a shared component with a slightly different name.

## State boundaries

The POC uses browser session state for scientific work. The intended future backend boundary remains simple:

- User/Workspace ownership;
- Project metadata and ProjectData persistence;
- reusable Lab Cabinet resources;
- file storage/provenance;
- report/export services if needed.

The frontend data shape should remain machine-readable and stable enough to map into that backend without redesigning the UX.

## Run records and Lab Cabinet detail views

Concrete execution records (runs, samples, measurements, results) live in Project data and are surfaced by the Project Data overview (`workspace.html`). The shared Lab Cabinet detail views `stack.html` and `solution.html` hold the solvent and stack builders, which live in `assets/app.js`.
