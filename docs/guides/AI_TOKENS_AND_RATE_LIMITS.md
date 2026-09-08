---
title: AI tokens, limits and rate limiting
section: Researcher guide
summary: Current Action budgets, semantic retries and provider throttling behavior.
order: 31
---

# AI tokens, limits and rate limiting

## Independent limits

AI requests are bounded by several independent controls:

- Action `max_input_tokens`;
- normal `target_output_tokens`;
- Action `max_output_tokens` ceiling;
- provider/model context and completion limits;
- per-step inference deadline.

The Action manifest, not the theoretical model maximum, defines LabFlow's operational budget.

## Current budgets

Do not duplicate hardcoded budget tables in prose. The generated `docs/reference/ACTION_RUNTIME_MATRIX.md` is the source of truth and is rebuilt from `actions/*/action.json`.

## Semantic retries

Current structured AI Actions use at most one bounded semantic retry. If an Action has `validate_with`, a rejected proposal causes the AI step to regenerate with validator feedback.

Provider throttling/429 responses are not silently replayed by the transport.

## Bulk Design

“Suggest all” is a sequence of independent `design.infer` runs. Completed suggestions remain stored if a later experiment fails. Provider rate limiting stops subsequent requests rather than creating hidden background traffic.

## Diagnosing local-model truncation

`MODEL_OUTPUT_TRUNCATED` means the response ended before a usable structured object was completed. `MODEL_CONTEXT_LENGTH` means request + completion budget exceeded the model/server context. These are distinct from schema/semantic validation failures.

## Diagnostics

Use Logs plus `LabFlow.Data.actions()` to see the exact Action budget/contract currently in use.
