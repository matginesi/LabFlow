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
- Cloud API keys are stored separately by provider. The legacy single-key setting is migrated once to the provider that was active when it was saved.
- Provider-declared static headers are allowlisted in the registry. Z.AI sends its documented `Accept-Language`; OpenRouter sends only the optional LabFlow application title and does not disclose the current experiment or page URL.
- Browser-origin access remains a provider responsibility. LabFlow does not prescribe a separate application server: LM Studio or Ollama only needs to accept requests from the browser origin currently running LabFlow.

## Model discovery and capability detection

- Standard and custom providers use their OpenAI-compatible `/models` response.
- NVIDIA NIM uses the declared hosted catalogue `https://integrate.api.nvidia.com/v1/models` with the researcher-supplied bearer key. Settings keeps **Load models** disabled until a key is entered, then presents the returned model IDs in a real select. A catalogue failure restores exact manual model entry rather than blocking connection testing.
- Gemini supplements this with the native Models API output and input ceilings.
- Ollama supplements this with `/api/show`, including `num_predict` and model context metadata.
- LM Studio supplements this with `/api/v1/models`. `loaded_instances` is authoritative for the active model and runtime context; a listed but unloaded model is not silently treated as active.

Discovery is cached by provider, endpoint and model. Opening Settings and editing provider fields never contacts a provider. Discovery runs only when the researcher presses **Detect** or starts **Save & test connection**; the latter performs the same detection silently before sending its probe. Exact output limits are preferred, and a context window is not mislabeled as an output limit.

For NVIDIA the intended sequence is **enter API key → Load models → choose model → Save & test connection**. Loading the catalogue stores the provider-scoped key locally after that explicit request; it does not send experiment data.

## Thinking and non-thinking models

Settings exposes one stable mode:

- `auto`: send no thinking override and use the model/provider default;
- `off`: apply only the provider's declared no-thinking payload;
- `on`: apply only the provider's declared thinking payload.

Current declared mappings are:

| Provider | Off | On |
| --- | --- | --- |
| Z.AI | `thinking.type = disabled` | `thinking.type = enabled` |
| LM Studio | `reasoning_effort = none`, `chat_template_kwargs.enable_thinking = false` | `reasoning_effort = medium`, `enable_thinking = true` |
| Ollama OpenAI-compatible | `reasoning_effort = none` | model default |
| OpenAI, OpenRouter, NVIDIA NIM, Gemini, custom | model default | model default |

An unsupported explicit mode safely degrades to `auto`; LabFlow never guesses undocumented request fields. The connection probe requests `off` only when the active model permits it. LM Studio's loaded-instance metadata is authoritative: reasoning-only models keep their native mode and receive a larger, still bounded probe budget so they can reach final text.

Provider reasoning is normalized separately from final content. LabFlow accepts common `reasoning`, `reasoning_content`, text-part arrays and streamed reasoning fields. Reasoning may be displayed as progress, but only final content satisfies the Action response contract. An empty final answer reports its `finish_reason` and whether reasoning consumed the available output budget.

## Output formats, streaming and budgets

- `tokenParam` selects `max_tokens` or `max_completion_tokens` per provider.
- JSON Schema and JSON mode are sent only when declared by the provider.
- Temperature and stream-usage options are sent only when supported.
- Z.AI streaming deliberately omits OpenAI's `stream_options` extension because it is not part of Z.AI's documented Chat Completions request. Usage is still parsed when Z.AI returns it and otherwise estimated locally.
- Streaming and non-streaming responses use the same normalized result contract.
- Action output targets are clamped by detected model/provider ceilings and researcher caps. Unknown ceilings remain unknown; the transport does not invent a global maximum.
- Transport rate-limit retries repeat the identical HTTP request with bounded provider-specific backoff. They do not rerun an Action or create a queue.

## Connection test

**Save & test connection** uses the normal transport and current form values. The provider output includes the model reply plus measured elapsed time, successful round-trip time, local/retry overhead, token usage or a clearly marked estimate, throughput, payload size, finish reason, retries and request ID. It does not send experiment data.

Errors retain the provider response and are classified separately as browser/CORS, authentication, unavailable model, context overflow, output-length contract failure, rate limit or provider server failure. Diagnostic helpers have one public API: `networkMessage`, `statusHint`, `errorSummary` and `contextNote`.
