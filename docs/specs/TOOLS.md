---
title: Tools and internal services
section: AI and Actions
summary: Defines stable read tools and internal Action-step tools; tools are implementation capabilities, not user-facing Actions.
order: 30
---

# Tools and internal services

## Read tools

Read tools query the current canonical `ExperimentData`/indexes and may be used by the Assistant or internal code. Agent mode may invoke read-only tools but is prevented from invoking write tools.

The exact catalog is available at runtime through `LabFlow.ToolRegistry`.

## Current internal Action-step tools

These IDs support the current Action manifests:

```text
dataset.collect-ambiguities      read
dataset.store-corrections        write

design.collect-selected          read
design.validate-coverage         read
design.store-proposal            write

results.validate-comparison      read
results.store-interpretation     write
results.store-comparison         write
```

They are **not** separate Actions and should not appear as researcher workflow buttons.

## Deterministic data services

Naming normalization, safe cleanup, hierarchy rebuild, JV analysis, canonical indexing, review analysis, Design projection and NOMAD preparation are local services/pipeline logic. They should not be wrapped in fake Actions merely to make them callable.

## Extension

Action-step tools register beside their implementation through `ActionStepRegistry`, which also exposes them to `ToolRegistry` with explicit read/write metadata. Action execution resolves deterministic checkpoints through `ToolRegistry`; agent mode can invoke only tools explicitly marked read-only and agent-visible.
