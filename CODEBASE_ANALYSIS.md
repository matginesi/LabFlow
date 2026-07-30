# LabFlow interface analysis

## Product goal

LabFlow is a frontend-only proof of concept for moving a perovskite experiment from
planning to structured results and a NOMAD-ready package. It does not authenticate,
persist server-side data or call NOMAD.

## What was already present

- A reusable material, solution, stack, method and process catalogue
- Experiment planning and execution views
- Editable result tables, charts, images and report fields
- Browser-generated JSON, CSV, Excel, YAML, PDF and NOMAD ZIP files
- Simulated NOMAD import and upload flows
- A UI kit, documentation, visual data model and optional AI demonstrations

## Problem found

The capabilities were organised around implementation concepts: Projects, Catalog,
Editors, Flow and AI. A researcher had to infer where to go next, and stack resources
looked detached from the experiment. Import, editing, reporting and NOMAD were separate
destinations without a visible end-to-end path.

## Interface decision

The primary path is now:

`Workspace → Experiment → Stacks → Data → Results & report → NOMAD`

Projects remain useful as optional research organisation. The sidebar now separates
operational work, specialist functions and system/demo resources. It does not expose
one navigation item for every scientific entity.

Within an experiment, a stack is the operational bundle that connects ordered layers
to solutions, solutes/materials, conditions, pipeline steps and researcher actions.
Multiple stacks may be linked to the same experiment.

## Repository inventory and disposition

- 19 static HTML pages share the shell mounted by `assets/app.js`.
- `assets/theme.css` owns tokens and light/dark themes; `assets/app.css` owns layout
  and component patterns.
- `catalogs.html` is the shared Lab Cabinet: search, categories, availability,
  resource detail, usage history and minimal creation.
- `imports.html` is the dedicated import entry point.
- `workspace.html` remains the data/result comparison workspace.
- `report.html` owns report building, local export and experiment NOMAD validation.
- `users.html#nomad` owns the personal NOMAD connection.
- `editors.html` remains Tools; `ai-assistant.html` remains an optional specialist demo.
- `projects.html` is retained as optional research organisation.
- `exports.html` is retained as a specialist/compatibility data-exchange demo rather
  than duplicated in primary navigation.
- `flow.html`, `documentation.html` and `ui-kit.html` remain technical demonstrations.

The existing JavaScript is intentionally not split into a framework application.
Its monolithic size is a maintenance risk, but a broad module refactor would add risk
without improving this static POC. New work therefore reuses the delegated listeners,
escaping helpers, export utilities, demo charts and existing component renderers.

CSS consolidation was similarly targeted. New patterns use existing tokens, borders,
spacing and responsive breakpoints. No second theme or utility framework was added.

## Lab Cabinet interaction model

The cabinet stores shared laboratory definitions and lightweight availability
signals; it is deliberately not an inventory or booking system. Selecting a cabinet
record from an experiment creates a traceable experiment usage/snapshot. The snapshot
may hold stack IDs, quantities, parameters and actual conditions without mutating the
shared definition.

The experiment resource picker stays in context, groups favorites and recent records,
prevents unavailable equipment from being selected, and offers a minimal “create and
use” path with duplicate checking and shared-versus-local visibility.

## POC boundaries

- Data files are previewed locally; they are not uploaded.
- Manual editing uses the local workbook/report editors.
- Exports are generated in the browser.
- NOMAD browsing and upload are explicit simulations.
- API keys stay in page memory. A real integration requires a secure backend and must
  never embed credentials in static JavaScript.
