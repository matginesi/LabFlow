---
title: AI tokens, limits and rate limiting
section: Researcher guide
summary: Understand LabFlow request budgets, streaming telemetry, local-model truncation and provider rate-limit handling.
order: 5
---

# AI tokens, limits and rate limiting

LabFlow treats a model's advertised context window as **capacity**, not as an Action budget. Every AI Action has much smaller operational limits chosen for the work it performs.

This distinction prevents a 200K-context model from turning a small task into a 200K-token request.

## Four independent limits

For an AI checkpoint, think about four numbers:

1. **Input cap** — maximum estimated prompt/context tokens LabFlow is willing to send for that Action.
2. **Target output** — normal amount of output the Action is designed to need.
3. **Output ceiling** — hard `max_tokens`/equivalent sent to the provider.
4. **Deadline** — maximum inference time for the actual HTTP work unit.

Provider model capacity is applied only as an additional ceiling.

## Current examples

| Action | Input cap | Target output | Output ceiling | Notes |
|---|---:|---:|---:|---|
| `analysis.enrich` | 3,200 | 320 | 700 | automatic semantic micro-enrichment; no retries |
| `design.infer` | 4,500 | 420 | 1,000 | one selected Design proposal |
| `design.infer-batch` | 6,000 | 1,200 | 2,600 | at most a small batch of proposals |
| `assistant.chat` | 12,000 | 700 | 2,048 | bounded page/experiment chat |
| `report.generate` | 12,000 | 3,600 | 5,000 | one bounded Report/Paper writing block; 240 s inference deadline |
| `report.improve` | 12,000 | 3,200 | 5,000 | one bounded edit block; no hidden semantic retry |

The generated [Action runtime matrix](../reference/ACTION_RUNTIME_MATRIX.md) is the authoritative overview for every Action.

## Context compaction

Before contacting the provider, LabFlow estimates prompt size. If the Context Pack is too large, it deterministically removes lower-priority detail and shortens arrays/strings until the Action's `max_input_tokens` contract is respected.

Compaction does not summarize RAW data with another model. It is deterministic selection/clipping.

For `analysis.enrich`, the Context Pack is intentionally small: a compact deterministic Brief, a bounded sample inventory, a few unresolved findings/evidence items, limited Design state and at most a tiny relevant scientific Knowledge Base slice.

## Why a local model can return `MODEL_OUTPUT_TRUNCATED`

An HTTP 200 response is not necessarily a valid Action result. If the provider reports `finish_reason: length`, the completion budget ended before a complete result was produced. LabFlow distinguishes the Action's final-answer budget from provider completion headroom, records reasoning/usage when available, and permits one immediate adaptive truncation recovery before surfacing `MODEL_OUTPUT_TRUNCATED`.

For structured JSON this is especially important: storing a cut-off object would corrupt the Action contract. LabFlow rejects it as `MODEL_OUTPUT_TRUNCATED`.

`analysis.enrich` is deliberately non-blocking and does not retry. Its schema and output budget are kept small enough that normal output should fit comfortably. If a weak/local model is unusually verbose, import still finishes with the deterministic Brief.


## Slow local writing Actions

Report/Paper generation is deliberately different from `analysis.enrich`. A local 4B–8B model may need tens of seconds to evaluate context and generate a substantial section. LabFlow therefore gives Report/Paper work units a longer **240 s inference deadline** and a 5,000-token output ceiling, while still splitting the document into deterministic blocks.

A broken local stream (`terminated`, connection reset, premature close) is not retried automatically. The failed checkpoint remains recoverable through the normal Action Retry control. This avoids immediately launching the same expensive generation again while the local server may still be recovering or releasing model resources.

## SSE events and bytes are not token usage

Streaming providers can emit thousands of tiny Server-Sent Events. The raw event count and byte count include JSON framing and transport overhead.

They are diagnostics, not scientific progress and not a token bill.

The useful live metrics are:

- estimated/exact output tokens;
- output ceiling;
- time to first token (TTFT);
- generation time;
- tokens per second when meaningful;
- provider finish reason.

Raw SSE capture is bounded for diagnostics so a long stream cannot grow browser memory indefinitely.

## Provider rate-limit handling

The transport uses a deliberately small contract for every provider:

- one HTTP attempt per provider request;
- no hidden transport retry;
- no client-side pacing;
- no local or persisted cooldown/circuit breaker;
- no automatic model substitution;
- preserve the provider HTTP status, provider code/message and `Retry-After` when present.

HTTP 429 and known provider limit/quota conditions are therefore visible provider results, not a second LabFlow scheduling state. A later explicit researcher request may try again. LabFlow does not invent unpublished RPM/TPM values.

### Z.AI `1305`

A Z.AI HTTP 429 with provider code `1305` is reported once. If Z.AI sends `Retry-After`, LabFlow displays it. The connection test is isolated: it makes one minimal request and does not poison later AI Actions with a shared cooldown.

### Bulk Design and other multi-request sequences

A sequence stops on the first provider throttle so it does not intentionally continue generating traffic. Suggestions already completed remain stored; untouched experiments remain pending and can be resumed later. This stop policy is orchestration, not an automatic retry mechanism.

### Deadlines

A work-unit deadline measures the actual request/generation operation. There is no pre-request pacing or cooldown interval to account for.

### Diagnostics

Useful evidence is the provider response itself: HTTP status, provider code/message, request ID, elapsed time and `Retry-After` if present. An immediate 429 on a tiny connection probe points to provider/account/service throttling rather than prompt size or local generation time.
