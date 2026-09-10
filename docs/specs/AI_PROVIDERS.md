# AI provider and model compatibility

This document is the contract for provider-specific behavior in LabFlow. Scientific Actions remain provider-independent; only the provider registry and transport may adapt HTTP payloads.

## Common transport

LabFlow uses the OpenAI-compatible Chat Completions shape. Every provider uses the endpoint configured by the user and is contacted directly from the browser:

```text
POST <base>/chat/completions
{ model, messages, stream, ...declared provider options }
```

`assets/js/ai/providers.js` is the declarative capability registry. `assets/js/ai/transport.js` owns URL normalization, authentication, token parameter names, streaming/SSE parsing, response normalization, one-attempt HTTP transport, rate-limit classification and diagnostics. Actions and prompts must not add provider-specific request fields.

The built-in adapters cover Z.AI, OpenAI Chat Completions, OpenRouter, NVIDIA NIM, the Gemini OpenAI-compatible endpoint, Ollama, LM Studio, llama.cpp (`llama-server`) and a generic OpenAI-compatible endpoint. A custom endpoint receives only common fields unless its registry entry explicitly declares another capability.

## Endpoint and authentication rules

- A base ending in `/v1` resolves to `/v1/chat/completions`; an already complete endpoint is preserved and duplicated suffixes are normalized.
- Only `http:` and `https:` endpoints are accepted.
- A bearer key is sent only for providers declaring `keyRequired` or `optionalKey`. Ollama, LM Studio and llama.cpp never inherit a key saved for a cloud provider.
- Cloud API keys are stored separately by provider.
- Provider-declared static headers are allowlisted in the registry. OpenRouter sends only the optional LabFlow application title and does not disclose the current experiment or page URL.
- Browser-origin access remains a provider responsibility. Ollama, LM Studio and llama.cpp are displayed without a `(local)` suffix; locality is inferred from the configured endpoint. `127.0.0.1`/`localhost` always refers to the device running the browser. To use a model server from another phone/tablet/computer, configure a LAN-resolvable hostname such as `fedora` / `fedora.local` or a private IP, bind the model server beyond loopback, and allow the LabFlow page origin with CORS.
- For LAN/loopback endpoints LabFlow marks Fetch requests with the appropriate browser target address space (`local` or `loopback`) when the browser supports Local Network Access. An HTTPS-hosted LabFlow page may still require an explicit Local Network permission. Browser security cannot be bypassed: when a browser does not support/allow that path, use an HTTPS model endpoint or serve LabFlow from a compatible local origin.
- Hosted endpoints must permit browser CORS for the LabFlow origin. LabFlow has no relay/backend fallback. An HTTP response such as 401/403/429/5xx is always preserved as a provider response, while a browser-level CORS/network failure is reported separately.

## Model discovery and capability detection

- Providers with catalogue discovery derive `/models` from the **exact endpoint currently entered by the user**. No hidden provider-wide catalogue URL may override the Settings endpoint.
- NVIDIA NIM stores the official hosted base URL `https://integrate.api.nvidia.com/v1`; it resolves catalogue requests to `https://integrate.api.nvidia.com/v1/models`, while a self-hosted/custom NIM endpoint resolves to its own `/v1/models`. The same user-supplied bearer key is used for catalogue and inference. When the browser can read the catalogue, **Detect** presents the returned model IDs in the shared select. If only catalogue access is unavailable but an exact model ID is already configured, Detect may continue with that configured model; it is successful only if the subsequent live Chat Completions probe succeeds. A browser/CORS failure on the actual chat endpoint remains a hard Detect failure. Z.AI uses the same **Detect** UI with a documented built-in catalogue snapshot and built-in capability metadata (default `glm-4.7-flash`); LabFlow does not invent an undocumented Z.AI `/models` dependency.
- Gemini supplements this with the native Models API output and input ceilings.
- Ollama supplements this with `/api/show`, including `num_predict` and model context metadata.
- LM Studio supplements this with `/api/v1/models`. `loaded_instances` is authoritative for the active model and runtime context; a listed but unloaded model is not silently treated as active.
- llama.cpp uses the OpenAI-compatible `/v1/models` catalogue exposed by `llama-server` for model IDs and `GET /props` for runtime metadata. `default_generation_settings.n_ctx` is the effective context of one server slot and `total_slots` is retained for diagnostics. The LabFlow runtime profile is `--parallel 1 --ctx-size 65536`, so a matching server reports `n_ctx = 65536` and `total_slots = 1`; LabFlow uses that 65K context directly and never divides the reported `n_ctx` again. The preset base is `http://127.0.0.1:8080/v1`; the selected model ID is whatever the running server reports.

Discovery is cached by provider, endpoint and model. Opening Settings, editing provider fields and running an Action never contacts a provider for metadata. Every provider uses the same explicit **Detect** contract: it reads the provider, endpoint/base URL, model and API key from the **visible form values**, never from an older saved fallback; a missing required key is an immediate error; and every Detect finishes with a real bounded Chat Completions probe. A live catalogue is preferred where available. For a provider explicitly allowed to fall back to a configured model (notably hosted NVIDIA/OpenRouter-style endpoints), catalogue-only browser failure may degrade to that exact configured model, but it can never produce a green result by itself: the live chat probe is authoritative. Z.AI uses its documented built-in catalogue snapshot but still must pass the real inference probe. Without detected or built-in metadata, normal Actions use their bounded output contract and a conservative unknown-capability fallback. **Save & test connection** probes the exact visible provider/endpoint/model/key tuple and saves it only after that probe succeeds. Detect and Save & test use the canonical **Action Totem** for the entire operation lifecycle (validation → catalogue when applicable → live chat probe → capability resolution/persistence); they do not also emit a Message Totem or parallel inline provider-status component. Exact output limits are preferred when Detect has established them, and a context window is not mislabeled as an output limit.

For a catalogue provider the intended sequence is **enter API key → Detect → choose model → Save & test connection**. Z.AI follows the same sequence using the built-in documented model snapshot; Detect itself does not send experiment data.

### llama.cpp (`llama-server`)

The dedicated `llamacpp` adapter is local and keyless by default. LabFlow resolves `http://127.0.0.1:8080/v1` to `/v1/chat/completions`, supports streaming, discovers model IDs through `/v1/models`, and reads runtime context/slot metadata through `/props`. It does not reuse a key saved for Z.AI or another cloud provider. LabFlow recommends one server slot and a 65,536-token context (`--parallel 1 --ctx-size 65536`) because Actions themselves are sequential and already have much smaller operational input/output caps. Detect labels this profile as matched when `/props` reports one slot and 65,536 context tokens; other configurations remain usable but are explicitly reported as a different runtime profile.

llama.cpp feature support can vary by build/model/chat template, so LabFlow keeps the **model capability** honest even when metadata is silent. Separately, current llama-server exposes explicit per-request reasoning controls. The `llamacpp` adapter therefore declares an `off` transport mapping (`reasoning_effort: none`, `chat_template_kwargs.enable_thinking: false`) even when model metadata is silent. Reasoning-off Actions also receive a short final-only system guard. On current streamed llama.cpp requests LabFlow arms realtime reasoning control; if a template such as LFM ignores the static override and emits reasoning anyway, LabFlow sends one `reasoning_end` control request for that active completion and records the event in telemetry.

A tiny **Test connection** probe is a transport test, not an Action-quality test. Some reasoning templates can still spend the probe budget in `reasoning_content` and return HTTP 200 with `finish_reason: length` before final text. For llama.cpp, LabFlow reports that case as **reachable · final-text probe inconclusive** rather than as network failure. Normal Actions remain strict and still require their final response contract.

The recommended LabFlow launcher does **not** globally disable reasoning. Reasoning is controlled per Action: checkpoints declared `thinking: off` receive llama.cpp's explicit off mapping, while reasoning-capable checkpoints may use the model/server default. This keeps one single-slot 65K server useful for both deterministic-style structured Actions and the few Actions that intentionally request reasoning. Structured Actions may use JSON mode when declared, but LabFlow's own parser/schema validator remains authoritative; provider-side structure enforcement is never trusted as the only validation layer.

`labflow_engine.sh` is LAN-ready by default: it binds llama-server to `0.0.0.0:8080`, passes `--cors-origins` when supported, prints usable LAN/mDNS endpoints, and warns when Fedora `firewalld` appears to block the port. Override with `LABFLOW_HOST`, `LABFLOW_PORT` and `LABFLOW_CORS_ORIGINS` or the corresponding CLI options. For a stricter trusted-LAN setup, set `--cors-origins` to the actual LabFlow origin and optionally protect llama-server with an API key; do not expose it to untrusted networks. Additional GPU/KV-cache flags remain machine-specific and are intentionally outside the provider contract.

## Thinking and non-thinking models

Every AI checkpoint declares `thinking: off|auto|on`. This Action policy is the normal default. Settings exposes an explicit override:

- `auto`: follow the Action policy;
- `off`: force no thinking where the selected model permits it;
- `on`: force thinking where the selected model supports it.

Model capability is normalized as `none`, `optional`, `required` or `unknown`. `off` and `on` are **preferences**, not unconditional commands. A non-reasoning model ignores an `on` preference. A reasoning-required model wins over an incompatible `off` preference. An unknown model normally receives no speculative override; providers explicitly marked safe for a server-level override (currently llama.cpp) may still honor an Action's `off`/`on` preference while keeping model capability reported as unknown. Dynamic router aliases such as `openrouter/free` or `openrouter/auto` remain `unknown` when their catalogue row omits reasoning metadata: omission is not interpreted as proof that reasoning can be disabled. The requested, detected and effective states are retained in Action diagnostics/history.

Current declared mappings are:

| Provider | Off | On |
| --- | --- | --- |
| Z.AI | `thinking.type = disabled` | `thinking.type = enabled` |
| LM Studio | `reasoning_effort = none`, `chat_template_kwargs.enable_thinking = false` | `reasoning_effort = medium`, `enable_thinking = true` |
| Ollama OpenAI-compatible | `reasoning_effort = none` | `reasoning_effort = medium` |
| OpenAI | `reasoning_effort = none` | `reasoning_effort = medium` |
| OpenRouter | `reasoning.effort = none` | `reasoning.effort = medium` |
| llama.cpp | `reasoning_effort = none`, `chat_template_kwargs.enable_thinking = false`, final-only prompt guard, streamed runtime `reasoning_end` fallback | `reasoning_effort = medium`, `enable_thinking = true` |
| NVIDIA NIM | `chat_template_kwargs.enable_thinking = false` | `chat_template_kwargs.enable_thinking = true` |
| Gemini, custom | model default | model default |

Capability comes from provider model metadata when available, including OpenRouter reasoning parameters, Ollama's model `capabilities`, and LM Studio's loaded-instance `reasoning.allowed_options`; known OpenAI/Z.AI families supply a conservative built-in classification. An unsupported explicit mode safely degrades to `auto`; LabFlow never guesses undocumented request fields. Cloud/router connection probes use provider-default (`auto`) reasoning so a health check cannot pass with a payload that differs materially from what a reasoning-required route accepts. Only adapters explicitly marked safe for a local override (currently llama.cpp) may request `off` during their tiny probe. If a normal request still receives HTTP 400 explicitly stating that reasoning is mandatory/cannot be disabled, the transport performs exactly one **technical compatibility retry** with all explicit disable controls and the final-only thinking guard removed. This does not consume an Action semantic retry and is recorded in diagnostics/history.

Provider reasoning is normalized separately from final content. LabFlow accepts common `reasoning`, `reasoning_content`, text-part arrays and streamed reasoning fields. Reasoning may be displayed as progress, but only final content satisfies the Action response contract. An empty final answer reports its `finish_reason` and whether reasoning consumed the available output budget. `auto` never triggers a capability probe: known/detected metadata is used when present and unknown capability leaves the provider default untouched.

## Output formats, streaming and budgets

- `tokenParam` selects `max_tokens` or `max_completion_tokens` per provider.
- JSON Schema and JSON mode are sent only when declared by the provider.
- Temperature and stream-usage options are sent only when supported.
- Z.AI streaming deliberately omits OpenAI's `stream_options` extension because it is not part of Z.AI's documented Chat Completions request. Usage is still parsed when Z.AI returns it and otherwise estimated locally.
- Streaming and non-streaming responses use the same normalized result contract.
- Action output targets are clamped by detected model/provider ceilings and researcher caps. Unknown ceilings remain unknown; the transport does not invent a global maximum.
- Every AI step has an explicit operational `max_input_tokens` cap. Context preflight uses the tighter of this Action cap and model/runtime context headroom, reserves the Action target output first, and compacts deterministically before reporting a genuine context overflow. A 200K model context therefore never becomes permission for a 200K LabFlow prompt.
- Rate-limit handling never changes the selected model. Every provider request makes one HTTP attempt. HTTP 429 and provider codes `1302`/`1303`/`1305`/`1312` are surfaced immediately with `Retry-After` when present; quota codes `1304`/`1308`/`1310` also fail immediately. LabFlow keeps no transport backoff, hidden retry, persisted cooldown or client pacing. Multi-request Action sequences stop at the first provider throttle and preserve completed work; a later explicit researcher action may try again.


## Semantic request vs transport metadata

LabFlow keeps the model-visible task separate from provider transport configuration. Action/Assistant Context Packs may contain only task-relevant experiment/page data. Provider/model selection, endpoint, timeout, reasoning controls, `reasoning_format`, `response_format`, `chat_template_kwargs` and similar fields belong to `transport.js` and are added only to the HTTP body when the selected provider requires them.

Settings and Logs are runtime/debug surfaces: their provider configuration and diagnostic contents are deliberately excluded from Assistant Context Packs. The user request is carried once as `<user_request>` rather than duplicated inside the Context Pack.

Retries caused by browser/network/provider server failures resend the same clean semantic request. Raw HTTP/provider error bodies are never appended to a retry prompt. Only semantic contract failures may feed back bounded validation errors plus the previous **assistant output**, never the transport request/response envelope.

The response path is likewise one-way: raw provider envelope → assistant content extraction → optional reasoning-envelope normalization → structured parsing/validation. Structured Action schemas are closed (`additionalProperties: false`), so transport-like keys cannot silently become persisted Action data.

Debug logging presents semantic messages and transport metadata as separate events. Credential-bearing headers are redacted before diagnostic logging; the logger's generic secret sanitizer remains a second local safeguard.

## Connection test

**Detect** reads the provider, endpoint/base URL and API key exactly as currently visible in Settings; it also respects the visible model when one is already selected. For providers with a live model catalogue, an empty model field is valid at the start of Detect: LabFlow first reads the catalogue from that same endpoint, populates/selects a real returned model, and only then performs a minimal Chat Completions probe against that exact endpoint/key/model. A required missing API key, unreachable catalogue, empty required catalogue, authentication failure, DNS/CORS/LAN failure, or failed Chat Completions probe is a Detect error. Static/built-in metadata alone never produces a green connectivity result.

**Save & test connection** validates and probes the exact visible provider, model, endpoint and provider-scoped key first, then persists them only after a successful probe. The probe is a minimal non-streaming request through the unified transport with `Reply only with OK.`, a small output ceiling and a shorter timeout. Cloud/router probes keep reasoning at the provider default; an adapter may opt into a safe local probe override only when explicitly declared (llama.cpp does). The probe performs no capability/model discovery and does not change the selected model. HTTP 429 and known provider limit/quota codes produce a reachable-but-limited result with provider code/message and `Retry-After` when available; they create no local cooldown and do not block a later explicit request. The provider output includes the model reply plus measured timing, token usage or a clearly marked estimate, payload size, finish reason and request ID. It does not send experiment data.

### Unified provider transport

`transport.js` shares one header/auth builder (`providerAuthHeaders`), one URL resolver (`resolveChatUrl`/`resolveModelsUrl`), one metadata fetch (`metadataFetch`/`fetchJson`) and one error classifier (`parseProviderError`/`limitInfo`) for connection test, capability Detect and model listing. Every provider request is a direct browser fetch to the configured endpoint. `listModels`, `resolveModelCapabilities`, `benchmarkTokensPerSecond` and `testConnection` are strategies inside the same transport contract rather than separate provider UI workflows. `send()` normally performs one HTTP request and surfaces provider throttles unchanged. Its only transport-level compatibility retry is a single retry after an explicit HTTP 400 reasoning-required rejection of a disable-reasoning override; that retry removes the incompatible transport fields and matching final-only guard. Semantic Action retries, when declared, remain a separate runner concern and are not consumed by this compatibility recovery.

Transport logs expose simple phase timings without secrets: request preparation, response headers, first streamed token, generation duration, request duration, finalization, total duration and HTTP request count. The live UI shows token-oriented telemetry; raw SSE events/wire bytes remain diagnostic because chunk count and envelope size do not equal token use. Action context logs separately expose capability lookup, Context Pack preparation and compaction passes.

Errors retain the provider response and are classified separately as browser/CORS, authentication, unavailable model, context overflow, output-length contract failure, transient rate/concurrency/capacity limit, quota exhaustion or provider server failure. The transport never repeats a provider request automatically. The Action runner may repeat only a failed work unit when that Action explicitly declares a bounded semantic retry; provider rate/quota errors are excluded from semantic retry. Diagnostic helpers have one public API: `networkMessage`, `statusHint`, `errorSummary` and `contextNote`.

### Browser CORS and direct transport

LabFlow is intentionally a static vanilla-JS frontend and has no provider relay/backend. Local/LAN and hosted providers are contacted directly from the browser. Local/LAN access therefore requires the server to bind to a reachable interface, allow the LabFlow origin with CORS, and satisfy the browser Local Network Access policy. Hosted APIs must expose browser-compatible CORS for the LabFlow origin. If the browser blocks a preflight or otherwise exposes no HTTP response, Detect/Save & test fail explicitly and Logs classify the failure as browser/network rather than authentication.
