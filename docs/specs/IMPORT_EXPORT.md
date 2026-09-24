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


## NOMAD-first Export workspace (0.0.32)

The Export page prioritizes NOMAD readiness, blockers and package generation. NOMAD and Ready-PV detailed projections are closed inspection/edit drawers rather than always-visible field walls. Optional edits and accepted `export.prepare` suggestions are persisted as `projectionOverrides` and never mutate ExperimentData, Workspace, Process or Cabinet. See `docs/guides/EXPORT_PROJECTIONS.md`.

The primary Export surface includes a compact metadata priority card. Required NOMAD gaps are visually distinguished from recommended fields and from Ready-PV questionnaire gaps, while detailed projection values stay inside closed drawers.

## Export privacy boundary

Exports are classified by purpose, and redaction follows that purpose:

- **Backups** (LabFlow ZIP, Cabinet JSON, custom Knowledge Base JSONL) keep original content so a workspace can be restored. Credentials are absent because they already live outside scientific payloads.
- **Shareable projections** (Ready-PV JSON/text, NOMAD projection/entry, data-management profile) can enable **Privacy-safe projections** in Export → Package options. Declared personal fields (contact name/email), contact notes and free-text remarks become `[redacted]`; measurement, material, process, readiness and provenance values are preserved.
- **Diagnostics** (JSONL log export and the diagnostic bundle from Settings → Diagnostics) are privacy-safe by default. Prompts, provider responses and free-text fields are removed; timing, HTTP status, provider/model, scope, event name and correlation identifiers are retained.

The option is persisted as `redactPersonal` inside `labflow.export.settings` (default `false`, so existing installations keep their current Ready-PV behavior, where the contact person is a required submission field). Logging, diagnostics and projection redaction all use the shared `LF.Redact` utility (`assets/js/redact.js`).
