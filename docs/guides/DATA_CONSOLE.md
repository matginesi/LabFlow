---
title: Data Console
section: Developer guides
summary: Inspect the live ExperimentData aggregate, schema, pipeline, Actions and safe mutation APIs from DevTools.
order: 30
---

# Data Console

`LabFlow.Data` is a developer/research-debug facade over the same live `ExperimentData` used by the application. It is not a duplicate debug model.

Start with:

```js
LabFlow.Data.help()
LabFlow.Data.summary()
LabFlow.Data.tree()
```

## Domain queries

```js
LabFlow.Data.experiments()
LabFlow.Data.samples({ experiment: 'N3' })
LabFlow.Data.runs({ sample: 'N3_1_1A' })
LabFlow.Data.measurements({ sample: 'N3_1_1A' })
LabFlow.Data.experiment('N3')
LabFlow.Data.sample('N3_1_1A')
LabFlow.Data.measurement('...')
LabFlow.Data.best('N3_1_1A')
LabFlow.Data.inspect('N3_1_1A')
```

## Contracts and architecture introspection

```js
LabFlow.Data.validate()
LabFlow.Data.schema()
LabFlow.Data.ownership()
LabFlow.Data.pipeline()
LabFlow.Data.derived()
LabFlow.Data.actions()
LabFlow.Data.actionData('design.infer', '<device-id>')
LabFlow.Data.contracts()
```

`ownership()` is the authoritative root-field owner/layer/persistence table. `pipeline()` exposes logical plan separately from last execution trace.

## Record documentation

```js
LabFlow.Data.types()
LabFlow.Data.describe('measurement')
LabFlow.Data.help('measurement')
```

## Safe mutations

```js
LabFlow.Data.setMismatchFactor(1.02)
LabFlow.Data.patch({
  target: { kind: 'block', id: 'block_...' },
  operation: 'set',
  field: 'data.rows.0.voc',
  to: 1.12,
  reason: 'manual correction'
})
LabFlow.Data.reanalyze()
```

Do not mutate arrays directly from the console if you want revision/invalidation/provenance to remain correct.

## Direct aggregate access

For deeper debugging:

```js
const exp = LabFlow.Data.current()
exp instanceof LabFlow.ExperimentData
exp.measurementsForExperiment('N3')
exp.bestMeasurementForSample('N3_1_1A')
```

Action output is intentionally separate from scientific records:

```js
LabFlow.ActionData.proposal(exp, 'design.infer', '<design-device-id>')
LabFlow.ActionData.annotation(exp, 'results.interpret')
LabFlow.ActionData.status(exp, 'design.infer', '<design-device-id>')
```
