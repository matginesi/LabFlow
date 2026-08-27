# AI provider and model compatibility

This document is the contract for provider-specific behavior in LabFlow. Scientific Actions remain provider-independent; only the provider registry and transport may adapt HTTP payloads.

## Common transport

LabFlow calls providers directly from the browser through the OpenAI-compatible Chat Completions shape:

```text
POST <base>/chat/completions
{ model, messages, stream, ...declared provider options }
```

`assets/js/ai/providers.js` is the declarative capability registry. `assets/js/ai/transport.js` owns URL normalization, authentication, token parameter names, streaming/SSE parsing, response normalization, timing, bounded rate-limit retry and diagnostics. Actions and prompts must not add provider-specific request fields.

The built-in adapters cover Z.AI, OpenAI Chat Completions, OpenRouter, NVIDIA NIM, the Gemini OpenAI-compatible endpoint, Ollama, LM Studio, llama.cpp (`llama-server`) and a generic OpenAI-compatible endpoint. A custom endpoint receives only common fields unless its registry entry explicitly declares another capability.

## Endpoint and authentication rules

- A base ending in `/v1` resolves to `/v1/chat/completions`; an already complete endpoint is preserved and duplicated suffixes are normalized.
- Only `http:` and `https:` endpoints are accepted.
- A bearer key is sent only for providers declaring `keyRequired` or `optionalKey`. Ollama, LM Studio and llama.cpp never inherit a key saved for a cloud provider.
- Cloud API keys are stored separately by provider. The legacy single-key setting is merged once into the provider that was active when it was saved, even when keys for other providers already exist; existing provider-specific keys are never overwritten.
- Provider-declared static headers are allowlisted in the registry. Z.AI sends its documented `Accept-Language`; OpenRouter sends only the optional LabFlow application title and does not disclose the current experiment or page URL.
- Browser-origin access remains a provider responsibility. LabFlow does not prescribe a separate application server: LM Studio, Ollama or llama.cpp only needs to accept requests from the browser origin currently running LabFlow.

## Model discovery and capability detection

- Standard and custom providers use their OpenAI-compatible `/models` response.
- NVIDIA NIM uses the declared hosted catalogue `https://integrate.api.nvidia.com/v1/models` with the researcher-supplied bearer key. **Detect** reads capabilities and presents returned model IDs in a real select when available. Z.AI deliberately does **not** load a provider-wide catalogue: the model field is exact/manual (default `glm-4.7-flash`) and **Inspect** only uses known local capability metadata. This prevents catalogue entries such as an inaccessible GLM variant from replacing the model tied to the researcher's API key.
- Gemini supplements this with the native Models API output and input ceilings.
- Ollama supplements this with `/api/show`, including `num_predict` and model context metadata.
- LM Studio supplements this with `/api/v1/models`. `loaded_instances` is authoritative for the active model and runtime context; a listed but unloaded model is not silently treated as active.
- llama.cpp uses the OpenAI-compatible `/v1/models` catalogue exposed by `llama-server` for model IDs and `GET /props` for runtime metadata. `default_generation_settings.n_ctx` is the effective context of one server slot and `total_slots` is retained for diagnostics. The LabFlow runtime profile is `--parallel 1 --ctx-size 65536`, so a matching server reports `n_ctx = 65536` and `total_slots = 1`; LabFlow uses that 65K context directly and never divides the reported `n_ctx` again. The preset base is `http://127.0.0.1:8080/v1`; the selected model ID is whatever the running server reports.

Discovery is cached by provider, endpoint and model. Opening Settings, editing provider fields and running an Action never contacts a provider for metadata. Providers that expose useful catalogues use explicit **Detect**; Z.AI uses exact manual model configuration and local **Inspect** instead. Without detected or built-in metadata, Actions use their own bounded output contract and a conservative unknown-capability fallback. **Save & test connection** does not run discovery: it sends one small portable probe to the currently configured endpoint/model. Exact output limits are preferred when Detect has established them, and a context window is not mislabeled as an output limit. Catalogue-select providers retain a valid configured model; Detect never silently switches the configured model merely because another model is currently loaded or appears first in a catalogue.

For a catalogue provider the intended sequence is **enter API key → Detect → choose model → Save & test connection**. For Z.AI it is **enter the exact model ID available to the key → Save & test connection**; Inspect is optional and does not query the provider catalogue. Provider-scoped keys stay local to the browser and no detection step sends experiment data.

### llama.cpp (`llama-server`)

The dedicated `llamacpp` adapter is local and keyless by default. LabFlow resolves `http://127.0.0.1:8080/v1` to `/v1/chat/completions`, supports streaming, discovers model IDs through `/v1/models`, and reads runtime context/slot metadata through `/props`. It does not reuse a key saved for Z.AI or another cloud provider. LabFlow recommends one server slot and a 65,536-token context (`--parallel 1 --ctx-size 65536`) because Actions themselves are sequential and already have much smaller operational input/output caps. Detect labels this profile as matched when `/props` reports one slot and 65,536 context tokens; other configurations remain usable but are explicitly reported as a different runtime profile.

llama.cpp feature support can vary by build/model/chat template, so LabFlow keeps the **model capability** honest even when metadata is silent. Separately, current llama-server exposes explicit per-request reasoning controls. The `llamacpp` adapter therefore declares an `off` transport mapping (`reasoning_effort: none`, `reasoning_budget: 0`, `chat_template_kwargs.enable_thinking: false`). An Action with `thinking: off` may use that mapping even if `/v1/models` reports no reasoning capability; the UI says that model thinking metadata is not exposed while request control is available.

A tiny **Test connection** probe is a transport test, not an Action-quality test. Some reasoning templates can still spend the probe budget in `reasoning_content` and return HTTP 200 with `finish_reason: length` before final text. For llama.cpp, LabFlow reports that case as **reachable · final-text probe inconclusive** rather than as network failure. Normal Actions remain strict and still require their final response contract.

The recommended LabFlow launcher does **not** globally disable reasoning. Reasoning is controlled per Action: checkpoints declared `thinking: off` receive llama.cpp's explicit off mapping, while reasoning-capable checkpoints may use the model/server default. This keeps one single-slot 65K server useful for both deterministic-style structured Actions and the few Actions that intentionally request reasoning. Structured Actions may use JSON mode when declared, but LabFlow's own parser/schema validator remains authoritative; provider-side structure enforcement is never trusted as the only validation layer.

Recommended llama.cpp core flags for LabFlow are `--ctx-size 65536 --parallel 1 --alias local-model --host 127.0.0.1 --port 8080 --jinja`. Additional GPU/KV-cache flags remain machine-specific and are intentionally outside the provider contract.

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
| llama.cpp | `reasoning_effort = none`, `reasoning_budget = 0`, `chat_template_kwargs.enable_thinking = false` | `reasoning_effort = medium`, `enable_thinking = true` |
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
- Every AI step has an explicit operational `max_input_tokens` cap. Context preflight uses the tighter of this Action cap and model/runtime context headroom, reserves the Action target output first, and compacts deterministically before reporting a genuine context overflow. A 200K model context therefore never becomes permission for a 200K LabFlow prompt.
- Rate-limit handling is provider-specific and never changes the selected model. For Z.AI `glm-4.7-flash`, LabFlow uses **zero automatic transport retries**, a 10 s client-side quiet interval measured from the end of accepted traffic, and one **provider-wide persisted circuit** shared by connection tests and all AI Actions. The first exhausted `1305`/HTTP 429 opens 60 s; repeated throttles after expiry grow the circuit approximately 60 → 120 → 240 → 480 → max 900 s unless a successful request clears the failure history. A provider `Retry-After` can lengthen the wait. New requests, including Test connection, fail fast before `fetch()` while the circuit is open. Multi-request Action sequences stop at the first provider throttle and preserve completed work. Quota/usage-window conditions (`1304`, `1308`, `1310`) fail immediately as well. These timings are protective LabFlow client policy, not provider-published RPM/TPM limits.

## Connection test

**Save & test connection** persists the current provider, model and provider-scoped key, verifies browser retention, then attempts one minimal non-streaming request through the common transport. It uses `Reply only with OK.`, an 8–16 token ceiling, a shorter timeout and an explicit thinking-off field when the provider declares one. It performs no capability/model discovery and does not change the selected model. The connection probe obeys an already-open provider circuit: while cooldown is active it sends **zero** HTTP requests and reports the remaining wait. Otherwise HTTP 429 and known Z.AI limit/quota codes immediately produce a reachable-but-limited result and open/update the shared cooldown; the connection test never retries. The provider output includes the model reply plus measured elapsed and round-trip time, token usage or a clearly marked estimate, payload size, finish reason and request ID. It does not send experiment data.

Transport logs expose simple phase timings without secrets: request preparation, provider pacing, response headers, first streamed token, generation duration, request duration, finalization, total duration, retry count and HTTP request count. The live UI shows token-oriented telemetry; raw SSE events/wire bytes remain diagnostic because chunk count and envelope size do not equal token use. Action context logs separately expose capability lookup, Context Pack/Knowledge Base preparation and compaction passes.

Errors retain the provider response and are classified separately as browser/CORS, authentication, unavailable model, context overflow, output-length contract failure, transient rate/concurrency/capacity limit, quota exhaustion or provider server failure. Normal Actions retry only transient network/timeouts, temporary 5xx failures and bounded semantic output corrections; authentication, malformed request, unavailable model and invalid endpoint errors are not automatically repeated. Diagnostic helpers have one public API: `networkMessage`, `statusHint`, `errorSummary` and `contextNote`.
