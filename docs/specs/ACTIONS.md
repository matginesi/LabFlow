---
title: Action system
section: AI and Actions
summary: Defines the five explicit researcher capabilities, their contracts, ActionData storage and extension rules.
order: 10
---

# Action system

## Principle

An Action is an explicit researcher-facing capability with a bounded target, context, result, effect, guards and execution trace. Internal deterministic lifecycle work is not an Action.

## Manifest

```text
contract.target     what the Action acts on
contract.context    bounded context profile/scope
contract.result     semantic output + schema when structured
contract.effect     allowed writes
contract.guards     availability conditions
execution.mode      AI / hybrid / deterministic
execution.result_step
execution.steps[]
```

`result_step` identifies the semantic result; later validation/storage checkpoints cannot accidentally replace it.

An AI step may declare `validate_with`. If semantic validation rejects generated content, the bounded retry regenerates that AI step with validation feedback.

## Current catalog

| Action | Target | Result | Effect |
|---|---|---|---|
| `dataset.resolve-ambiguities` | active semantic ambiguities | structured resolution proposal | `actionData.proposals['dataset.resolve-ambiguities']` |
| `design.infer` | one incomplete Design experiment | qualitative suggestion or `insufficient_evidence` | per-target proposal/status under `actionData` |
| `results.interpret` | deterministic Results bundle | structured interpretation | `actionData.annotations['results.interpret']` |
| `results.compare` | 2+ selected result groups | structured comparison | `actionData.annotations['results.compare']` |
| `assistant.chat` | current experiment/page + question | text answer | read-only |

Import, analysis, safe automatic corrections and NOMAD preparation are not Actions.

## ActionData boundary

Actions must use `LF.ActionData` for persistent proposal/annotation/status output. Do not add Action-specific fields elsewhere on `ExperimentData`.

An Action proposal is not scientific truth. A deterministic apply/accept service validates target identity, current revision and mutation rules before LabFlow Data changes.

## Guards

Current guards include:
- `dataset.loaded`
- `review.ambiguities_available`
- `design.incomplete_target`
- `results.available`
- `results.compare_groups`
- `assistant.question`

Guard failure means **unavailable now**, not provider failure.

## Scientific vs technical outcomes

`design.infer` explicitly allows `insufficient_evidence`: this is a successful scientific outcome shown as **Needs context**. Malformed JSON/schema/provider errors remain technical failures.

## “Suggest all”

Design bulk convenience is orchestration of the same `design.infer` Action once per target. There is no separate batch schema/Action. Each target stores and reports success/failure independently.

## Extension checklist

1. Create `actions/<id>/action.json`.
2. Add `prompt.md` only for AI steps.
3. Add/reuse one output schema for structured results.
4. Reuse/register Context profiles and guards.
5. Register deterministic checkpoint tools beside their implementation.
6. Store transient/persistent Action output through `ActionData`.
7. Keep scientific mutation in deterministic apply services.
8. Add contract, structured-output and behavior tests.
9. Rebuild Action/prompt/reference bundles.

Do not introduce a central Action whitelist or special-case the Action ID in the generic runner when a manifest/registry contract can express the behavior.
