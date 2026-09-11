# AI provider console

LabFlow exposes a small diagnostic API in browser DevTools. It uses the same provider registry and transport as Actions, but does not include experiment data.

```js
LabFlow.AIConsole.help()
LabFlow.AIConsole.providers()
await LabFlow.AIConsole.models("openrouter")
await LabFlow.AIConsole.probe("zai", "glm-4.7-flash")
await LabFlow.AIConsole.doctor("openrouter", {model: "openrouter/free"})
```

`models()` prints the live provider catalogue. OpenRouter entries retain pricing metadata and are labelled `free` when the provider reports zero prompt/completion pricing or the slug is a `:free` variant.

`probe()` sends one bounded Chat Completions request and returns a structured result. It never retries automatically. A browser status of 0 means the browser did not expose an HTTP response; use the reported category to distinguish timeout/network/CORS from HTTP authentication, quota or model errors.

`doctor()` runs catalogue discovery and one model probe and returns both results. The Settings **Detect** operation is stricter: it uses the visible provider/endpoint/key and the visible model when one is already selected. For catalogue-backed providers it may start with no model selected, but it must first populate a real model from the catalogue returned by that exact endpoint and then pass a live Chat Completions probe before reporting success. Required missing credentials, catalogue failures/empty required catalogues, and probe failures are errors.

The API key is read from LabFlow provider storage unless `apiKey` is passed explicitly. The console never prints the key.

## Terminal probe (recommended for cloud-provider diagnosis)

This bypasses browser CORS completely and uses only the Python standard library.

```bash
export ZAI_API_KEY='...'
python tools/ai_probe.py zai --model glm-4.7-flash


export OPENROUTER_API_KEY='...'
python tools/ai_probe.py openrouter --list-models --free-only
python tools/ai_probe.py openrouter --model openrouter/free
```

If the terminal probe succeeds but the browser test reports no HTTP status, the provider/API key/model are working and the remaining problem is browser transport/CORS.


## Browser transport note

`LabFlow.AIConsole.doctor(...)` exercises the same direct-browser transport as Settings. No relay/backend fallback is used; browser CORS/network failures are reported explicitly.

## Reasoning compatibility

Connection probes use provider-default reasoning for cloud/router providers. A provider-specific local adapter may opt into a safe probe override (llama.cpp does). If a real request is explicitly rejected because reasoning is mandatory, LabFlow performs one transport compatibility retry without disable-reasoning fields; this is logged separately and does not consume an Action semantic retry.
