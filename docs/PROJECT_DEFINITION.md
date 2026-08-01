# LabFlow project definition

## Product statement

LabFlow is a project-centred laboratory workspace concept. It demonstrates how a researcher can move from an objective to structured experimental evidence, analysis, a report and a NOMAD-ready export without learning a repository schema first.

This repository is a static proof of concept (POC), not a production laboratory information system. Its purpose is to validate the workflow, information architecture, scientific vocabulary and interaction design—and to make the implementation quality directly inspectable.

## Problem

Experimental context is commonly split across notebooks, instrument exports, spreadsheets, files and repository forms. Researchers repeatedly reconstruct the relationship between materials, fabrication, samples, measurements and conclusions. That weakens provenance and makes later reporting, reuse, AI assistance and interoperability harder.

LabFlow tests a single working context in which those relationships are collected progressively while the work is performed.

## Intended users

- Researchers planning, executing and analysing laboratory work.
- Principal investigators reviewing progress and evidence quality.
- Laboratory managers maintaining reusable definitions and future workspace policy.
- Developers and research-data specialists evaluating a possible production architecture.

## Product model

```text
User
└── Workspace
    ├── Projects
    │   └── Pipeline
    │       └── ordered, revisitable Steps
    ├── Lab Cabinet
    ├── Knowledge & RAG
    └── AI Assistant and Common Tools
```

- **Workspace** is the user's operating context and entry point.
- **Project** is the primary unit of research work and the boundary for progress, records and outputs.
- **Pipeline** is a selectable workflow definition for a kind of work.
- **Step** is an ordered but non-blocking stage that creates or reviews Project data.
- **Lab Cabinet** contains reusable definitions and lightweight inventory references; using one creates a Project snapshot.
- **Experiment, sample, run and measurement** remain scientific records within the Project rather than competing navigation roots.

Shared Workspace resources operate at Workspace scope and never silently inherit the
current Project. Report, ingest, export and Pipeline steps are Project-owned.
Tools, Knowledge and AI become Project-scoped only through an explicit hand-off
that carries the Project identifier.

## Implemented workflows

### CHOSE

`Materials & Solutions → Stack & Fabrication → Data Ingest → Analysis → Report & Export`

The last step includes NOMAD readiness and local package generation. Submission is simulated.

### Quick Workflow

`Plan → Record → Share`

This independent, reduced workflow demonstrates that a Pipeline can have its own steps, data shape and UI without inheriting CHOSE assumptions.

## Ingest definition

The ingest surface accepts multiple local files and represents four capability levels:

1. Direct local preview for delimited text and JSON-family data.
2. Structured mapping for XML, YAML and supported text instrument formats.
3. Recognition and metadata capture for spreadsheets, scientific arrays, archives, PDF, images and binary instrument exports.
4. Manual entry for single values, series and small tables.

Recognised families include CSV, TSV, TXT, DAT, ASC, JSON, JSONL/NDJSON, XML, YAML, XLS/XLSX/ODS, Parquet, HDF5, NetCDF/CDF, JCAMP-DX, SPC/SPE, XY, XRDML/RAW, PDF, ZIP/TAR/GZ and common images. A listed format is not necessarily fully parsed: the UI must label direct parsing, preview, mapping and simulation honestly.

Every ingest draft should make file identity, type, size, target Project/stack/sample, measurement meaning, units, transformations, exclusions and review status visible. Files are read locally; nothing is uploaded.

## POC data and privacy contract

- Scientific and Project state uses `sessionStorage` and is scoped to the browser tab session.
- A new browser-tab session starts without saved scientific records; static empty Project shells are navigation fixtures, not persisted evidence.
- Closing the tab ends the demonstration state; the POC is not a durable record system.
- Theme, palette and account-display preferences may use `localStorage` because they are interface preferences, not scientific evidence.
- No cookies are created.
- No analytics or trackers are included.
- No CDN or runtime third-party assets are required.
- No file, credential or scientific record is transmitted by the application.
- Demo values are fictitious and must not be treated as scientific truth.

Never enter real credentials, personal data, confidential research data or regulated records.

## Settings ownership

- **Settings** contains personal identity, appearance, research defaults, a session-only NOMAD connection simulation and privacy controls.
- **Admin Settings** contains workspace identity, member/role concepts, scientific conventions, integration policy and governance concepts.

Admin controls demonstrate future ownership and policy. They do not provide real authorization or enforcement in this static frontend.

## Success criteria for the POC

The POC succeeds when a reviewer can:

1. Explain `Workspace → Project → Pipeline → Step` without implementation guidance.
2. Start or continue a Project and understand the next useful action.
3. Build structured materials/fabrication context, ingest heterogeneous evidence and connect it to analysis.
4. Distinguish reusable Cabinet definitions from Project-owned usage snapshots.
5. Inspect provenance and readiness before creating a report or export.
6. Understand which AI, RAG, NOMAD and binary parsing functions are simulations.
7. Confirm that scientific data is temporary and that the page has no cookies, trackers or CDN dependencies.
8. Use the same visual language, page spacing and responsive behaviour across routes.

## Out of scope

The repository does not implement a backend, database, durable file storage, authentication, authorization, multi-user collaboration, audit log, real LLM/RAG runtime, secure secrets, production parsers for every recognised format, or a real NOMAD network integration.

## Production direction

A production implementation would add workspace tenancy and roles, an API and database, immutable/versioned evidence, object storage with hashes, parser workers, schema validation, auditable AI execution, secret management, explicit external submission jobs, observability and retention controls. The POC's structured Project model and approval boundaries are intended to inform that work, not substitute for it.

## Decision log

| Decision | Rationale |
| --- | --- |
| Project is the primary unit | Keeps workflow, evidence, analysis and output in one intelligible context. |
| Pipeline steps are revisitable | Laboratory work is iterative and should not be blocked by a rigid wizard. |
| Scientific state is session-only | The POC demonstrates flow without implying durability or data safety. |
| Appearance may persist locally | Palette and theme are harmless interface preferences. |
| Tools/RAG/Cabinet are workspace-wide | They serve multiple Projects; concrete use is linked back through snapshots or explicit context. |
| NOMAD is in the final Project step | Interoperability becomes an outcome of collected evidence, not the starting mental model. |
| No CDN, trackers or cookies | Keeps the prototype self-contained, private by default and deployable as static files. |
