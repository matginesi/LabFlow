---
title: NOMAD integration
section: Interoperability
summary: Deterministic current-state mapping, validation and export as a local service.
order: 50
---

# NOMAD integration

NOMAD support is a deterministic interoperability service, not an AI Action.

```text
validated ExperimentData
  ↓
Canonical Store / deterministic Results / Design
  ↓
NOMAD buildMapping
  ↓
local validation
  ↓
staging package/export
```

The UI controls **Refresh mapping** and **Rebuild mapping + validate** call deterministic local NOMAD services directly; NOMAD preparation is not an Action.

The generated staging package follows NOMAD's external YAML schema pattern: the entry points to the named `LabFlowExperiment` section in `labflow_schema.archive.yaml`, and that top-level section inherits `nomad.datamodel.data.EntryData`.

Readiness is actionable rather than a dead-end validator:

- optional package blockers (missing RAW or derived payload) can be resolved by disabling that optional payload;
- deterministic metadata/mapping problems route to the owning LabFlow page or a safe local repair;
- genuinely semantic ambiguity may invoke an existing domain Action such as `dataset.resolve-ambiguities`;
- NOMAD package generation itself remains deterministic and is never delegated to AI.

Rules:

- the mapping never mutates RAW;
- missing semantics remain explicit rather than model-filled;
- stale mapping is invalidated by relevant LabFlow Data changes;
- derived analysis exported to NOMAD comes from the deterministic pipeline;
- Design values retain source/researcher/AI provenance and accepted status.

NOMAD compatibility should shape identifiers, units, provenance and machine-readable structure without dictating the researcher-facing data model.
