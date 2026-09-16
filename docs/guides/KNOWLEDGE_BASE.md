---
title: Knowledge Base
section: Researcher guide
summary: Bundled and custom JSONL reference knowledge for bounded, traceable AI context.
order: 37
---

# Knowledge Base

The Knowledge Base provides curated reference knowledge to Assistant/Actions without introducing another database.

## Storage model

```mermaid
flowchart TD
    B[Bundled knowledge/kb.jsonl: read-only baseline] --> A[Validated active entries]
    C[Browser-local custom JSONL: editable overlay] --> A
    A --> R[Bounded deterministic retrieval]
```

Custom entries can be exported/imported as JSONL. This keeps the data human-readable, versionable and easy to validate.

## Entry semantics

A KB entry can contain identity/type, title/aliases/tags, summary, facts, cautions, related IDs and source records. Validation rejects malformed records before they become active context.

## Authority boundary

KB content is reference knowledge, not evidence from the current experiment. If KB/reference knowledge conflicts with current source evidence or accepted LabFlow Data, experiment evidence wins.

When an Assistant answer relies on a retrieved KB entry, the model is instructed to append `[KB:<id>]`. The UI resolves that marker to stored source metadata. The model must not invent an ID, DOI, URL or citation.

`design.infer` also uses the KB directly. Retrieval is targeted independently for missing `solutions`, `stack` and `process` domains so small local models receive a short relevant subset instead of the whole library. A Design item based on KB content is marked `knowledge_reference` and carries an exact `KB:<id>` in its evidence. These values are review-only and are never treated as proof that the current experiment used that material, architecture or process.

## Editing safely

Prefer small factual entries with explicit cautions and source records. Avoid embedding transient UI instructions or experiment-specific claims in the KB; those belong in current scientific state/context instead.
