# LabFlow

## Static deployment

LabFlow is a zero-backend static POC designed to be published directly on **GitHub Pages**. There is no local server script, build system, package manager or runtime dependency.

Pipeline YAML files and step HTML remain the canonical authoring sources. For browser use they are mirrored into the generated `assets/pipeline-bundle.js`, so the runtime performs no `fetch()` calls and does not depend on CORS. After changing a Pipeline source, refresh the generated bundle with:

```bash
python3 tools/sync_pipeline_bundle.py
python3 tools/validate_poc.py
```

The generated bundle must be committed together with the source changes. It is checked automatically by the validator and must never be edited by hand.

> A static project-centred laboratory workspace POC for turning experimental work into structured, reusable, AI-ready and NOMAD-ready evidence.

**Vanilla HTML + CSS + JavaScript · No backend · No cookies · No trackers · No CDN dependency**

## Product model

LabFlow has one primary mental model:

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

A researcher opens the Workspace, creates or continues a Project and follows that Project's Pipeline. Samples, files, measurements, results and future deeper Experiment/run records belong to Project data; they are not a second navigation hierarchy.

Run and Experiment records are Project data, surfaced by the Project Data overview (`workspace.html`); there are no separate Process/Experiment pages.

## CHOSE showcase Pipeline

CHOSE is the default Pipeline and the main demonstration of the product:

```text
1. Materials & Solutions
2. Stack & Fabrication
3. Data Ingest
4. Analysis
5. Report & Export
```

The five steps are revisitable. Earlier work becomes structured input for later work rather than being entered again.

### Step 1 — Materials & Solutions

Create or reuse materials, solvents, solutes and solutions. A Project can use Lab Cabinet resources as snapshots and continue editing its own structured working data.

### Step 2 — Stack & Fabrication

Build ordered perovskite/device stacks, sample identifiers and fabrication context with graphical tools and normal text/number inputs.

### Step 3 — Data Ingest

Import or manually enter scientific evidence. Measurement meaning is separated from source file format; provenance, mapping and validation remain visible.

### Step 4 — Analysis

Compare compatible Measurements, visualise results and record explicit researcher conclusions. Future ML/DL/LLM tools can consume the same Project data without changing the product model.

### Step 5 — Report & Export

Assemble a traceable Project report, local exports and a NOMAD-ready package. The POC may simulate external submission; it never implies a real backend connection.

## Quick Workflow

`Plan → Record → Share`

This smaller Pipeline exists to prove that LabFlow is not hardcoded to CHOSE. It has its own YAML definition, step HTML and behaviour.

## Pipeline contract

Pipeline metadata has one source of truth:

```text
pipelines/<pipeline-id>/pipeline.yaml
```

A Pipeline folder may contain:

```text
pipeline.yaml
optional pipeline.js
steps/
└── <step-id>/
    ├── index.html
    └── optional step.js
```

The YAML declares the ordered steps, titles, descriptions, inputs, outputs and asset paths. `assets/app.js` does **not** contain a second copy of CHOSE/Quick metadata.

For GitHub Pages, `tools/sync_pipeline_bundle.py` generates `assets/pipeline-bundle.js` from the canonical YAML + step HTML. The browser reads that generated static bundle, so no runtime `fetch()` is required. Optional step JavaScript is loaded on demand. A pipeline-wide JavaScript file may provide shared behaviour, but it must not embed copies of step HTML.

## CSS contract

Every root page loads exactly one global stylesheet:

```html
<link href="assets/app.css" rel="stylesheet">
```

`assets/app.css` is the manifest. The modules it imports collectively own:

- themes and palettes;
- typography and spacing tokens;
- topbar/sidebar/application shell;
- page headers and breadcrumbs;
- buttons, inputs, forms and tables;
- panels, cards, states, drawers and modals;
- Common Tools and Project/Pipeline chrome;
- responsive behaviour;
- compatibility-view styling.

`assets/app.css` is the only stylesheet linked by HTML. It is a manifest for shared modules under `assets/styles/`: tokens, base, layout, shell, components, shared feature patterns, scientific visuals, utilities and responsive rules. There are no page-specific or Pipeline-step stylesheets.

`ui-kit.html` is the live component reference, `docs/DESIGN_SYSTEM.md` is the design-system contract and `docs/UI_STANDARDS.md` is the page-layout checklist.

## Minimal data model

### Core

- User
- Workspace
- Project
- Pipeline
- PipelineStep
- ProjectData

### CHOSE

- Material
- Solvent
- Solute
- Solution
- Stack

### Evidence and outputs

- Measurement
- Result
- Report
- AIRecord

AIRecord is intentionally separate from human results and notes. Raw data, processed data, human interpretation and machine-generated output must remain distinguishable.

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Workspace-wide tools

These do not create a second workflow:

- Lab Cabinet
- Knowledge & RAG
- AI Assistant
- Common Tools for text, data/spreadsheets, images, charts and graphs

A Common Tool may receive a Project identifier explicitly when Project context is useful.

## Lab Cabinet

The Lab Cabinet contains reusable materials, solutions, substrates, stacks, protocols and instruments. The POC ships with useful demo resources such as DMF, DMSO, PbI₂, FAI, SnO₂, a FA–Cs solution, a reference n-i-p stack and laboratory instruments.

Selecting a reusable resource copies a snapshot into Project data so later Cabinet changes do not silently alter Project history.

## POC state and privacy

Scientific edits and Project progress use browser `sessionStorage`. The POC is deliberately non-durable. Theme/palette preferences may use `localStorage`.

The repository does not implement:

- a backend/database;
- authentication or authorization;
- cookie infrastructure;
- real persistent file storage;
- a real LLM/RAG runtime;
- a real NOMAD network integration;
- a production parser for every recognised laboratory format.

Do not enter real credentials or confidential laboratory data.

## Main pages

| Page | Role |
| --- | --- |
| `index.html` | My Workspace: create/continue Projects |
| `project.html` | Primary Project Pipeline workspace |
| `workspace.html` | Project Data overview |
| `catalogs.html` | Lab Cabinet |
| `knowledge.html` | Knowledge & RAG surface |
| `ai-assistant.html` | AI helper/analysis demonstrations |
| `editors.html` | Common Tools |
| `documentation.html` | In-app documentation |
| `ui-kit.html` | Shared UI component reference |
| `users.html` | Personal settings |
| `admin-settings.html` | Future workspace-policy concepts |

Advanced ingest/report pages remain available from the relevant Project workflow but do not appear as parallel primary workflow stages in the sidebar.

## Run records and Lab Cabinet detail views

Execution/run records (samples, measurements, results) live in Project data and are surfaced by the Project Data overview (`workspace.html`); they are not a separate navigation hierarchy.

`stack.html` and `solution.html` remain as shared Lab Cabinet detail views holding the solvent and stack builders.

## Repository structure

```text
LabFlow/
├── index.html
├── project.html
├── workspace.html
├── catalogs.html
├── knowledge.html
├── ai-assistant.html
├── editors.html
├── documentation.html
├── ui-kit.html
├── assets/
│   ├── app.css                 single stylesheet entry point / manifest
│   ├── styles/                 shared design system modules
│   │   ├── tokens.css
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── shell.css
│   │   ├── feature-foundations.css
│   │   ├── feature-workflows.css
│   │   ├── feature-workspace.css
│   │   ├── feature-reports-ai.css
│   │   ├── feature-scientific-workbench.css
│   │   ├── scientific.css
│   │   ├── utilities.css
│   │   └── responsive.css
│   ├── app.js                  shared shell and POC behaviour
│   ├── pipeline-bundle.js      generated static Pipeline metadata + step fragments
│   ├── pipeline-loader.js      tiny runtime adapter; no network/file fetch
│   ├── project-store.js        Project-scoped session data helpers
│   ├── cabinet-store.js        reusable resources + Project snapshots
│   ├── measurement-types.js    measurement semantics
│   └── exporters.js            local export helpers
├── pipelines/
│   ├── chose/
│   │   ├── pipeline.yaml
│   │   └── steps/
│   │       ├── materials/
│   │       ├── stack/
│   │       ├── data/
│   │       ├── analysis/
│   │       └── export/
│   └── quick/
│       ├── pipeline.yaml
│       ├── pipeline.js
│       └── steps/
├── docs/
├── AGENTS.md
└── tools/validate_poc.py
```

## Preview and publish

No Bash launcher or application server is part of LabFlow. The repository is intended to be served as ordinary static files by GitHub Pages. Because Pipeline metadata and step fragments are bundled at authoring time, the browser runtime makes no request to load YAML or HTML fragments.

For Pipeline edits, run only the maintenance checks shown above before committing.

## Documentation

- [`CONSOLIDATION_NOTES.md`](CONSOLIDATION_NOTES.md) — what was consolidated and why
- [`docs/PROJECT_DEFINITION.md`](docs/PROJECT_DEFINITION.md)
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)
- [`docs/UI_STANDARDS.md`](docs/UI_STANDARDS.md)
- [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md)
- [`docs/TOOLS_EXPORTS_NOMAD.md`](docs/TOOLS_EXPORTS_NOMAD.md)
- [`docs/RESPONSIVE_AND_LIMITS.md`](docs/RESPONSIVE_AND_LIMITS.md)
