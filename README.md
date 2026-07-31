# LabFlow

> A workflow-first laboratory platform concept for turning experimental work into structured, reusable, AI-ready and NOMAD-ready evidence.

**Static proof of concept · Perovskite research · No backend · No external services**

[Open the workspace](index.html) · [Browse processes](processes.html) · [Open the demo experiment](experiment.html) · [Read the manual](documentation.html)

## Core model

LabFlow is organised around one simple operational hierarchy:

```text
User
└── Workspace
    ├── Lab Cabinet
    ├── Processes
    │   └── Experiments
    └── Projects (optional)
        └── references experiments
```

- A **Workspace** owns the researcher's reusable definitions and records.
- A **Process** defines a versioned laboratory workflow: phases, default resources, expected evidence, expected measurements and interoperability mapping.
- An **Experiment** is one concrete execution of exactly one Process.
- A **Project** is an optional cross-process grouping around a research question. It is never required to start work.
- The **Lab Cabinet** stores reusable definitions and physical inventory references used by Processes and Experiments.

This distinction removes a previous ambiguity: a Process is not a protocol. A protocol is one reusable Lab Cabinet resource that can be used by one or more Process phases.

## The researcher workflow

The current perovskite Process uses eight recommended, non-blocking phases:

```text
Solutions
→ Stacks & samples
→ Processing
→ Data
→ Analysis
→ Charts & report
→ Export
→ NOMAD
```

The Process defines those phases. The Experiment records their concrete execution through batches, stack instances, samples, process runs, measurements, files, results, deviations and approvals.

## Definition versus evidence

The central data-model rule is that reusable definitions are never confused with physical or executed records.

| Reusable definition | Concrete evidence |
| --- | --- |
| Solution recipe | Prepared solution batch |
| Solvent/substance definition | Physical lot and actual quantity |
| Stack template | Experiment stack and samples |
| Protocol | Processing run and executed actions |
| Instrument definition | Instrument instance/use and actual settings |
| Workflow step definition | Experiment step with status and evidence |

Editing a shared definition later must never silently rewrite historical experiments. Every concrete use retains a versioned usage snapshot.

## Processes

A Process contains:

- stable ID and published version;
- ordered workflow-step definitions;
- default recipes, stack templates, protocols, instruments and conditions;
- expected inputs, outputs and evidence;
- expected measurements;
- NOMAD mapping profile;
- experiments that execute the Process.

The Process page is [`pipeline.html`](pipeline.html) for backward URL compatibility, but it now represents a complete Process definition rather than a protocol editor.

## Solutions and solvents

The solution workflow is explicitly divided into:

1. **Solvent mixture** — identities, mixture basis, ratios and calculated component volumes.
2. **Solutes and additives** — target quantities, concentration and concentration basis.
3. **Preparation definition** — reusable order, temperature, time, filter and storage instructions.
4. **Concrete batch** — actual lots, weighed quantities, volumes, operator, timestamps, environment, deviations and remaining amount.

The graphical solvent editor validates the mixture ratio and recalculates component volumes from the selected reference volume. A recipe stores target composition; a batch stores what was physically prepared.

## Stacks and samples

The graphical stack builder represents an ordered cross-section from substrate to top contact. Every layer records:

- role;
- material;
- thickness;
- definition, lot or solution-batch source;
- deposition or creation method;
- order within the structure.

A reusable Stack Template becomes an Experiment Stack when selected. The experiment instance then adds concrete substrate identity, samples, solution usage, dimensions, variant parameters, deviations and execution evidence.

Simple variants are supported without introducing a full design-of-experiments system.

## Lab Cabinet

The Lab Cabinet is divided conceptually into two families.

### Reusable definitions

- materials and substances;
- solution recipes;
- substrate definitions;
- stack templates;
- protocols and reusable actions;
- instrument definitions;
- condition definitions.

### Physical inventory and evidence references

- material lots;
- prepared solution batches;
- substrate pieces;
- instrument instances;
- lightweight availability information.

Processes select defaults from the Lab Cabinet. Experiments create immutable usage snapshots and actual evidence.

## AI readiness

AI is not required for the POC to work. The data model is prepared for future AI by using:

- stable identifiers;
- explicit units;
- structured provenance;
- human/AI origin;
- source references;
- validation and review states;
- separation between raw data, processed data, human notes and AI outputs.

LabFlow keeps three AI purposes separate:

| Surface | Purpose | Boundary |
| --- | --- | --- |
| Knowledge Assistant | Retrieve and cite shared knowledge | Must show evidence and insufficiency |
| AI Analysis | Interpret selected experimental data | Never overwrites measurements |
| Controlled Agents | Propose bounded multi-step actions | Explicit approval before application |

The repository contains only interface simulations—no LLM, embeddings, vector database or autonomous runtime.

## NOMAD readiness

NOMAD remains the final explicit phase:

```text
Experiment evidence → Report → Export review → NOMAD package or explicit API action
```

The Process defines expected mapping and evidence. The Experiment supplies concrete records. The POC validates completeness, units, resources, stacks, processing, instruments, files, identifiers and provenance before package generation.

## Main pages

| Page | Responsibility |
| --- | --- |
| `index.html` | Workspace, current Process and recommended actions |
| `processes.html` | Process directory |
| `pipeline.html` | Process definition detail |
| `experiments.html` | Experiment directory grouped by Process |
| `experiment.html` | Eight-phase concrete experiment workflow |
| `solution.html` | Graphical recipe, solvent and batch detail |
| `stack.html` | Graphical ordered-layer builder |
| `catalogs.html` | Lab Cabinet definitions and physical resources |
| `workspace.html` | Samples, measurements and comparisons |
| `report.html` | Report, export and NOMAD preparation |
| `projects.html` / `project.html` | Optional research grouping |
| `imports.html` | Local import and mapping |
| `editors.html` | Deterministic scientific tools |
| `knowledge.html` | Evidence-linked knowledge simulation |
| `ai-assistant.html` | AI Analysis and controlled-agent simulations |
| `documentation.html` | In-app manual |
| `ui-kit.html` | Interface components |

## Frontend architecture

```text
Static HTML pages
├── assets/theme.css            tokens and themes
├── assets/app.css              shared shell and legacy components
├── assets/workflow.css         Process, solution and stack module styles
├── assets/exporters.js         browser-generated files
├── assets/workflow-domain.js   Process/experiment data and graphical builders
└── assets/app.js               shell and remaining POC interactions
```

The new workflow module prevents further growth of the original monolithic files while retaining a framework-free, no-build static prototype.

## Run locally

```sh
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/`.

## Static POC boundaries

The repository has no production authentication, authorization, database, shared persistence, secure file storage, background jobs, real AI, or real NOMAD connection. `localStorage` is used only to simulate user, Process and optional Project context.

A production backend must enforce ownership, versioning, immutable provenance, file integrity, permissions, secret management and all external network actions.
