---
title: Design completion and provenance
section: Researcher guide
summary: Deterministic-first Design completion, evidence hierarchy, compact KB candidates and review semantics.
order: 50
---

# Design completion and provenance

Design completion is a reference-resolution workflow with an optional model fallback, not a free-form generation task.


## What the Design page actually does

**Complete design** is a gap-filling operation for the currently selected experiment variant. It does not redesign the experiment and it does not overwrite fields that already contain researcher/imported evidence.

The page shows three domains separately: **Solution chemistry**, **Device stack** and **Fabrication process**. For each domain LabFlow marks the current state as Ready, Proposed or Missing. Running completion creates a proposal only for missing information. The proposal is never written into the experiment until the researcher chooses **Accept experiment**; **Discard** leaves the current Design untouched, and accepted values remain editable afterward.

The provider step is conditional. If Experiment + Cabinet + KB references cover all missing domains, the same Complete design button finishes with **zero model calls**. If a provider is needed, only the unresolved domains and compact candidate hints are sent.

## Resolution order

For each missing Design domain LabFlow uses:

```text
current experiment evidence
 → compatible Lab Cabinet candidate
 → compatible Knowledge Base candidate
 → optional model inference
 → unresolved
```

The first three stages are deterministic. Model inference is created only for domains still unresolved after reference matching.

## Zero-call completion

If Cabinet/KB/reference evidence covers every pending domain, `design.infer` creates no model work unit. The resulting proposal remains reviewable and carries its source basis.

## Compact model context

When a provider is required, it receives:

- selected device/experiment identity;
- only the missing domains;
- bounded current experiment evidence;
- compact Cabinet candidates;
- compact KB candidate hints.

Design KB candidates intentionally omit bibliography, DOI, URL and citation text. Those fields are unnecessary for the classification/completion task and waste small-model context.

## Merge rule

Deterministic/reference-backed values win. Model output may only fill still-missing fields; it must not overwrite a stronger resolved value. Accepted values remain editable.

## Precision

Do not infer exact concentration, thickness, temperature, time or similar process precision unless supported by explicit evidence/reference data. A qualitative candidate or `unknown` is preferable to invented precision.

## Confidence

Confidence describes suitability of the proposed candidate under the available evidence, not the probability that history actually occurred that way. Source type matters: current experiment evidence is stronger than explicit Cabinet reuse, which is stronger than reference KB compatibility, which is stronger than model-only inference.

## Known unknowns

Unresolved domains are valid outcomes. The UI should make them visible rather than coercing every Design into a fully populated record.

## Validation and review

Provider output is parsed/validated before proposal storage. Current Design completion does not automatically loop through semantic retries. Review happens in Design Experiment; accepting a proposal updates allowed Design state while preserving provenance/source distinctions.
