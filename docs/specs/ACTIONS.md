---
title: Actions
section: Engineering specification
summary: Typed application operations with deterministic, hybrid and provider-backed execution modes.
order: 20
---

# Actions

An Action is the unit of explicit LabFlow behavior. It is **not** synonymous with an AI request.

## Current Actions

| Action | Purpose | Mode |
|---|---|---|
| `results.interpret` | summarize calculated Results | deterministic |
| `results.compare` | describe selected group differences | deterministic |
| `export.prepare` | reuse safe existing values for missing export metadata | deterministic |
| `dataset.resolve-ambiguities` | propose resolutions for unresolved semantic findings | hybrid |
| `design.infer` | complete unresolved Design domains | hybrid |
| `assistant.chat` | answer routed interpretive questions | ai; internal visibility (read-only effect); factual routed answers stay outside the Action |

The generated runtime matrix is the authority for current guards, steps and numeric budgets. Only public Actions appear in the researcher-facing catalog; `assistant.chat` is internal and is invoked by the Assistant runtime.

## Manifest responsibility

`actions/<id>/action.json` declares:

- `id`, `title`, `category`, `role`, `visibility`, `purpose`, `strategy`;
- `contract`: `target`, `context`, `result`, `effect` (`mode` and `writes`), `guards`;
- `execution`: `mode`, `result_step`, ordered `steps`;
- UI metadata (`command`, `routes`, `bindings`) where the Action is researcher-facing;
- provider budget fields on an AI step only (`max_input_tokens`, `target_output_tokens`, `max_output_tokens`, `max_retries`, `timeout_ms`, `deadline_ms`).

The Action contract validator enforces this surface; an incomplete manifest fails the release gate.

Contracts remain application-side and are not copied wholesale into prompts.

## Execution lifecycle

1. resolve canonical definition;
2. evaluate guards against current state;
3. snapshot source revision;
4. execute deterministic steps;
5. for an AI step, build compact task-specific context and make the bounded request;
6. validate returned candidate in code;
7. store only through declared write-capable deterministic tools;
8. publish outcome/status/provenance;
9. invalidate dependent derived state when scientific state changes.

## Deterministic Actions

Deterministic Actions still use the Action runtime so UI progress, logging, history, guards and ownership remain consistent. They must not require provider configuration merely because they live under the Action subsystem.

## Hybrid Actions

A hybrid Action performs deterministic resolution before any model request. The model receives only unresolved residue. `design.infer` may therefore complete with zero provider calls.

## Failure policy

Provider-backed scientific Actions do not use automatic semantic retry loops. One bounded exception exists: a model response truncated by the output budget (`MODEL_OUTPUT_TRUNCATED`) is retried once by the runner with the same request, because a truncated answer is a transport-level limit rather than a semantic failure. Every other validation/provider failure is surfaced, and further retry is an explicit workflow decision.

## Writes and provenance

AI steps do not directly mutate canonical scientific state. Write-capable deterministic tools are checked against manifest `effect.writes`. Proposals/annotations are separate from accepted canonical changes.

## Assistant

The Assistant UI discovers public Actions from the capability catalog, but that catalog is not inserted into ordinary model prompts. Slash Action commands remain explicit researcher operations. Natural-language routing is a separate tiny read-only classifier; `assistant.chat` is invoked only for routed interpretive/scientific answers.
