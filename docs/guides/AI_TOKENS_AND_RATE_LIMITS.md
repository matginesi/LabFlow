---
title: AI budgets and rate limits
section: Researcher guide
summary: Operational token ceilings, deadlines, semantic retries and rate-limit behavior.
order: 31
---

# AI budgets and rate limits

Each Action has an operational input ceiling, target output budget, output ceiling, semantic retry policy and inference deadline. These values come from Action manifests and may be smaller than the selected model's theoretical limits. The executable source for these limits is `actions/*/action.json`; prose documentation must not duplicate it as a second authority.

Use the generated [Action runtime matrix](../reference/ACTION_RUNTIME_MATRIX.md) for current values rather than duplicating numbers in prose.

## Semantic retries

A semantic retry occurs only when the Action contract permits another model attempt after structured/semantic validation failure. It is bounded and may include concise validator feedback.

Provider throttling (for example HTTP 429) is not silently replayed by transport. Bulk Design stops subsequent requests and leaves untouched targets pending.

## Common diagnostic categories

- `MODEL_OUTPUT_TRUNCATED` — completion ended before a usable structured result.
- `MODEL_CONTEXT_LENGTH` — request/completion budget exceeded provider/model context.
- structured/schema/semantic validation error — content was returned but did not satisfy the Action result contract.

These are different failure modes and should lead to different fixes.
