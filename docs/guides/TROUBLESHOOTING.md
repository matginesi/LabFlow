---
title: Troubleshooting LabFlow
section: Researcher guide
summary: Read common logs and distinguish import, local-model, provider-rate-limit, context, output and browser failures.
order: 6
---

# Troubleshooting LabFlow

LabFlow logs enough structure to answer the first diagnostic question: **did the failure occur in deterministic LabFlow code, before the provider request, at the HTTP provider boundary, or after a successful model response?**

## A healthy import without AI

Typical deterministic events are:

```text
importer.dataset.manifest
importer.dataset.format-evidence
importer.dataset.parse.end
analysis.experiment.analyze.end
state.experiment.set
app.dataset.import.end
```

If these complete, the core experiment import is usable even when optional AI enrichment fails.

## `429` + provider code `1305`

Example:

```text
POST .../chat/completions 429
ai.request.end status: 429
ai.request.rate-limited providerCode: 1305
actions.action.failed code: MODEL_RATE_LIMIT
```

Interpretation: the remote provider rejected the request as a provider-limit/capacity condition. If the same happens to the tiny **Test AI connection** probe, this is not caused by a large experiment Context Pack.

Expected LabFlow behavior after the fix:

- one HTTP request only;
- the provider response is surfaced immediately;
- later Actions fail locally with `MODEL_RATE_LIMIT_COOLDOWN` and send no HTTP;
- bulk Design stops immediately and preserves completed proposals;
- LabFlow does not retry or create a local cooldown; a later explicit request is independent;

## `MODEL_OUTPUT_TRUNCATED`

Example:

```text
status: 200
finish_reason: length
action.failed · MODEL_OUTPUT_TRUNCATED
```

Interpretation: the endpoint worked and the model generated output, but it hit the Action output ceiling before finishing.

For automatic `analysis.enrich`, LabFlow skips the optional semantic layer and completes import. This is safe because deterministic analysis and the deterministic Experiment Brief already exist.

For other Actions, the Action definition decides whether one bounded rewrite/retry is allowed.

## `MODEL_CONTEXT_LENGTH`

The assembled prompt exceeded either the detected model context window or an explicit provider limit.

Check the logged:

- estimated input tokens;
- Action `max_input_tokens`;
- detected model context window;
- selected Action/context profile.

LabFlow should normally catch its own operational cap before contacting the provider. A provider-side context error usually means the provider/tokenizer counted more aggressively than the browser estimate or the model metadata is incomplete.

## Work-unit deadline

A deadline error means the actual HTTP inference work unit remained incomplete too long. There is no provider pacing or local cooldown before the request.

Therefore a message such as `reached its 90 second work-unit deadline` describes actual request/generation time, not a client-side rate-limit wait.

## Local provider works, cloud provider fails

This is a useful isolation test.

If LM Studio/Ollama/llama.cpp returns HTTP 200 for the same Action but Z.AI returns an immediate 429, the browser Action pipeline, context builder and structured-response path are fundamentally operating. Investigate the remote provider state separately from LabFlow's deterministic import.

If the local provider instead returns `MODEL_OUTPUT_TRUNCATED`, the transport works; the remaining issue is the model's ability to satisfy the bounded structured-output contract within the Action ceiling. For llama.cpp, a **Test AI connection** failure saying `reasoning but no final answer` with `finish_reason: length` usually means an older LabFlow build sent the tiny probe while leaving reasoning enabled. Current LabFlow explicitly disables reasoning for the llama.cpp probe and gives it a bounded 64-token final-answer budget.

## Local stream ends with `terminated`

A message such as `AI request failed · terminated` with no provider HTTP error code normally means the browser-side stream ended before LabFlow received a complete Chat Completions response. For a local server, inspect the local model/server console for process restarts, context allocation failures, slot cancellation or memory pressure.

Report/Paper Actions do not automatically re-run a terminated local generation. Retry the failed checkpoint explicitly after the local server is healthy. The longer Report/Paper inference deadline prevents LabFlow from treating a merely slow local model as failed too early, but it cannot recover a server-side terminated socket.

## CORS / browser network errors

Direct local providers must allow the LabFlow page origin. A local server can be healthy from `curl` and still be inaccessible to a browser because of CORS.

Network/CORS failures do not have an HTTP provider response body and should not be mislabeled as rate limits.

## What to copy when reporting a bug

The most useful bounded diagnostic fields are:

- Action ID and failed checkpoint;
- provider and model;
- HTTP status and provider code;
- request ID when supplied;
- estimated input tokens and output ceiling;
- TTFT, request time and finish reason;
- whether HTTP requests were `0`, `1` or more;
- `request.rate-limited` with HTTP/provider code and optional `Retry-After`;
- the nearest deterministic import/analysis events.

Do not paste API keys. The logger redacts common credential fields, but credentials should still never be intentionally copied into bug reports.
