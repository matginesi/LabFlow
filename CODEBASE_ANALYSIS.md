# LabFlow interface and codebase analysis

## Product objective

LabFlow is a frontend-only proof of concept for testing one standard perovskite
laboratory workflow from solution preparation to a NOMAD-ready package. It is
designed to collect researcher feedback, not to model every experiment family.

## Current information architecture

The primary operational destinations are Workspace, Experiments, Lab Cabinet,
Imports, Reports, Tools and NOMAD. Knowledge Assistant and AI Analysis & Agents are
specialist tools. Documentation, UI Kit, user settings and administration are
system areas.

The standard experiment path is:

`Solutions → Stacks → Processing → Data → Analysis → Charts & report → Export → NOMAD`

No experiment-type selector is required.

## Important product decisions

- Start with solution preparation.
- Support multiple stacks and simple variants without a DOE system.
- Separate reusable definitions from concrete use.
- Separate protocol from actual processing.
- Keep data attached to explicit experimental targets.
- Make report and export useful before NOMAD.
- Keep NOMAD last and separate package creation from API submission.
- Keep Knowledge Assistant, AI Analysis and Agents distinct.
- Require human confirmation for simulated knowledge actions.

## Repository structure

- Static HTML pages provide canonical product areas and specialist details.
- `assets/theme.css` contains shared theme tokens.
- `assets/app.css` contains components and responsive layout.
- `assets/app.js` mounts the shell, demo data and delegated interactions.
- `assets/exporters.js` builds local browser downloads.
- `docs/` contains concise source documentation.
- `documentation.html` presents an in-product documentation summary.
- `ui-kit.html` is the component reference.
- the topbar search provides a shared local fuzzy index and optional in-page
  filtering; Documentation and Lab Cabinet add domain-specific search.

The monolithic JavaScript is a maintenance risk, but splitting it into a
framework application is outside the current POC goal. New work should preserve
shared helpers and avoid page-specific visual themes.

## Demonstrated capabilities

- guided eight-phase experiment;
- solution recipe and batch preparation;
- multi-stack management and variants;
- reusable protocol versus actual run;
- local import preview and manual data entry;
- comparisons, charts, reports and local exports;
- NOMAD validation/package/API simulations;
- shared evidence-linked Knowledge Assistant;
- optional AI Analysis and controlled agents;
- responsive compact UI and reusable UI Kit.

## Explicit limitations

There is no backend, real security, persistent shared workspace, file storage,
database, LLM, embedding service, vector store or NOMAD connection.

The POC is successful when researchers can complete the path, understand what
each record represents, identify friction and provide actionable feedback.
