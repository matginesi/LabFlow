# LabFlow codebase revision report

## Implemented product model

The proof of concept now follows one canonical operational hierarchy:

`User → Workspace → Process → Experiment`

- **Workspace** is the researcher-owned operating context.
- **Process** is a versioned scientific workflow definition.
- **Experiment** is one concrete execution of a Process.
- **Project** is an optional cross-cutting grouping and is never required.
- **Lab Cabinet** contains reusable definitions and physical inventory resources.

The word **Process** no longer means protocol. Protocols are reusable resources
that can be selected by Process steps and executed as concrete Processing Runs.

## Main implementation changes

### Process and experiment navigation

- added a dedicated Process directory;
- turned the former Pipeline page into a Process detail page;
- added an autonomous Experiment directory;
- added current-Process context to the shell;
- changed experiment creation to `Select Process → Name & objective → Starting configuration`;
- retained Projects as optional research context.

### Scientific workflow

The standard Process path is:

`Solutions → Stacks & samples → Processing → Data → Analysis → Charts & report → Export → NOMAD`

A Process defines phases, default resources, expected measurements, required
evidence and a NOMAD mapping profile. An Experiment stores actual values,
deviations, files, samples and reviewed outputs.

### Solutions and solvents

The solution model now distinguishes:

- `SolventDefinition` and mixture components;
- `SolutionRecipe` as a reusable formulation;
- `SolutionBatch` as a physical preparation;
- actual material lots, masses, volumes, operator, date, atmosphere,
  filtration, remaining quantity and deviations.

The graphical solvent editor supports multiple components and calculates the
mixture ratio and nominal component volumes from the total volume.

### Stacks and samples

The stack model now distinguishes:

- `StackTemplate` as a reusable ordered definition;
- `ExperimentStack` as a versioned snapshot or experiment-specific variant;
- `StackLayer` with role, material, thickness, source and method;
- `Sample` as the stable physical identity generated from a concrete stack;
- processing history and measurements attached to sample IDs.

The graphical stack editor supports layer selection, addition, ordering,
duplication, removal and editing without requiring a DOE system.

### Data model and documentation

The source documentation now includes explicit records for:

- `ProcessDefinition`;
- `WorkflowStepDefinition`;
- `ExperimentStep`;
- `FileRecord` with raw/processed/image/instrument/report/AI roles;
- reusable definition snapshots and concrete evidence;
- stable IDs, units, provenance, validation and human/AI origin;
- NOMAD mapping without allowing NOMAD to dictate the researcher interface.

### Maintainability

New workflow-specific behavior and styling are isolated in:

- `assets/workflow-domain.js`;
- `assets/workflow.css`.

The legacy `assets/app.js` and `assets/app.css` remain large because this is a
static POC, but new domain behavior is no longer added exclusively to those two
files. This is an incremental split rather than an unnecessary framework rewrite.

## Canonical terminology

| Term | Meaning |
|---|---|
| Process | Versioned definition of a family of laboratory work |
| Protocol | Reusable ordered method available as a resource |
| Processing Run | Actual execution of a protocol or action sequence |
| Solution Recipe | Reusable formulation |
| Solution Batch | Physical solution prepared from a recipe |
| Stack Template | Reusable ordered layer structure |
| Experiment Stack | Snapshot or variant used in one experiment |
| Sample | Stable physical specimen or device identity |
| Project | Optional grouping of related experiments |

## Remaining production boundaries

This repository intentionally remains a static proof of concept. It has no real
backend, database, authentication, authorization, shared file storage, AI service,
RAG index or NOMAD API connection. Browser storage and generated downloads are
demonstrations, not durable scientific records.
