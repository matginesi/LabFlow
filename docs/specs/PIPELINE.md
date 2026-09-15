---
title: Deterministic data pipeline
section: Operating model
summary: Declarative lifecycle from imported archive to validated, researcher-ready LabFlow Data.
order: 15
---

# Deterministic data pipeline

`DataPipeline` owns deterministic construction and refresh. It never calls an AI provider and never waits for provider availability.

## Stage contract

A stage declares identity, phase, dependencies, reads, writes and one `run` function:

```js
LabFlow.DataPipeline.register({
  id: 'my-stage',
  phase: 'derive',
  after: ['previous-stage'],
  reads: ['measurements'],
  writes: ['myProjection'],
  description: 'Build the projection from validated measurements.',
  run(exp, ctx) { /* deterministic work */ }
})
```

Dependencies produce one logical execution plan. Missing dependencies and cycles are contract errors. `reads`/`writes` are architectural declarations and must match actual behavior.

## Current plan

1. `normalize` — canonical hydration/shape normalization.
2. `link` — rebuild acquisition hierarchy links/backlinks.
3. `validate-structure` — fail closed before dependent analysis.
4. `analyze` — deterministic JV metrics, ranking and findings.
5. `index` — rebuild pure CanonicalStore read indexes/evidence.
6. `review` — build deterministic review dossier and semantic ambiguities.
7. `auto-cleanup` — detect mechanically provable fixes; do not silently apply newly detected fixes.
8. `project-design` — project source evidence into Design without overwriting researcher-owned values.
9. `summarize` — build deterministic summaries/brief.
10. `validate-final` — assert the final graph/Design contract.

## Restart semantics

A stage does not call downstream stages. If an accepted deterministic mutation changes upstream state, the pipeline may return a bounded restart request:

```js
{ restartFrom: 'link' }
```

The runner records actual executions separately from the logical plan.

## Idempotence

Refreshing unchanged data must not accumulate findings, patches, duplicate links or modified identifiers. Idempotence is a release invariant, not an optimization.

## Stage versus service versus Action

Add a pipeline stage only when the work is deterministic, belongs to normal refresh, has explicit read/write ownership and should run without user/provider availability.

A reusable helper that does not belong in every lifecycle is a service/tool. A researcher request producing a proposal/interpretation/answer is an Action.
