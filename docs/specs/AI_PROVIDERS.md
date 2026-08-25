# AI provider and model compatibility

This document is the contract for provider-specific behavior in LabFlow. Scientific Actions remain provider-independent; only the provider registry and transport may adapt HTTP payloads.

## Common transport

LabFlow calls providers directly from the browser through the OpenAI-compatible Chat Completions shape:

```text
POST <base>/chat/completions
{ model, messages, stream, ...declared provider options }
```

`assets/js/ai/providers.js` is the declarative capability registry. `assets/js/ai/transport.js` owns URL normalization, authentication, token parameter names, streaming/SSE parsing, response normalization, timing, bounded rate-limit retry and diagnostics. Actions and prompts must not add provider-specific request fields.

The built-in adapters cover Z.AI, OpenAI Chat Completions, OpenRouter, NVIDIA NIM, the Gemini OpenAI-compatible endpoint, Ollama, LM Studio and a generic OpenAI-compatible endpoint. A custom endpoint receives only common fields unless its registry entry explicitly declares another capability.

## Endpoint and authentication rules

- A base ending in `/v1` resolves to `/v1/chat/completions`; an already complete endpoint is preserved and duplicated suffixes are normalized.
- Only `http:` and `https:` endpoints are accepted.
- A bearer key is sent only for providers declaring `keyRequired` or `optionalKey`. Ollama and LM Studio never inherit a key saved for a cloud provider.
- Cloud API keys are stored separately by provider. The legacy single-key setting is merged once into the provider that was active when it was saved, even when keys for other providers already exist; existing provider-specific keys are never overwritten.
- Provider-declared static headers are allowlisted in the registry. Z.AI sends its documented `Accept-Language`; OpenRouter sends only the optional LabFlow application title and does not disclose the current experiment or page URL.
- Browser-origin access remains a provider responsibility. LabFlow does not prescribe a separate application server: LM Studio or Ollama only needs to accept requests from the browser origin currently running LabFlow.

## Model discovery and capability detection

- Standard and custom providers use their OpenAI-compatible `/models` response.
- NVIDIA NIM uses the declared hosted catalogue `https://integrate.api.nvidia.com/v1/models` with the researcher-supplied bearer key. The single **Detect** control is disabled until a required key is entered, then reads capabilities and presents returned model IDs in a real select when available. Z.AI uses that same control and preserves its configured/default `glm-4.7-flash` entry when the catalogue endpoint omits it. A catalogue failure restores exact manual model entry rather than blocking connection testing.
- Gemini supplements this with the native Models API output and input ceilings.
- Ollama supplements this with `/api/show`, including `num_predict` and model context metadata.
- LM Studio supplements this with `/api/v1/models`. `loaded_instances` is authoritative for the active model and runtime context; a listed but unloaded model is not silently treated as active.

Discovery is cached by provider, endpoint and model. Opening Settings, editing provider fields and running an Action never contacts a provider for metadata. Every provider uses the same explicit **Detect** control; it reads capability metadata and also the model catalogue when available. Without detected or built-in metadata, Actions use their own bounded output contract and a conservative unknown-capability fallback. **Save & test connection** does not run discovery: it sends one small portable probe to the currently configured endpoint/model. Exact output limits are preferred when Detect has established them, and a context window is not mislabeled as an output limit. Catalogue-select providers retain a valid configured model; Detect never silently switches the configured model merely because another model is currently loaded or appears first in a catalogue.

For a key-gated provider the intended sequence is **enter API key → Detect → choose model when a catalogue is available → Save & test connection**. Detect stores the provider-scoped key locally after that explicit request; it does not send experiment data.

## Thinking and non-thinking models

Every AI checkpoint declares `thinking: off|auto|on`. This Action policy is the normal default. Settings exposes an explicit override:

- `auto`: follow the Action policy;
- `off`: force no thinking where the selected model permits it;
- `on`: force thinking where the selected model supports it.

Model capability is normalized as `none`, `optional`, `required` or `unknown`. A non-reasoning model ignores an `on` request. A reasoning-required model ignores an incompatible `off` request. An unknown model receives no speculative override until metadata makes the capability explicit. The requested, detected and effective states are retained in Action diagnostics/history.

Current declared mappings are:

| Provider | Off | On |
| --- | --- | --- |
| Z.AI | `thinking.type = disabled` | `thinking.type = enabled` |
| LM Studio | `reasoning_effort = none`, `chat_template_kwargs.enable_thinking = false` | `reasoning_effort = medium`, `enable_thinking = true` |
| Ollama OpenAI-compatible | `reasoning_effort = none` | `reasoning_effort = medium` |
| OpenAI | `reasoning_effort = none` | `reasoning_effort = medium` |
| OpenRouter | `reasoning.effort = none` | `reasoning.effort = medium` |
| NVIDIA NIM, Gemini, custom | model default | model default |

Capability comes from provider model metadata when available, including OpenRouter reasoning parameters, Ollama's model `capabilities`, and LM Studio's loaded-instance `reasoning.allowed_options`; known OpenAI/Z.AI families supply a conservative built-in classification. An unsupported explicit mode safely degrades to `auto`; LabFlow never guesses undocumented request fields. The connection probe always uses its tiny fixed budget and requests `off` whenever the provider declares a supported off payload; otherwise it sends no speculative reasoning field.

Provider reasoning is normalized separately from final content. LabFlow accepts common `reasoning`, `reasoning_content`, text-part arrays and streamed reasoning fields. Reasoning may be displayed as progress, but only final content satisfies the Action response contract. An empty final answer reports its `finish_reason` and whether reasoning consumed the available output budget. `auto` never triggers a capability probe: known/detected metadata is used when present and unknown capability leaves the provider default untouched.

## Output formats, streaming and budgets

- `tokenParam` selects `max_tokens` or `max_completion_tokens` per provider.
- JSON Schema and JSON mode are sent only when declared by the provider.
- Temperature and stream-usage options are sent only when supported.
- Z.AI streaming deliberately omits OpenAI's `stream_options` extension because it is not part of Z.AI's documented Chat Completions request. Usage is still parsed when Z.AI returns it and otherwise estimated locally.
- Streaming and non-streaming responses use the same normalized result contract.
- Action output targets are clamped by detected model/provider ceilings and researcher caps. Unknown ceilings remain unknown; the transport does not invent a global maximum.
- Context preflight reserves the Action target output first, not the full theoretical JSON ceiling. If necessary it compacts again down to the declared minimum valid output before reporting a genuine context overflow.
- Transport rate-limit retries repeat the identical HTTP request with bounded provider-specific backoff. They do not rerun an Action or create a queue.

## Connection test

**Save & test connection** persists the current provider, model and provider-scoped key, verifies browser retention, then sends exactly one minimal non-streaming request through the common transport. It uses `Reply only with OK.`, an 8–16 token ceiling, a shorter timeout and an explicit thinking-off field when the provider declares one. It deliberately bypasses normal pacing/backoff, performs no capability/model discovery and does not change the selected model. HTTP 429 and Z.AI code `1305` immediately produce a reachable-but-rate-limited result. The provider output includes the model reply plus measured elapsed and round-trip time, token usage or a clearly marked estimate, payload size, finish reason and request ID. It does not send experiment data.

Transport logs expose simple phase timings without secrets: request preparation, provider pacing, response headers, first streamed token, request duration, finalization, total duration, retry count and HTTP request count. Action context logs separately expose capability lookup, Context Pack/Knowledge Base preparation and compaction passes.

Errors retain the provider response and are classified separately as browser/CORS, authentication, unavailable model, context overflow, output-length contract failure, rate limit or provider server failure. Normal Actions retry only transient network/timeouts, temporary 5xx failures and bounded semantic output corrections; authentication, malformed request, unavailable model and invalid endpoint errors are not automatically repeated. Diagnostic helpers have one public API: `networkMessage`, `statusHint`, `errorSummary` and `contextNote`.
