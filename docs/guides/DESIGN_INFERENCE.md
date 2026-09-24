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

The provider step is conditional. If Lab Cabinet and Knowledge Base candidates already cover every missing domain, the same Complete design button finishes with **zero model calls** and creates no model work unit, and the resulting proposal stays reviewable with its source basis. If a provider is needed, only the unresolved domains and compact candidate hints are sent.

## Resolution order

For each missing Design domain LabFlow uses:

```text
experiment evidence already imported (authoritative basis, never overwritten)
 → compatible Lab Cabinet candidate
 → compatible Knowledge Base candidate
 → optional model inference
 → unresolved
```

The first line is the basis, not a gap filler: what the import already recovered is part of the current Design, and it is supplied to the model as the strongest evidence. Only the Cabinet and KB stages are deterministic gap fillers, and a compatible Cabinet resource is preferred over a generic Knowledge Base hint. Model inference is created only for domains still unresolved after reference matching.

## What counts as resolved

A candidate counts only when it is useful and verifiable:

- **solutions** need at least solutes or solvents;
- **stack** needs at least three layers including an absorber, a boundary/electrode and a transport layer;
- **process** needs at least one of coating, annealing, atmosphere or notes.

If a required domain still has no useful candidate, its partial content is discarded and the domain is recorded as an unresolved known unknown. A `CABINET:<id>` or `KB:<id>` claim that does not resolve to a stored item is downgraded to plain model inference, so an invented citation cannot masquerade as a verified reference.

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

Do not infer exact concentration, thickness, temperature, time or similar process precision unless the current experiment evidence explicitly contains it. A Cabinet recipe or Knowledge Base hint may carry an evidenced value, but reference-backed fields are never applied automatically and a quantitative value without experiment support is confidence-capped for review. A qualitative candidate or `unknown` is preferable to invented precision.

## Automatic and explicit application

Field decisions are source-aware. A bulk apply fills only fields that pass the automatic rule: qualitative model candidates above the confidence threshold, and quantitative/experiment-backed values. Cabinet- and KB-backed fields are always review items on that path. The explicit **Accept experiment** / **Accept all** actions apply the reviewed proposal through the researcher decision, and never overwrite fields that already contain researcher or imported values.

## Confidence

Confidence describes suitability of the proposed candidate under the available evidence, not the probability that history actually occurred that way. Source type matters: current experiment evidence is stronger than explicit Cabinet reuse, which is stronger than reference KB compatibility, which is stronger than model-only inference.

## Known unknowns

Unresolved domains are valid outcomes. The UI should make them visible rather than coercing every Design into a fully populated record.

## Validation and review

Provider output is parsed/validated before proposal storage. Current Design completion does not automatically loop through semantic retries. Review happens in Design Experiment; accepting a proposal updates allowed Design state while preserving provenance/source distinctions.
