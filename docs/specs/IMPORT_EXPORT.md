---
title: Import and Export
section: Export and NOMAD
order: 10
summary: Immutable source import, LabFlow Data session semantics, and explicit portable exports.
---
# Import and Export

## Import

A laboratory ZIP is immutable source evidence. LabFlow retains its bytes and parses them into `ExperimentData`; no Action, patch, cleanup stage or UI edit rewrites the source ZIP. The application works on its own structured **LabFlow Data** representation.

A ZIP created by **Export ZIP** is detected as a LabFlow save and restores the serialized experiment plus the embedded original source ZIP when present.

## Session persistence

The browser autosaves the current LabFlow session. This is crash/reload convenience, not a second scientific copy or checkpoint. **Reset session** clears the persisted experiment state while provider/UI preferences remain separate.

## Export page

The Export page exposes three explicit artifacts:

1. **Export ZIP** — portable, re-importable LabFlow save containing current LabFlow Data, patch/provenance records and the original RAW ZIP byte-for-byte when available.
2. **Export NOMAD** — deterministic NOMAD entry YAML.
3. **Export NOMAD ZIP** — deterministic NOMAD staging package, optionally including RAW source and derived tables.

Export never mutates the source archive or scientific data. NOMAD readiness is deterministic and is not an AI Action.
