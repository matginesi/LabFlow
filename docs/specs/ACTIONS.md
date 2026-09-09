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
ui.command          Assistant slash command for public Actions
ui.routes           pages where the Action is recommended, never hidden
ui.bindings         Action parameter → application-state path bindings
```

`result_step` identifies the semantic result; later validation/storage checkpoints cannot accidentally replace it.

An AI step may declare `validate_with`. If semantic validation rejects generated content, the bounded retry regenerates that AI step with validation feedback.

## Current catalog

| Action | Target | Result | Effect |
|---|---|---|---|
| `dataset.resolve-ambiguities` | active semantic ambiguities | structured resolution proposal | `actionData.proposals['dataset.resolve-ambiguities']` |
| `design.infer` | one incomplete Design experiment | validated qualitative proposal; exhausted incomplete output becomes retryable failure | per-target proposal/status under `actionData` |
| `results.interpret` | deterministic Results bundle | structured interpretation | `actionData.annotations['results.interpret']` |
| `results.compare` | 2+ selected result groups | structured comparison | `actionData.annotations['results.compare']` |
| `assistant.chat` | current experiment/page + question | text answer | read-only |

Import, analysis, safe automatic corrections and NOMAD preparation are not Actions.

## ActionData boundary

Actions must use `LF.ActionData` for persistent proposal/annotation/status output. Do not add Action-specific fields elsewhere on `ExperimentData`.

An Action proposal is not scientific truth. A deterministic apply/accept service validates target identity, current revision and mutation rules before LabFlow Data changes.

## Availability and guards

`LF.ActionCapabilities` is the single preflight layer used by Assistant, page UI and Settings. It discovers the complete public catalog from `ActionRegistry`, resolves declarative `ui.bindings`, runs the same guards used by the Runner, and returns `available`, `reason`, `params` and `recommended`.

A page never adds or removes Actions. `ui.routes` changes recommendation/order only. If a prerequisite is missing, the Action remains discoverable as **unavailable** with the exact reason. `ActionRunner` resolves bindings and rechecks guards immediately before execution as the final safety boundary.

Current guards include:
- `dataset.loaded`
- `review.ambiguities_available`
- `design.incomplete_target`
- `results.available`
- `results.compare_groups`
- `assistant.question`

Guard failure means **unavailable now**, not provider failure. Preflight happens before provider checks, progress UI or model telemetry, so a blocked Action never appears as `1% · Failed`.

## Scientific vs technical outcomes

`design.infer` has one successful proposal state. It attempts every domain that is missing for the selected experiment; missing semantic coverage is a contract failure that uses the Action’s bounded internal retries. Only an exhausted run becomes a retryable per-experiment failure.

## Complete all missing with AI

Design bulk convenience is orchestration of the same `design.infer` Action once per target. There is no separate batch schema/Action. Each target stores and reports success/failure independently.

## Extension checklist

1. Create `actions/<id>/action.json`.
2. Add `prompt.md` only for AI steps.
3. Add/reuse one output schema for structured results.
4. For a public Action, declare one `ui.command`, recommended `ui.routes`, and any `ui.bindings` needed to resolve target/filter parameters from application state.
5. Reuse/register Context profiles and guards. Guards consume resolved Action parameters, not page DOM or route-specific state directly.
6. Register deterministic checkpoint tools beside their implementation.
7. Store transient/persistent Action output through `ActionData`.
8. Keep scientific mutation in deterministic apply services.
9. Add contract, capability/preflight, structured-output and behavior tests.
10. Rebuild Action/prompt/reference bundles.

Do not introduce a central Action whitelist or special-case the Action ID in the generic runner when a manifest/registry contract can express the behavior.
