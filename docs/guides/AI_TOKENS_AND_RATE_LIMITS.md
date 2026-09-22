---
title: AI budgets and rate limits
section: Researcher guide
summary: Operational token ceilings, deadlines, semantic retries and rate-limit behavior.
order: 31
---

# AI budgets and rate limits

Each Action has an operational input ceiling, an answer reserve/target/maximum, a semantic retry policy and an inference deadline. These values come from Action manifests and may be smaller than the selected model's theoretical limits. The executable source for these limits is `actions/*/action.json`; prose documentation must not duplicate numeric values as a second authority.

LabFlow keeps **answer** and **completion** budgets distinct. `min_output_tokens` is the minimum answer space protected while fitting context, `target_output_tokens` is the desired answer size, and `max_output_tokens` is the Action's answer maximum. The provider request may be larger when reasoning headroom is needed; that larger value is the **completion request limit** and covers answer + reasoning. The optional global **Completion limit** clamps that provider request.

A final-only Action (`thinking: "off"`) reserves **zero** hidden reasoning headroom. Providers with a hard per-request reasoning budget (currently llama.cpp) receive a zero reasoning budget for that Action. A reasoning-enabled/required Action receives a separate finite reasoning budget and a completion request sized for `answer + reasoning`. This policy is intentionally model-size agnostic: small and large models obey the same Action contract.

If a final-only response is truncated, the semantic retry asks for a more compact final result but does **not** increase the completion budget merely to give unexpected reasoning more room. For reasoning-enabled Actions, bounded retry growth may still be used when provider usage shows that the declared completion budget was genuinely insufficient.

The Action Totem defaults to researcher-facing stage, progress, result/failure summary and primary controls. Provider/model identity, token budgets, timing, HTTP/stream information, request preview and structured-output diagnostics remain available under **Technical details**. Provider-reported usage is shown exactly when available; otherwise LabFlow marks token counts as estimates.

Use the generated [Action runtime matrix](../reference/ACTION_RUNTIME_MATRIX.md) for current values rather than duplicating numbers in prose.

## Semantic retries

A semantic retry occurs only when the Action contract permits another model attempt after structured/semantic validation failure. It is bounded and may include concise validator feedback.

Provider throttling (for example HTTP 429) is not silently replayed by transport. Bulk Design stops subsequent requests and leaves untouched targets pending.

## Common diagnostic categories

- `MODEL_OUTPUT_TRUNCATED` — completion ended before a usable structured result.
- `MODEL_CONTEXT_LENGTH` — request/completion budget exceeded provider/model context.
- structured/schema/semantic validation error — content was returned but did not satisfy the Action result contract.

These are different failure modes and should lead to different fixes.
