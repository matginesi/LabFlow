# Researcher workflow

## Canonical hierarchy

```text
User → Workspace → Project → Pipeline → Step
```

This is the only primary product hierarchy. A researcher opens a Workspace, creates or continues a Project, and works through the Project's selected Pipeline. Detailed scientific records such as measurements, samples, runs or future experiment entities live **inside Project data**; they are not another competing navigation hierarchy.

## CHOSE showcase Pipeline

CHOSE is the default and most complete Pipeline:

```text
1. Materials & Solutions
2. Stack & Fabrication
3. Data Ingest
4. Analysis
5. Report & Export
```

The steps are recommended, revisitable and non-blocking. Each step consumes existing Project context and creates structured data for later steps.

### 1. Materials & Solutions

Create or reuse:

- Material
- Solvent
- Solute
- Solution

A Solution stores a useful composition first, followed by optional preparation, handling, storage and provenance metadata. Reusable records may come from the Lab Cabinet; the Project receives a snapshot so later Cabinet edits do not silently rewrite Project history.

### 2. Stack & Fabrication

Create one or more ordered Stacks. Each Stack can contain layers, material references, thickness, fabrication operations, sample/device identifiers, atmosphere and instrumentation metadata.

### 3. Data Ingest

The workflow is measurement-first rather than extension-first:

```text
Add data → Detect → Preview → Map → Validate → Attach
```

The Project preserves source identity and provenance. File format is technical metadata; scientific meaning is represented by a Measurement type such as JV, Dark JV, IPCE, UV/VIS, Stability or generic/manual evidence.

### 4. Analysis

Select Project Measurements, compare compatible evidence, visualise trends and store explicit researcher conclusions. Future AI/ML tools may consume the same structured data without replacing human results.

### 5. Report & Export

Assemble Project evidence into a report, local data exports and a NOMAD-ready package. The static POC may simulate readiness and submission actions but does not imply a backend or external service.

## Quick Workflow

The second demonstration Pipeline intentionally proves that LabFlow is not hardcoded to CHOSE:

```text
Plan → Record → Share
```

Its metadata and step order come from `pipelines/quick/pipeline.yaml`. Its HTML lives in the corresponding `steps/` folders and its pipeline-wide JavaScript contains behaviour only, never copies of the HTML.

## Pipeline file contract

A Pipeline folder may contain:

```text
pipelines/<pipeline-id>/
├── pipeline.yaml
├── optional pipeline.js
└── steps/
    └── <step-id>/
        ├── index.html
        └── optional step.js
```

`pipeline.yaml` is the human-edited source of truth for name, description, ordered steps, inputs, outputs and asset paths. `assets/pipeline-bundle.js` is the only allowed mirror because it is generated deterministically from YAML + step HTML and checked by the validator. `app.js` must never contain another hand-maintained Pipeline definition.

## Workspace tools versus Project tools

Workspace-wide tools remain available independently from a Project:

- Lab Cabinet
- Knowledge & RAG
- AI Assistant
- Common Tools: text/data/image/chart/graph utilities

Pipeline-specific tools belong to a Project Step and operate on that Project's data. A common tool may receive explicit Project context, but it does not become a second workflow.

## Session lifecycle

This is a static POC. Scientific edits and Pipeline progress use session-scoped browser state. Appearance preferences may persist locally. No cookie infrastructure, backend account system or SaaS administration layer is implied.

## Compatibility views

Older Process and Experiment pages remain temporarily available as compatibility/detail views so useful scientific UI is not discarded. They are deliberately absent from the main navigation and global search. New product work must not use them as the primary hierarchy.
