---
title: Import and export
section: Export and NOMAD
summary: Trust boundaries for RAW archive import, LabFlow snapshots and deterministic export packages.
order: 20
---

# Import and export

## RAW archive import

The importer reads the supplied ZIP once, preserves source bytes/path identity, classifies known files, parses configured evidence, constructs canonical domain records and then hands the aggregate to the deterministic pipeline.

Unknown files remain represented as source evidence rather than being silently discarded. Duplicate basenames are disambiguated by full archive path.

## LabFlow snapshots

A LabFlow snapshot is a persistent representation of current scientific state, not a replacement for the RAW archive. Serialization is schema-driven. Restore is a trust boundary and validates the current snapshot contract before hydration.

The POC does not maintain a compatibility ladder for obsolete snapshot shapes. Incompatible snapshots fail explicitly.

## Export package

Export reads validated current LabFlow Data and builds a deterministic external package. Export generation may include the pristine RAW archive and selected derived payloads, but does not mutate scientific state.

## NOMAD

NOMAD mapping/package preparation is another deterministic export projection. See `../NOMAD.md`. The current upload control is a non-networking stub.


## Export projection workbench (0.0.23)

The Export page exposes two deterministic human-readable projections: NOMAD and Ready-PV. Both are derived from canonical LabFlow data. Optional edits are persisted as `projectionOverrides` in export preferences and never mutate ExperimentData, Workspace, Process or Cabinet. NOMAD overrides participate in the generated mapping/YAML; Ready-PV overrides participate in Ready-PV JSON/plain-text answers. See `docs/guides/EXPORT_PROJECTIONS.md`.
