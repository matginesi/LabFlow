---
title: Export projections
section: Researcher guide
summary: Deterministic NOMAD/Ready-PV mapping, metadata preparation and export-only overrides.
order: 60
---

# Export projections

Export is deterministic and NOMAD-first. Ready-PV remains a secondary projection of the same canonical LabFlow data.

## Source truth

ExperimentData, Workspace, Process and Cabinet remain authoritative in their own domains. Export views are projections. Manual edits and accepted preparation suggestions create **export-only overrides** and never rewrite canonical scientific state.

## Readiness

The Export page shows required/recommended metadata gaps before detailed projection tables. Blocking problems link back to the most appropriate source surface when possible.

## Prepare missing metadata

`export.prepare` is deterministic. It inspects currently missing projection fields and reuses only conservative equivalents already present in LabFlow (for example an explicitly populated equivalent institution field). It does not query a model and does not invent values.

The result contains:

- evidence-backed export-only suggestions;
- unresolved fields that still require researcher input;
- a compact summary.

Applying a suggestion creates an export override only. Discarding it leaves the projection unchanged.

## Detailed mappings

NOMAD and Ready-PV mapping tables expose source status and allow explicit overrides. Detailed projections stay secondary to the readiness workflow so researchers can focus on actual blockers first.

## Packages

Local package generation uses the current canonical data plus explicit export options/overrides. Direct browser upload is a separate connector boundary; where the UI exposes a future upload target, the current stub must not transmit data or tokens.

## Assistant

The Assistant may recommend `/prepare-export` when that Action is available, but the Action itself remains deterministic.
