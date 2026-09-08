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

Rules:

- the mapping never mutates RAW;
- missing semantics remain explicit rather than model-filled;
- stale mapping is invalidated by relevant LabFlow Data changes;
- derived analysis exported to NOMAD comes from the deterministic pipeline;
- Design values retain source/researcher/AI provenance and accepted status.

NOMAD compatibility should shape identifiers, units, provenance and machine-readable structure without dictating the researcher-facing data model.
