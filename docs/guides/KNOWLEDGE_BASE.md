---
title: Knowledge Base
section: Researcher guide
summary: Compact scientific reference knowledge, JSONL extensions and task-specific context views.
order: 45
---

# Knowledge Base

The Knowledge Base provides reusable scientific reference knowledge without turning long papers or documents into model context. It is deliberately structured and compact.

## Libraries

LabFlow combines:

- a built-in validated JSONL library;
- **My JSONL**, researcher-added entries stored locally.

The current built-in scientific library contains **109 focused entries** covering materials, architectures, formulations, processes and related reference knowledge. Generated documentation/help entries are separate from that scientific count.

## Entry design

Prefer small records with:

- stable `id` and `kind`;
- concise title/aliases/tags;
- short summary and focused facts/cautions where useful;
- structured `design_hint` for Design-compatible entries;
- a small number of high-quality sources;
- related IDs instead of repeated prose.

Long narrative text, duplicated citations and broad unfocused notes increase noise without improving retrieval.

## Two model-facing views

### Design view

Design receives only what helps candidate resolution: id, kind, title, essential aliases/tags and `design_hint`. **Sources, DOI, URLs and bibliographic citation text are not sent.** The deterministic resolver can still keep full local provenance.

### Assistant view

The Assistant may receive a compact summary/facts/cautions plus at most a few source records. When reference knowledge is used, it cites `[KB:<id>]` so the UI can show the stored sources.

## Retrieval

Use structured/domain matching before model inference. Exact IDs/names/aliases and compatible design domains are stronger than generic textual similarity. Send only top relevant candidates rather than the whole library.

## Scientific boundary

A KB record is reference knowledge. It must never be presented as evidence that the current experiment actually used that material, architecture or process unless ExperimentData itself supports that claim.

## Validation

JSONL imports and the bundled library must pass the KB schema/validator. Invalid or duplicate records should be rejected/diagnosed rather than silently normalized into a different scientific meaning.
