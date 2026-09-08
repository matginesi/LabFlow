---
title: Deterministic data pipeline
section: Operating model
summary: Declarative deterministic lifecycle from imported ZIP to a validated researcher-ready LabFlow Data.
order: 15
---

# Deterministic data pipeline

## Contract

`DataPipeline` owns deterministic construction and refresh of scientific state. It never calls an AI provider.

Each stage is registered as:

```js
LabFlow.DataPipeline.register({
  id: 'my-stage',
  phase: 'derive',
  after: ['previous-stage'],
  reads: ['measurements'],
  writes: ['myProjection'],
  description: '...',
  run(exp, ctx) { ... }
})
```

The registry derives execution order from dependencies and rejects missing dependencies/cycles. `reads`/`writes` are declarative ownership documentation and must match real behavior.

## Current logical plan

1. `normalize` — hydrate through `DomainSchema`.
2. `link` — rebuild Experiment → Sample → Run → Measurement links/backlinks.
3. `validate-structure` — fail closed before scientific calculations.
4. `analyze` — deterministic JV metrics, ranking and findings.
5. `index` — build pure CanonicalStore read indexes/evidence.
6. `review` — produce deterministic review dossier and semantic ambiguities.
7. `auto-cleanup` — apply only mechanically provable LabFlow Data fixes with patches.
8. `project-design` — project source evidence into Design without overwriting researcher values.
9. `summarize` — build deterministic statistics and Experiment Brief.
10. `validate-final` — validate the completed domain/Design graph.

## Restart contract

A stage must not call downstream stages itself. If it changes upstream state, it may return:

```js
{ restartFrom: 'link' }
```

The pipeline restarts from that stage with a bounded restart count. `auto-cleanup` uses this contract after safe fixes.

## Plan vs execution trace

`DataPipeline.stages()` returns the unique logical plan. `exp.pipeline.executions` records actual executions, including bounded restarts and timing. These are intentionally different concepts.

## Idempotence

Repeated refresh on an unchanged LabFlow Data must not accumulate findings/patches or alter hierarchy. The real JV fixture must remain:

```text
5 → 31 → 42 → 72
```

through repeated refreshes.

## Mutation boundary

Pipeline stages may write only their declared/owned output. Safe cleanup changes LabFlow Data via the patch/provenance mechanism. Runtime caches are recomputable and not persisted.

## When to add a stage

Add a pipeline stage only when the transformation:
- is deterministic;
- belongs in the normal lifecycle after relevant mutations;
- has clear read/write ownership;
- should run without researcher/provider availability.

A researcher decision, interpretation or proposal belongs in an Action instead. A local helper used by one feature remains a service/tool, not automatically a stage.
