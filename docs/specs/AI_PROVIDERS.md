---
title: AI providers and transport
section: AI and Actions
summary: Direct-browser provider boundary, configuration, model discovery, reasoning compatibility and diagnostics.
order: 20
---

# AI providers and transport

AI provider support is optional for the scientific core. A provider may be browser-local or external, but it is deliberately isolated from scientific parsing/analysis so provider failure cannot invalidate deterministic LabFlow behavior.

## Provider boundary

External providers receive requests directly from the browser at the endpoint visible in Settings. There is no hidden relay or server proxy. The `browserlocal` provider is the exception to HTTP transport: it runs the selected GGUF in-page through wllama and therefore has no service endpoint.

This gives failures clear meaning:

- browser/network/CORS failure: no HTTP response exposed to LabFlow;
- authentication/quota/model/server failure: provider HTTP response;
- model-output failure: HTTP response may be successful but content violates the Action contract.

These categories must not be collapsed into a generic “AI failed” path in diagnostics.


### Browser Local · GGUF

Fresh browser settings select `browserlocal` with `LFM2.5-350M-Q4_K_M.gguf`. `assets/js/ai/browser-local.js` owns only model lifecycle and inference: catalogue metadata, cache checks, download progress, WebGPU/WASM runtime selection, warm-up, inference and model removal. Scientific routing stays in the Assistant/Action layers.

The default GGUF is downloaded from the official LiquidAI Hugging Face repository only when it is absent from the browser cache and automatic download is allowed. wllama is pinned to 3.6.1. WebGPU is preferred; the same GGUF is reloaded with `n_gpu_layers: 0` when GPU load, warm-up or a pre-output inference fails. LabFlow never silently falls back from Browser Local to a hosted provider.

Startup follows the **selected** catalogue model, not the bundled default: a missing selected URL model is the one that gets downloaded (and the setup Totem names it), a selected uploaded file asks for the file again instead of downloading anything, and a stored model id that is no longer in the catalogue fails closed as *Selected model unavailable* rather than being replaced by the default.

Additional HTTP(S) GGUF definitions can be added in Settings. Definitions are tiny metadata records; model bytes are downloaded only when requested.

## Provider registry

`assets/js/ai/providers.js` owns provider defaults/capabilities such as endpoint, default model, key requirements and adapter behavior. Provider-specific request quirks belong in provider/transport code, not Action prompts.

Model IDs are preserved internally. Filesystem-like local model IDs may be shortened only for UI display.

### GLM / Zhipu AI preset

The `glm` preset is intentionally thin: it reuses the generic OpenAI-compatible transport and adds only the official Zhipu endpoint, Bearer-key requirement, `glm-4.7-flash` default, JSON mode capability and the provider-native `thinking.type = enabled|disabled` mapping. The model field remains editable and connection checking probes the exact configured model directly; LabFlow does not require catalogue discovery for this preset.

Default endpoint: `https://open.bigmodel.cn/api/paas/v4/chat/completions`.

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

For current `llama.cpp`, LabFlow keeps the server-level reasoning budget unset and controls it per request. Final-only Actions (`thinking: "off"`) send a hard `thinking_budget_tokens: 0` in addition to the chat-template/effort disable hints; reasoning-enabled Actions receive a finite per-request reasoning budget derived from the Action contract. This keeps the answer budget separate from hidden reasoning and prevents a small hybrid model from consuming the entire completion budget before emitting the final result. Do not start the LabFlow llama.cpp server with a fixed `--reasoning-budget` if per-Action reasoning policy is required, because a command-line budget takes precedence over the request field.

Structured llama.cpp Actions use llama.cpp's schema-constrained `response_format` shape and LabFlow still validates the returned JSON/schema/semantics after generation. Grammar/schema-constrained generation is a generation aid, not a replacement for application-side validation.

Dynamic routers and unknown models are not assumed to support a disable-reasoning field. When an endpoint explicitly rejects a request because reasoning is mandatory, transport may perform one compatibility retry without the disable override. This is a transport compatibility retry, not an Action semantic retry.

## Context and output limits

Action manifests define operational input/output budgets and deadlines. Model theoretical maximums do not expand an Action contract automatically. Context builders compact bounded scientific context before provider dispatch.

See the generated `docs/reference/ACTION_RUNTIME_MATRIX.md` for current values.

## Diagnostics

Transport diagnostics use a correlation ID and record sanitized endpoint/provider/model, request phase, status, timing, finish reason, usage when supplied, reasoning policy and validation outcome. Secrets and authorization headers are redacted.

An HTTP 200 response rejected by structured/semantic validation is logged as a rejected response linked to the transport request, not as a successful Action.

## Console API

Use `LabFlow.AIConsole` for provider diagnosis without experiment data. See `guides/AI_PROVIDER_CONSOLE.md`.


## Provider settings draft behavior

Provider form edits are drafts until **Save** or a successful provider initialization/test. Changing the provider, API-key persistence checkbox, reasoning preference, streaming option, or other connection fields must not re-render the Settings form from the previously persisted provider. External providers use **Save & test**; Browser Local uses **Save & initialize** to verify cache/load/warm-up for the exact selected GGUF before persisting the verified selection.

## GitHub Pages → local llama.cpp

The published `https://matginesi.github.io/LabFlow/` build can use a `llama-server` running on the same computer at `http://127.0.0.1:8080/v1`. Use the same launcher as local LabFlow:

```bash
./labflow_engine.sh
```

The launcher stays bound to `127.0.0.1` and intentionally leaves CORS at the normal llama-server default. Current llama-server defaults to `*` and, with CORS credentials enabled, reflects the requesting browser origin. This avoids the multi-origin `Access-Control-Allow-Origin` incompatibility seen in some llama-server builds while allowing both a local LabFlow page and the published GitHub Pages origin. Do not add a multi-origin `--cors-origins` list for the same-machine workflow.

Chrome gates requests from a public HTTPS page to loopback behind Local Network Access permission. If Chrome asks whether `matginesi.github.io` may access services on the local device, allow it. If permission was denied earlier, restore the site permission and retry. LabFlow marks the fetch as loopback/local-network access and never routes it through a relay.

For LAN mode (`--lan`), use one explicit `--cors-origin <exact LabFlow origin>` because the server is no longer loopback-only.
