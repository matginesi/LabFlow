# LabFlow internal Tool contract

LabFlow separates **Actions** from **Tools**.

- An **Action** is a researcher-understandable goal/workflow.
- A **Tool** is one small, typed capability over the current Canonical LabFlow Data Model.
- An Action may use multiple Tools plus AI checkpoints.
- The Assistant may see only explicitly allowlisted **read-only** Tools.

## Canonical boundary

All Tool calls operate on the one current `LF.State.state.experiment` through `LF.CanonicalStore`. The Canonical Store is a deterministic view/index over the Working Copy, not a second editable state.

Internal canonical v2 domains are:

```text
experiment
source
entities
  files
  samples
  measurements
scientific
  design
  results
  findings
documents
  lab
  paper
evidence
relations
aliases
provenance
```

The store retains compatibility aliases used by existing POC pages while new Tools should prefer the grouped domains.

## Tool classes

### Read tools exposed to the Assistant

- `experiment.summary`
- `samples.list`
- `sample.get`
- `measurements.query`
- `results.get`
- `findings.list`
- `design.get`
- `document.get`
- `figures.list`
- `evidence.search`
- `provenance.list`
- `nomad.get`

These Tools must not mutate the Working Copy.

### Internal service tools

Deterministic Action checkpoints are registered through the same Tool Registry but are not agent-visible. Examples include `dataset.analyze`, `dataset.apply-safe-fixes`, `report.store-edit-blocks` and `nomad.validate`.

This keeps one capability boundary without pretending that low-level implementation services are researcher-facing Actions.

## Assistant safety contract

The Assistant uses a bounded read-tool loop:

1. receive a small bootstrap context;
2. select at most one allowlisted read Tool per round;
3. LabFlow validates the Tool ID, read/write policy and typed JSON arguments, then executes it locally;
4. repeat for at most the configured round cap;
5. produce the final answer from the retrieved observations.

The Assistant cannot:

- call write Tools;
- invoke mutating Actions;
- edit Report/Paper;
- apply dataset patches;
- alter Design;
- decide NOMAD readiness.

Any attempted non-read Tool invocation is rejected by `LF.ToolRegistry.execute(..., {agent:true})`. Missing required arguments, wrong primitive types and invalid enum values fail before the handler executes.

## Why this exists

The Tool boundary prepares the POC for a later Python backend and more autonomous agent without making the current JavaScript POC depend on an autonomous loop. Actions remain explicit and testable; agentic behavior is currently limited to read-only evidence retrieval in the Assistant.
