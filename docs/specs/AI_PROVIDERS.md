---
title: AI providers and transport
section: AI and Actions
summary: Direct-browser provider boundary, configuration, model discovery, reasoning compatibility and diagnostics.
order: 20
---

# AI providers and transport

AI provider support is an optional external capability. It is deliberately isolated from scientific parsing/analysis so provider failure cannot invalidate deterministic LabFlow behavior.

## Direct-browser boundary

LabFlow sends requests from the browser to the endpoint visible in Settings. There is no hidden relay, server proxy or fallback transport.

This gives failures clear meaning:

- browser/network/CORS failure: no HTTP response exposed to LabFlow;
- authentication/quota/model/server failure: provider HTTP response;
- model-output failure: HTTP response may be successful but content violates the Action contract.

These categories must not be collapsed into a generic “AI failed” path in diagnostics.

## Provider registry

`assets/js/ai/providers.js` owns provider defaults/capabilities such as endpoint, default model, key requirements and adapter behavior. Provider-specific request quirks belong in provider/transport code, not Action prompts.

Model IDs are preserved internally. Filesystem-like local model IDs may be shortened only for UI display.

## Settings

AI settings are browser-local preferences. Credentials are stored separately by provider/endpoint and are redacted from logs. Saving provider configuration does not change scientific state.

## Detect and test

Provider detection must validate the exact visible endpoint/configuration. Catalogue discovery alone is not connectivity success: a usable configuration must pass a bounded Chat Completions probe.

For catalogue-backed providers, model discovery may populate the model selector. For local/custom endpoints, diagnostics report what the endpoint actually exposes rather than inventing a model list.

## CORS and local endpoints

Because the POC is browser-only, the provider must allow the LabFlow page origin. A terminal probe can prove credentials/model/server availability while a browser probe still fails due to CORS or private-network restrictions.

Loopback server defaults should remain loopback. LAN exposure is explicit through `labflow_engine.sh --lan` and should be used only on a trusted network.

## Reasoning compatibility

Reasoning/thinking controls are provider capabilities, not scientific context. LabFlow applies only allowlisted fields for the selected provider/policy.

Dynamic routers and unknown models are not assumed to support a disable-reasoning field. When an endpoint explicitly rejects a request because reasoning is mandatory, transport may perform one compatibility retry without the disable override. This is a transport compatibility retry, not an Action semantic retry.

## Context and output limits

Action manifests define operational input/output budgets and deadlines. Model theoretical maximums do not expand an Action contract automatically. Context builders compact bounded scientific context before provider dispatch.

See the generated `docs/reference/ACTION_RUNTIME_MATRIX.md` for current values.

## Diagnostics

Transport diagnostics use a correlation ID and record sanitized endpoint/provider/model, request phase, status, timing, finish reason, usage when supplied, reasoning policy and validation outcome. Secrets and authorization headers are redacted.

An HTTP 200 response rejected by structured/semantic validation is logged as a rejected response linked to the transport request, not as a successful Action.

## Console API

Use `LabFlow.AIConsole` for provider diagnosis without experiment data. See `guides/AI_PROVIDER_CONSOLE.md`.
