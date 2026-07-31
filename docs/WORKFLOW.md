# Researcher workflow

## Operational hierarchy

```text
User → Workspace → Process → Experiment
```

A Project may optionally group experiments, including experiments from different Processes. It is never an execution prerequisite.

## Process definition

A Process defines:

- ordered workflow phases;
- default reusable resources;
- required and optional inputs;
- expected outputs and evidence;
- expected measurements;
- NOMAD mapping profile.

The current validated Process follows:

`Solutions → Stacks & samples → Processing → Data → Analysis → Charts & report → Export → NOMAD`

The sequence is recommended and non-blocking. An Experiment creates an `ExperimentStep` instance for each Process step and records its actual state, inputs, outputs, deviations and evidence.

## 1. Solutions

### Recipe definition

`Solvent mixture → Solutes → Optional additives → Concentration basis → Reference volume → Preparation instructions`

The solvent mixture must explicitly store:

- substance identity;
- mixture basis such as v/v, w/w, molar fraction or absolute quantity;
- target ratio;
- calculated target quantity;
- reference total volume or mass.

### Concrete batch

The physical batch stores:

- locked recipe version;
- physical material lots;
- target and actual quantities;
- operator and timestamps;
- atmosphere, temperature and stirring;
- filtration evidence;
- storage and remaining amount;
- deviations and observations.

## 2. Stacks and samples

A Stack Template is an ordered reusable layer definition. An Experiment Stack snapshots that definition and adds:

- concrete substrate;
- sample identifiers;
- layer source materials or solution batches;
- actual dimensions and thicknesses;
- deposition methods;
- variant parameters;
- deviations.

Simple variants may change one or more explicit parameters without introducing a full DOE subsystem.

## 3. Processing

A protocol is a reusable Lab Cabinet resource used by the Process. A processing run is concrete experiment evidence.

Each run records timestamps, operator, target stacks/samples, instrument use, actual parameters, inputs, outputs and deviations.

## 4. Data

Files and manually entered data must be associated with a clear target:

- whole experiment;
- Experiment Step;
- processing run or executed action;
- stack or sample;
- measurement;
- result.

Original files remain immutable evidence. Parsed and processed forms reference the original.

## 5. Analysis

Analysis begins from explicitly selected evidence. Results store source references, method/version, value or series, unit and validation state.

## 6. Charts and report

Saved visualisations retain selected records, axes, units, filters and source references. Reports assemble editable narrative from structured evidence.

## 7. Export

Export shows included and excluded records, warnings, package version, manifest and checksums before generating local output.

## 8. NOMAD

The Process provides the mapping profile; the Experiment provides concrete data. Readiness checks cover completeness, units, resources, stack structure, processing, instruments, files, identifiers and provenance.
