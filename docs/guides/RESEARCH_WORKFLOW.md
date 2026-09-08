---
title: Research workflow
section: Researcher guide
summary: Understand what each LabFlow step owns, what it produces, and where researcher review is required.
order: 3
---

# Research workflow

The workflow is intentionally linear and uses one shared experiment state.

| Step | Researcher goal | Authoritative owner | AI role |
|---|---|---|---|
| Upload & Review | Inspect source evidence and corrections | LabFlow Data + deterministic findings | optional semantic enrichment / ambiguity proposals |
| Results | Evaluate measurements and rankings | deterministic analysis | optional interpretation only |
| Design | Complete solution chemistry, device architecture and fabrication process | researcher-confirmed Design | suggestions for missing fields |
| NOMAD | Validate and package experiment metadata | deterministic Canonical → NOMAD mapping | explanation only, never readiness |

## One state, several projections

```mermaid
flowchart TD
  SOURCE[Immutable source] --> COPY[LabFlow Data]
  COPY --> CANONICAL[Canonical Store]
  CANONICAL --> REVIEW[Review]
  CANONICAL --> RESULTS[Results]
  CANONICAL --> DESIGN[Design]
  CANONICAL --> NOMAD[NOMAD]
```

Pages do not own separate scientific copies. A reviewed change to the LabFlow Data is therefore visible wherever that field matters.

## Upload & Review

The first step establishes provenance and current data quality. Import is deterministic-first and remains usable without AI.

Review distinguishes safe deterministic corrections from ambiguous interpretations. Apply only changes whose evidence and target you understand.

## Results

Results reuse deterministic calculations from the current revision. Filters and charts change the view, not the underlying measurements. AI interpretation is read-only prose layered over these values.

## Design

Design is directly editable. AI suggestions are optional proposals and never silently overwrite known fields.

Bulk suggestion is sequential/bounded. A provider throttle stops the sequence immediately and preserves completed proposals instead of converting every remaining experiment into an error.

## NOMAD

The current Canonical Store is mapped deterministically to NOMAD. Required missing mappings block readiness. Changes to relevant scientific data invalidate stale staging.

## Save, autosave and export

**Autosave** provides browser recovery through IndexedDB. **Save** marks an explicit checkpoint revision. **Export ZIP** creates a durable LabFlow package.

Derived PDF/DOCX/NOMAD exports do not overwrite the source ZIP and do not silently mark later LabFlow Data edits saved.
