# POC architecture

## Purpose

LabFlow is a static, multi-page interface proof of concept for testing a
researcher workflow between laboratory work and NOMAD. It demonstrates
information architecture, interaction patterns and browser-side outputs. It is
not a production application.

## Product architecture

```text
Researcher
    ↓
Workspace
    ├── Lab Cabinet ── reusable resources ──┐
    └── Experiment ←────────────────────────┘
            ↓
       Scientific workflow
            ↓
          Report
            ↓
          Export
            ↓
          NOMAD
```

Projects may group related experiments, but remain optional.

## Runtime

- semantic HTML pages;
- `assets/theme.css` for tokens and light/dark themes;
- `assets/app.css` for shared layouts and components;
- `assets/app.js` for the shell, demo stores and interactions;
- `assets/exporters.js` for browser-generated files;
- no framework, build step, CDN or server route.

The repository root can be served by any static HTTP server or GitHub Pages.

## Product areas

| Area | Canonical page | Responsibility |
| --- | --- | --- |
| Workspace | `index.html` | Resume work, see attention items and create an experiment. |
| Experiments | `project.html`, `experiment.html` | Follow the standard eight-phase workflow. |
| Lab Cabinet | `catalogs.html` | Shared reusable laboratory resources. |
| Imports | `imports.html` | Preview and map files or NOMAD records. |
| Data workspace | `workspace.html` | Inspect measurements, results and comparisons. |
| Tools | `editors.html` | Local editing, validation, conversion and visualisation. |
| Reports and export | `report.html` | Build reports and generate local output packages. |
| NOMAD | `report.html#nomad` | Validate, package and simulate explicit submission. |
| Knowledge Assistant | `knowledge.html` | Consult shared knowledge with cited evidence. |
| AI Analysis & Agents | `ai-assistant.html` | Analyse data and demonstrate controlled agents. |
| Settings | `users.html` | User preferences and personal NOMAD connection. |
| Administration | `admin-settings.html` | Workspace-level POC settings. |
| Documentation | `documentation.html`, `docs/` | Product, model and implementation guidance. |
| UI Kit | `ui-kit.html` | Canonical component examples. |

Specialist detail pages remain deep links. They should not become competing
top-level workflows.

## State and interaction model

Demo state lives in JavaScript memory or `localStorage` where explicitly noted.
Delegated event handlers support pages that render content dynamically. Data is
not shared between browsers or users.

The shell exposes a user, workspace and project context for credibility. These
are interface demonstrations, not security boundaries.

The shared search component combines optional filtering of visible
`data-filter-item` records with a small fuzzy-matched index of canonical
destinations. Documentation also indexes its embedded manual sections. All
searching runs locally and contains only demo content.

## Architectural boundaries

The POC does not contain:

- authentication or authorization;
- backend persistence or multi-user synchronisation;
- file storage;
- a database or API;
- real LLM, embeddings, vector search or autonomous agents;
- real NOMAD import or submission;
- secure secret storage.

A future backend must enforce ownership, permissions, immutable provenance,
file integrity, secret management and every external network request.
