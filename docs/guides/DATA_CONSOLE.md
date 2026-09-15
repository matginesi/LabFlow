---
title: Data Console
section: Engineering reference
summary: Inspect the live aggregate, ownership, structures, pipeline and safe mutation APIs from DevTools.
order: 40
---

# Data Console

`LabFlow.Data` is an introspection facade over the same live `ExperimentData` used by the UI. It is not a debug copy.

Useful entry points:

```js
LabFlow.Data.help()
LabFlow.Data.summary()
LabFlow.Data.tree()
LabFlow.Data.validate()
LabFlow.Data.schema()
LabFlow.Data.ownership()
LabFlow.Data.pipeline()
LabFlow.Data.derived()
LabFlow.Data.actions()
LabFlow.Data.structures()
LabFlow.Data.contracts()
```

## Queries

```js
LabFlow.Data.experiments()
LabFlow.Data.samples({ experiment: 'N3' })
LabFlow.Data.runs({ sample: 'N3_1_1A' })
LabFlow.Data.measurements({ sample: 'N3_1_1A' })
LabFlow.Data.best('N3_1_1A')
LabFlow.Data.inspect('N3_1_1A')
```

## Safe mutation

Use owner/model APIs exposed by the facade when changing scientific state. Direct array assignment from DevTools bypasses revision, provenance and invalidation rules and is useful only for deliberately destructive debugging.

Action output remains separate:

```js
LabFlow.ActionData.proposal(exp, 'design.infer', '<target-id>')
LabFlow.ActionData.annotation(exp, 'results.interpret')
LabFlow.ActionData.status(exp, 'design.infer', '<target-id>')
```

`structures()` is descriptive cross-module metadata; `ownership()` is the authoritative aggregate-root ownership view.
