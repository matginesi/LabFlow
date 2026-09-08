---
title: Data model contract
section: Core architecture
summary: Canonical ExperimentData hierarchy, record schemas, ownership, persistence and invariants.
order: 10
---

# Data model contract

## 1. Single aggregate root

`ExperimentData` is the only mutable scientific aggregate. JSON is a serialization format, not the internal API.

```text
ExperimentData
├─ source evidence
├─ LabFlow Data records
├─ deterministic analysis
├─ Design
├─ patches/findings
├─ ActionData
├─ interaction history
└─ runtime projections
```

The canonical shape comes only from `DomainSchema`.

## 2. Scientific hierarchy

```text
Experiment / condition
└─ Sample / cell
   └─ Run / acquisition session
      └─ Measurement / repeated JV acquisition
         ├─ FW scan
         └─ RV scan
```

For `TEST_DATA/2026_01_22.zip` the regression contract is:

```text
5 experiments → 31 samples → 42 runs → 72 measurements
```

## 3. Registered record kinds

`DomainSchema` currently registers:

- `file`
- `manifest_entry`
- `format_evidence`
- `auxiliary_evidence`
- `experiment`
- `sample`
- `run`
- `measurement`
- `finding`
- `block`
- `patch`
- `design_solution`
- `design_layer`
- `design_device`

Use `DomainSchema.create(kind, seed)` / `normalize(kind, record)`. For top-level record kinds, `ExperimentData.addRecord(kind, seed)` stores the normalized record in the root declared by `DomainSchema.rootForRecordKind(kind)`.

Nested Design records remain owned by `DesignModel` rather than being inserted as independent roots.

## 4. Measurement semantics

A `measurement` is one repeated JV acquisition/source file within a run. FW and RV are paired scan directions of that measurement.

A scan may contain:
- Voc (V)
- Jsc (mA/cm²)
- Vmpp (V)
- Jmpp (mA/cm²)
- Pmpp (mW/cm²)
- Rs (Ω)
- Rsh (Ω)
- FF (%)
- Efficiency/PCE (%)

Missing numeric data remains `null`; missing values are never normalized to zero.

Curve points live under `measurement.curve.fw[]` / `measurement.curve.rv[]`.

## 5. Relations

Relations are ID-first and bidirectional where appropriate:

- experiment → `sampleIds`, `runIds`, `measurementIds`
- sample → `experimentId`, `runIds`, `measurementIds`
- run → `experimentId`, `sampleId`, `measurementIds`
- measurement → `experimentId`, `sampleId`, `runId`
- Design device → `experimentId`, `sampleIds`, `solutionIds`

Names (`experiment`, `sample`, `group`, `sampleNames`) are labels/caches and do not replace stable IDs.

Blocks use generic typed refs:

```js
refs: [
  { kind: 'sample', id: 'sample_...' },
  { kind: 'measurement', id: 'm_...' }
]
```

Do not add a parallel `entities[]` collection.

## 6. Patch/provenance contract

`patches[]` is the persistent provenance of LabFlow Data changes. Every patch has one typed target and one operation (`set`, `add`, `remove`).

An exact `measurement` target is measurement-scoped; it must not expand to sibling measurements of the same sample.

RAW bytes and original source records are never rewritten.

## 7. ActionData contract

Action outputs use one root:

```js
actionData: {
  proposals: { '<action.id>': ... },
  annotations: { '<action.id>': ... },
  status: { '<action.id>': ... }
}
```

`LF.ActionData` is the only API for this state. Action IDs are literal keys and may contain dots; code must not interpret them as property paths.

ActionData is persisted because proposals/status must survive a browser reload, but it is not scientific source truth.

## 8. Root ownership and persistence

Inspect the authoritative table at runtime:

```js
LabFlow.Data.ownership()
```

Runtime caches such as pipeline trace, canonical index, review dossier, Design analysis and Experiment Brief are excluded from persisted snapshots and are rebuilt.

## 9. Validation invariants

`DataContracts.validate(exp)` checks:

- required fields and `kind`;
- unique record IDs;
- valid relation targets;
- parent/child backlinks;
- parent consistency between measurement/run/sample/experiment;
- typed block refs;
- typed patch targets;
- Design references;
- the single ActionData boundary.

Structural failure is `DATA_CONTRACT_INVALID` and pipeline execution fails closed.

## 10. Public domain API

Preferred queries:

```js
exp.experiment(ref)
exp.sample(ref)
exp.run(ref)
exp.measurement(ref)
exp.selectSamples(query)
exp.selectMeasurements(query)
exp.measurementsForSample(ref)
exp.measurementsForExperiment(ref)
exp.bestMeasurementForSample(ref)
exp.inspect(ref)
exp.tree()
```

Preferred mutations:

```js
exp.addRecord(kind, seed)
exp.addPatch(...)
exp.applyPatch(...)
exp.setMismatchFactor(...)
exp.reanalyze()
```

Do not mutate root arrays directly from UI code when an owning service/API exists.
