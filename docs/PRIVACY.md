# Privacy and local-first boundary

LabFlow is a local-first browser application. Scientific parsing, analysis, validation, experiment-context retrieval, browser persistence and export generation remain client-side. LabFlow does not require an application backend for scientific state or AI transport.

## Local runtime

LabFlow loads its runtime assets locally. The POC does not intentionally include trackers, analytics, service workers, WebSockets or remote fonts/assets.

The experiment lifecycle is browser-local unless an AI Action explicitly contacts the configured provider. The current NOMAD direct-upload UI is a stub and does not contact NOMAD.

## Browser persistence

LabFlow is **not memory-only**:

- the immutable source snapshot and current scientific LabFlow Data are autosaved in IndexedDB so the session can be restored;
- provider/model/UI preferences and future NOMAD uploader configuration are stored in browser localStorage;
- AI API keys are stored in browser localStorage separately by provider;
- the optional NOMAD API token is stored in its own browser-local key, separately from export options and manifests;
- provider rate-limit/cooldown state is not persisted; a 429 and optional `Retry-After` exist only in the current request result;
- **Reset session** clears the persisted scientific session/RAW snapshot but keeps provider credentials/preferences unless separately changed.

Request diagnostics may contain HTTP status, provider code/message, timing and `Retry-After`; they do not contain API-key values. Semantic messages and transport metadata are logged separately, and credential-bearing headers are explicitly redacted before they reach the diagnostic event.

## External AI requests

`assets/js/ai/transport.js` is the browser transport boundary. AI requests are triggered by declared AI Actions, Assistant use, connection tests, or the optional automatic import enrichment when a provider is configured. Hosted and local/LAN providers use the exact endpoint configured in Settings. There is no hidden proxy/relay fallback, so browser CORS/network failures remain explicit.

Requests use:

```text
credentials: omit
cache: no-store
```

AI Actions send a bounded Context Pack selected for that Action. RAW curves and the full experiment are not sent by default. Settings/provider configuration and Logs contents are excluded from model-visible Context Packs. Provider transport metadata (model routing, endpoint-derived request options, reasoning controls and response-format controls) is kept outside semantic prompt content.

A connection test sends only a tiny provider probe and no experiment context.

## API keys

AI API keys are provider-scoped and are stored in browser localStorage. They are used directly by the browser request to the selected AI provider endpoint. NOMAD uploader settings/token are also browser-local, but the present upload stub never reads them into a network request because remote upload is not implemented.

The structured logger redacts common credential fields such as API keys, Authorization headers, passwords, tokens and secrets. No `.env` file is required or shipped for normal browser use, and `.env` is excluded by `.gitignore`.

## Exports

The original uploaded ZIP is immutable. Save/autosave operate on LabFlow's internal browser representation. Explicit LabFlow ZIP and NOMAD exports create new derived files and never overwrite the source archive. NOMAD connection settings/token are not embedded in those export manifests.

## Local providers

LM Studio/Ollama/llama.cpp traffic remains on the configured local network endpoint, but it is still a browser network request and is subject to browser origin/CORS rules.
