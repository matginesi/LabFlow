---
title: Laboratory source format
section: Scientific data
summary: Observed ZIP/file structure and parser assumptions for the current laboratory data family.
order: 30
---

# Laboratory source format

Current archives commonly contain one root folder, summary tables, sample/device directories and per-run JV/Parameters/Tracking text files. LabFlow does not require perfect conformance: unknown files remain in the source manifest and missing summaries can fall back to individual-file evidence.

Observed text data is tab-separated with section markers such as `[General info]`, `[JV Settings]`, `[Cell Settings]` and `## Data ##`.

Unit labels may contain encoding damage. Deterministic parsing should prefer configured field names/positions and numeric semantics rather than depending on one rendered Unicode glyph.

Operational rules live in the parser policy sources under `prompts/policies/`; this document describes the observed family and must not become a competing parser rule set.
