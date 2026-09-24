---
title: Architecture
section: Engineering reference
summary: Deterministic-first ownership, data flow and optional AI boundary.
order: 10
---

# Architecture

LabFlow is a local-first static browser application. Vanilla JavaScript owns the scientific model, import pipeline, analysis, review state, Design proposals, export projections and UI. There is no application backend and no in-browser model runtime.

## Product model

```text
User → Workspace → Process → ExperimentData
                              ├─ experiments
                              ├─ samples
                              ├─ runs
                              ├─ measurements
                              ├─ findings
                              └─ design
```

`ExperimentData` is the canonical mutable scientific aggregate. RAW files remain evidence. Workspace, Process, Cabinet and Knowledge Base provide reusable context/reference data and must not be confused with measured evidence.

## Authority order

1. RAW archive evidence
2. canonical ExperimentData
3. deterministic normalization, validation and analysis
4. explicit Workspace / Process / Cabinet / Knowledge Base references
5. optional model suggestion for unresolved semantics
6. researcher acceptance where scientific state may change

The model never owns parsing, arithmetic, ranking, validation, export mapping or canonical mutation.

## Deterministic pipeline

```text
ZIP
 → inspect
 → parse
 → canonicalize identities and links
 → validate
 → analyze
 → findings / safe cleanup
 → Results / Design / Export
```

The pipeline remains useful with no provider configured.

## Actions are application operations

An Action is a typed unit of LabFlow behavior, not a synonym for an LLM call.

```text
Action
 → validate prerequisites
 → deterministic work
 → unresolved semantics?
      no  → validate/store/result
      yes → compact provider request → deterministic validation → proposal
```

Current modes:

- deterministic: `results.interpret`, `results.compare`, `export.prepare`
- hybrid: `dataset.resolve-ambiguities`, `design.infer`
- tiny language-agnostic Assistant intent router plus bounded read-only answer fallback: `assistant.chat`

Contracts, schemas, guards and allowed writes stay application-side. They are used by runtime/tests/UI and are not pasted into prompts.

## Small-model boundary

A provider receives only the residue that code could not resolve. Context builders select the current target, compact evidence and small candidate lists. Output is bounded and validated before use. Current provider-backed scientific Actions do not use semantic retry loops.

This architecture supports small models without adding WebGPU, wllama, Transformers.js or model storage to the browser application.

## Reference stores

### Cabinet

Researcher-owned reusable laboratory resources. Saving to an experiment copies the relevant value/provenance; past experiments are not live-linked to later Cabinet edits.

### Knowledge Base

Scientific reference knowledge stored as compact JSONL. The full record keeps source metadata. Model-facing views are task-specific:

- Design: structured, bibliography-free candidates and design hints
- Assistant: compact facts plus source metadata when reference knowledge is useful

## Derived state and invalidation

Derived analysis, summaries, experiment briefs and Action annotations are disposable. Scientific mutations invalidate dependent derived state through the derived-state registry. Accepted proposals must preserve source/provenance distinctions.

## Export boundary

NOMAD and Ready-PV are projections of canonical LabFlow data. Mapping/readiness/package generation are deterministic. Projection overrides are export-only and never rewrite canonical scientific truth.

## UI boundary

Pages compose shared primitives. Long-running Actions use one Action Totem. The normal Totem view exposes meaningful progress and throughput; implementation diagnostics remain under **Technical data**.
