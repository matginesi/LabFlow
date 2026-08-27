# Privacy and local-first boundary

LabFlow is a static local-first browser application. Scientific parsing, analysis, validation, Knowledge Base search, browser persistence and export generation do not require a LabFlow backend.

## Local runtime

LabFlow loads its runtime assets locally. The POC does not intentionally include trackers, analytics, service workers, WebSockets or remote fonts/assets.

The experiment lifecycle is browser-local unless an AI Action explicitly contacts the configured provider.

## Browser persistence

LabFlow is **not memory-only**:

- the immutable source snapshot and current scientific Working Copy are autosaved in IndexedDB so the session can be restored;
- provider/model/UI preferences are stored in browser localStorage;
- API keys are stored in browser localStorage separately by provider;
- provider rate-limit/cooldown state is not persisted; a 429 and optional `Retry-After` exist only in the current request result;
- **Reset session** clears the persisted scientific session/RAW snapshot but keeps provider credentials/preferences unless separately changed.

Request diagnostics may contain HTTP status, provider code/message, timing and `Retry-After`; they do not contain API-key values.

## External AI requests

`assets/js/ai/transport.js` is the normal external runtime boundary. AI requests are triggered by declared AI Actions, Assistant use, connection tests, or the optional automatic import enrichment when a provider is configured.

Requests use:

```text
credentials: omit
cache: no-store
```

AI Actions send a bounded Context Pack selected for that Action. RAW curves and the full experiment are not sent by default.

A connection test sends only a tiny provider probe and no experiment context.

## API keys

API keys are provider-scoped and remain browser-local. They are used only to build the `Authorization` header for the selected provider request.

The structured logger redacts common credential fields such as API keys, Authorization headers, passwords, tokens and secrets. No `.env` file is required or shipped for normal browser use, and `.env` is excluded by `.gitignore`.

## Exports

The original uploaded ZIP is immutable. Save/autosave operate on LabFlow's internal browser representation. Explicit LabFlow ZIP, Report/Paper and NOMAD exports create new derived files and never overwrite the source archive.

## Local providers

LM Studio/Ollama/llama.cpp traffic remains on the configured local network endpoint, but it is still a browser network request and is subject to browser origin/CORS rules.
