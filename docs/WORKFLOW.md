# Researcher workflow

## Product decision

The POC exposes one predefined laboratory workflow. It does not ask the
researcher to choose an invented experiment type. The goal is to let
researchers test one credible end-to-end path and provide feedback before
additional workflows are designed.

`Solutions → Stacks → Processing → Data → Analysis → Charts & Report → Export → NOMAD`

The Workspace is the entry point and an Experiment owns the workflow. Projects
are optional containers rather than a required first step.

The sequence is recommended, editable and non-blocking. A researcher may save a
draft, skip an optional activity or return to an earlier phase.

## 1. Prepare solutions

The experiment begins with one or more solution preparations:

`Solvent or mixture → Solutes → Optional additives → Concentration and quantity → Concrete batch → Review`

Essential fields appear first. Advanced chemical properties remain expandable.
Researchers can select shared substances from the Lab Cabinet or create a
minimal missing record without knowing every property.

The interface distinguishes the reusable recipe from the physical batch.
The recipe is read visually as solvents, solutes, additives, concentration and
volume. Detailed fields stay in a secondary editor. Stacks are shown as ordered
material layers and compared side by side; processing is shown as a timeline;
files retain a visible connection to the stack, device or measurement they
describe.

## 2. Define stacks

Create one stack, several similar stacks or simple variants. Each experiment
stack can record code, sample count, ordered layers, roles, materials,
substrate, dimensions, thicknesses, solution and amount used, instruments,
conditions and notes.

Variants may change a solution, concentration, material, dimension, thickness,
temperature, duration or process parameter. This is not a DOE system.

## 3. Configure and record processing

Select or edit the reusable protocol, then record the work actually executed on
the stacks. Method-specific forms show only relevant values.

Examples:

- spin coating: speed, duration, acceleration, volume, delay, instrument and
  atmosphere;
- annealing: temperature, duration, ramp, atmosphere, instrument and cooling.

Actual timestamps, values, deviations and evidence belong to the process run,
not the reusable protocol.

## 4. Add data

Primary actions are Upload file, Enter manually, Import and Add later. Supported
demonstrations include CSV, Excel, JSON, images, PDF, ZIP, instrument files,
tables, single values and series.

Data must be associated with its target: whole experiment, one or more stacks,
an executed action, a measurement or a saved result.

## 5. Analyse results

Analysis starts from data linked to the selected stacks. The researcher can
compare stacks, explore data, create a chart, use a tool or request optional AI
analysis.

The interface highlights metrics, anomalies, missing data and differences
between solutions, materials, conditions and processing.

## 6. Create charts and report

Choose stacks, measurements, titles and units; compare series; save a
visualisation; and add it to the report.

The report may include objective, solutions, materials, stacks, processing,
conditions, data, charts, results, notes, files, provenance and NOMAD status.
Generated narrative remains an editable draft.

## 7. Save and export

Export is separate from NOMAD. Formats represented in the POC include CSV,
Excel, JSON, JSONL, images, PDF, ZIP and a complete experiment archive.

Before export, the researcher sees included and excluded records, files, stacks,
data, results, version and warnings.

## 8. Prepare NOMAD

NOMAD is the final phase. Validate completeness, units, resources, stacks,
processing, instruments, data, files, identifiers, provenance and mappings.

Then choose one explicit path:

- export a NOMAD package;
- simulate submission through the NOMAD API.

Errors and warnings remain inspectable and correctable. Nothing is submitted
automatically.
