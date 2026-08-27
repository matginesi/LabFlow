---
title: AI tokens, limits and rate limiting
section: Researcher guide
summary: Understand LabFlow request budgets, streaming telemetry, local-model truncation and the Z.AI GLM-4.7-Flash circuit breaker.
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
| `analysis.enrich` | 2,400 | 240 | 480 | automatic semantic micro-enrichment; no retries |
| `design.infer` | 3,600 | 320 | 800 | one selected Design proposal |
| `assistant.chat` | 12,000 | 700 | 2,048 | bounded page/experiment chat |
| `report.generate` | 12,000 | 3,600 | 5,000 | one bounded Report/Paper writing block; 240 s inference deadline |
| `report.improve` | 12,000 | 3,200 | 5,000 | one bounded edit block; no hidden semantic retry |

The generated [Action runtime matrix](../reference/ACTION_RUNTIME_MATRIX.md) is the authoritative overview for every Action.

## Context compaction

Before contacting the provider, LabFlow estimates prompt size. If the Context Pack is too large, it deterministically removes lower-priority detail and shortens arrays/strings until the Action's `max_input_tokens` contract is respected.

Compaction does not summarize RAW data with another model. It is deterministic selection/clipping.

For `analysis.enrich`, the Context Pack is intentionally small: a compact deterministic Brief, a bounded sample inventory, a few unresolved findings/evidence items, limited Design state and at most a tiny relevant scientific Knowledge Base slice.

## Why a local model can return `MODEL_OUTPUT_TRUNCATED`

An HTTP 200 response is not necessarily a valid Action result. If the provider reports `finish_reason: length`, the model reached its output ceiling before producing a complete result.

For structured JSON this is especially important: storing a cut-off object would corrupt the Action contract. LabFlow rejects it as `MODEL_OUTPUT_TRUNCATED`.

`analysis.enrich` is deliberately non-blocking and does not retry. Its compact schema asks for one goal plus short arrays of variables, comparisons, hypotheses and gaps; it does not ask the model to repeat confidence/basis prose for every field. If a weak/local model is unusually verbose, import still finishes with the deterministic Brief.


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

## Z.AI `glm-4.7-flash`: no fallback and no hidden retry

LabFlow never substitutes another model for `glm-4.7-flash`.

For this model the client policy is intentionally conservative:

- one HTTP attempt per Action work unit;
- no hidden automatic HTTP retry after `1305`/HTTP 429;
- a 10 s quiet interval after accepted traffic;
- one provider-wide circuit shared by Test connection, import enrichment, Design, Assistant and other AI Actions;
- the circuit state is persisted locally so reloading the page cannot immediately resume a throttling storm;
- a provider throttle pauses/stops multi-request sequences while preserving completed work.

These are **LabFlow protective policies**, not claims about an official Z.AI RPM/TPM allowance.

## Exponential provider cooldown

The first exhausted `1305` opens a 60 s circuit. If the circuit expires and the provider returns another `1305` before any successful request, the cooldown grows approximately:

```text
60 s → 120 s → 240 s → 480 s → max 900 s
```

A provider `Retry-After` value is respected when it requires a longer wait.

A successful request clears the exponential failure history and returns to normal quiet spacing.

While the circuit is open, LabFlow fails fast **before `fetch()`**. Even Test connection sends zero HTTP requests and reports the remaining cooldown.

## Why this matters for the observed Z.AI failure

If a minimal connection probe receives HTTP 429/`1305` in a few hundred milliseconds, the rejection happened before LabFlow could perform meaningful generation. In that case making `analysis.enrich` smaller may improve normal operation later, but it cannot itself cure the immediate provider throttle.

The correct client behavior is therefore:

1. record the throttle;
2. stop new provider traffic;
3. preserve deterministic/local work;
4. expose the cooldown clearly;
5. retry only after the provider window has had time to recover.

## Bulk Design behavior

`Suggest all` runs one experiment per request and never treats a provider throttle as 22 independent experiment failures.

If nine experiments have completed and the next request receives a provider rate limit, the intended state is:

```text
9 suggested · 22 pending · provider cooldown
```

No further request is sent in that run. The researcher can continue later and LabFlow resumes only work still missing.

## Deadlines do not include pacing

Provider pacing/cooldown time is traffic management, not model inference time. The work-unit deadline starts when the actual HTTP request starts. This prevents a long cooldown from consuming a generation deadline before a request has even left the browser.
