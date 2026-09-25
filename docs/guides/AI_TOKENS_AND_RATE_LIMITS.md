---
title: AI tokens and rate limits
section: Researcher guide
summary: Small bounded requests, manifest-owned limits and provider failure behavior.
order: 75
---

# AI tokens and rate limits

LabFlow reduces token use structurally: deterministic filtering happens before a provider request.

## Limits belong to manifests

The executable authority is `actions/*/action.json`. Each provider-backed Action defines its input ceiling, target/maximum output, deadline and retry allowance. The generated Action runtime matrix is the convenient human-readable view.

Current design principles:

- Assistant router: tiny non-streaming language-agnostic classification, reasoning off, maximum 96 output tokens;
- Assistant answer: only for interpretive/scientific routes, with a 1400-token input ceiling, 120-token target output and 280-token maximum output;
- ambiguity resolution: only unresolved findings/evidence;
- Design: only unresolved domains and a few compact candidates;
- Results/Export: zero provider tokens.

Do not increase context just because a provider supports a larger window. A large context window is capacity, not a target.

## No automatic semantic retry loops

Provider-backed scientific Actions use zero *semantic* retries. One bounded exception exists: a response truncated by the output budget (`MODEL_OUTPUT_TRUNCATED`) is retried once with the same request, because the model was cut off rather than wrong. Any other invalid output is surfaced instead of repeatedly spending tokens trying to repair an uncertain answer.

Transport-level behavior may still follow provider protocol where appropriate, but LabFlow must not create uncontrolled request loops.

## Reasoning

Prompts do not require chain-of-thought. LabFlow requests compact final output and keeps deterministic validation application-side. Provider-specific hidden reasoning is neither required nor treated as scientific evidence.

## Rate limits

When a provider rejects a request for rate limiting, LabFlow reports the failure and any provider Retry-After information. It does not create a hidden local cooldown or continuously poll the provider.

## Token telemetry

During a model-backed Action, the primary Totem shows useful generated-token and tok/s information. Input-token estimates, TTFT, budgets and request/response diagnostics are available under **Technical data**.
