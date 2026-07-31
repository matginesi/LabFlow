# Data model

## Ownership and organisation

```text
UserAccount
└── Workspace
    ├── Lab Cabinet records
    ├── ProcessDefinition (1..n)
    │   └── Experiment (0..n)
    └── Project (0..n, optional)
        └── Experiment references
```

An Experiment belongs to exactly one ProcessDefinition version. It may belong to zero or one Project.

## ProcessDefinition

A versioned, workspace-owned scientific workflow.

```text
id
workspace_id
name
description
version
status
workflow_steps
default_resources
expected_outputs
expected_measurements
nomad_mapping_profile
created_from
```

## WorkflowStepDefinition

```text
id
process_definition_id
name
order
step_type
required
repeatable
input_roles
output_roles
applicable_methods
required_evidence
```

## Experiment

```text
id
workspace_id
process_definition_id
process_version
project_id?             # optional
title
objective
status
resource_snapshots
created_by
created_at
```

## ExperimentStep

Concrete instance of one workflow step.

```text
id
experiment_id
workflow_step_definition_id
status
started_at
completed_at
operator
inputs
outputs
deviations
notes
evidence_refs
```

## Shared definition versus concrete use

| Shared definition | Concrete record |
| --- | --- |
| MaterialDefinition | MaterialLot / MaterialUse |
| SolutionRecipe | SolutionBatch |
| SubstrateDefinition | SubstratePiece / recorded use |
| StackTemplate | ExperimentStack |
| ProtocolDefinition | ProcessRun |
| ReusableAction | ExecutedAction |
| InstrumentDefinition | InstrumentUse |
| ConditionDefinition | ActualCondition |

Every concrete use stores a versioned snapshot.

## SolutionRecipe

```text
id
version
name
solvents[]
mixture_basis
target_ratios
solutes[]
additives[]
concentration
concentration_basis
reference_volume
preparation_steps
before_use
storage
```

A solvent component includes substance ID, role, ratio, unit/basis and calculated target quantity.

## SolutionBatch

```text
id
recipe_id
recipe_version
component_lots[]
target_quantities[]
actual_quantities[]
prepared_by
prepared_at
actual_volume
environment
stirring
filtration
storage
remaining_amount
deviations
state
```

## StackTemplate and ExperimentStack

A layer stores role, material/source, thickness, order and creation/deposition method.

The ExperimentStack additionally stores source template/version, concrete substrate, samples, actual layer sources, solution usage, geometry, variants, conditions and deviations.

## Sample

Sample identity is central:

```text
Experiment
└── ExperimentStack
    └── Sample
        ├── processing history
        ├── measurements
        ├── files
        └── results
```

## FileRecord

A general file model replaces an overly narrow raw-data-only concept.

```text
id
experiment_id
role                  # raw_data, processed_data, image, instrument_export,
                      # protocol, certificate, note, report, publication,
                      # nomad_package, other
name
mime_type
size
sha256
source
parser_version
created_by
created_at
linked_targets[]
```

## Measurement and DerivedResult

Measurements add acquisition context to original files. Derived results store explicit sources, method/version, unit and validation state.

## AI and provenance

All AI-derived records store scope, sources, model/tool version, assumptions, limitations, confidence and human review state. AI never overwrites original evidence.
