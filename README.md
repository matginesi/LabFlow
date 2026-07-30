# LabFlow

LabFlow is an AI-ready scientific workflow and laboratory data platform proof
of concept for researchers working with
perovskite experiments. It connects experimental planning, multiple material
stacks, reusable laboratory resources, data review, reporting and NOMAD without
requiring the researcher to work directly inside a complex repository platform.

## Primary workflow

`Start or continue → Resources → Stacks → Data → Analysis → Outputs → Export → NOMAD`

An experiment may contain many stacks. Each stack records its layers, materials,
solution usage, conditions, executed process, files, measurements and results.

The Lab Cabinet contains shared reusable definitions. An experiment contains concrete uses
or local copies:

- solution recipe → prepared solution batch;
- pipeline template → executed process;
- action template → executed action;
- stack template → experiment stack.

Editing an experiment snapshot does not silently change the shared Lab Cabinet definition.

## What the POC demonstrates

- experiment-first workspace and actionable status;
- multi-stack table, duplication, bulk selection and variant generation;
- reusable materials, substances, solutions, substrates, conditions and processes;
- local file preview and manual table entry;
- sample, measurement and result comparisons;
- editable reports and local PDF, Excel, CSV, JSON, YAML, image and ZIP exports;
- simulated NOMAD import, validation, packaging and upload;
- optional contextual AI demonstrations;
- evidence-linked AI analysis, controlled agent runs and simulated semantic search;
- human approval states separating original data, AI output and researcher edits;
- local tools, technical documentation and a shared UI Kit.

## Page map

| Area | Page |
| --- | --- |
| Workspace | `index.html` |
| Experiments | `project.html`, `experiment.html` |
| Lab Cabinet | `catalogs.html`, detail pages |
| Imports | `imports.html` |
| Data and results | `workspace.html` |
| Reports and export | `report.html` |
| Tools | `editors.html` |
| User settings and NOMAD account | `users.html` |
| Workspace administration | `admin-settings.html` |
| AI workspace, agents and semantic search | `ai-assistant.html` |
| Documentation | `documentation.html`, `docs/` |
| UI Kit | `ui-kit.html` |

Legacy or specialist demonstrations remain available, including Projects, Flow &
Data, setup/pipeline builders and the data-exchange page.

## Run locally

No build step is required:

```sh
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`.

## GitHub Pages

All runtime links are relative and assets are local. Publish the repository root
as a GitHub Pages site; no server routes or environment variables are required.

## Architecture and limits

The POC uses plain HTML, CSS and JavaScript with no CDN dependencies. JavaScript
provides presentation interactions, demo data, local parsers and browser-generated
exports. There is no real authentication, shared persistence, database, API
proxy, AI service or NOMAD request.

AI results, agent runs, semantic retrieval, metadata extraction and anomaly
detection are interface simulations. The implemented POC demonstrates context
selection, evidence, confidence, limitations, approval and provenance—not a
connected LLM, autonomous agent or vector store.

NOMAD credentials shown in Settings are page-memory demonstrations only. A real
integration requires a secure backend and must never ship account keys in static
JavaScript. Binary formats that cannot be parsed safely without dependencies are
represented by an explicit simulated mapping step.

## Documentation

- [User workflow](docs/WORKFLOW.md)
- [Data model](docs/DATA_MODEL.md)
- [POC architecture and page map](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Glossary](docs/GLOSSARY.md)
- [AI and agent architecture](docs/AI_ARCHITECTURE.md)
- [Tools, exports and NOMAD](docs/TOOLS_EXPORTS_NOMAD.md)
- [Responsive and POC limits](docs/RESPONSIVE_AND_LIMITS.md)
- [Codebase analysis](CODEBASE_ANALYSIS.md)
