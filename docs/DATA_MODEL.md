# Data model

## Model goals

The model supports one validated workflow without inventing experiment
categories. It separates reusable definitions from what was physically used or
performed, and keeps every result traceable to evidence.

## Ownership and organisation

`Laboratory / Workspace → Project → Experiment`

- **Laboratory / Workspace** contains shared knowledge and Lab Cabinet records.
- **Project** groups related experiments, reports and exports.
- **Experiment** is one concrete research activity using the standard workflow.

The static POC only simulates this scope. A backend must enforce it.

## Shared definitions and concrete use

| Shared definition | Concrete experiment record |
| --- | --- |
| Material or substance | Material lot or recorded use |
| Solution recipe | Prepared solution batch |
| Stack template | Experiment stack |
| Protocol | Processing run |
| Reusable action | Executed action |
| Instrument | Instrument use and actual settings |
| Condition definition | Actual condition |

An experiment stores a usage snapshot containing the referenced resource,
affected stacks, amount and unit, actual parameters, time, operator and the
relevant definition version. Later Lab Cabinet edits must not change historical
evidence silently.

## Standard experiment graph

```text
Experiment
├── SolutionRecipe
│   └── SolutionBatch
├── ExperimentStack (one or more)
│   ├── ordered layers
│   ├── materials and substrate
│   └── solution usage
├── ProcessRun
│   └── ExecutedAction
├── Sample
├── Measurement
│   ├── DataFile
│   └── DerivedResult
├── SavedVisualisation
├── Report
└── ExportPackage / NomadPackage
```

## Essential records

### SolutionRecipe

Name, version, solvents and ratios, solutes, additives, target concentration,
reference volume, preparation instructions, storage and optional advanced
chemistry.

### SolutionBatch

Recipe version, actual component lots and quantities, prepared by and at,
actual volume, deviations, filtration, storage, remaining amount and state.

### ExperimentStack

Code, sample count, ordered layers, layer roles, materials, substrate,
dimensions, thicknesses, solution and quantity applied, instruments,
conditions, notes and optional source template.

### ProcessRun and ExecutedAction

Protocol version, target stacks, actual sequence, timestamps, operator,
instruments, atmosphere, actual method-specific parameters, deviations, inputs,
outputs and evidence.

### DataFile, Measurement and DerivedResult

The original file remains evidence. A measurement adds acquisition context. A
derived result stores a value, series or statistic with unit, source references,
method/version and validation state.

### Report and ExportPackage

A report stores selected sections, editable narrative, charts and source
references. An export package records scope, format, included and excluded
records, version, warnings, manifest and checksums.

## AI and knowledge records

- **KnowledgeSource**: title, type, provenance, tags, status, date and linked
  file/resource.
- **KnowledgeAnswer**: question, selected scope, cited sources, evidence,
  conflicts, insufficiency warning and generated timestamp.
- **AIAnalysis**: data scope, source references, analysis request, output,
  confidence, assumptions, limitations and review status.
- **AgentRun**: bounded objective, permitted inputs/actions, steps, proposals,
  evidence and approval decisions.

AI-derived records never overwrite original data.
