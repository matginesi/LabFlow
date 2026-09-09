# AI provider console

LabFlow exposes a small diagnostic API in browser DevTools. It uses the same provider registry and transport as Actions, but does not include experiment data.

```js
LabFlow.AIConsole.help()
LabFlow.AIConsole.providers()
await LabFlow.AIConsole.models("openrouter")
await LabFlow.AIConsole.probe("zai", "glm-4.7-flash")
await LabFlow.AIConsole.doctor("nvidia", {model: "nvidia/nemotron-3.5-lightning-30b-a3b"})
```

`models()` prints the live provider catalogue. OpenRouter entries retain pricing metadata and are labelled `free` when the provider reports zero prompt/completion pricing or the slug is a `:free` variant.

`probe()` sends one bounded Chat Completions request and returns a structured result. It never retries automatically. A browser status of 0 means the browser did not expose an HTTP response; use the reported category to distinguish timeout/network/CORS from HTTP authentication, quota or model errors.

`doctor()` runs catalogue discovery and one model probe and returns both results.

The API key is read from LabFlow provider storage unless `apiKey` is passed explicitly. The console never prints the key.

## Terminal probe (recommended for cloud-provider diagnosis)

This bypasses browser CORS completely and uses only the Python standard library.

```bash
export ZAI_API_KEY='...'
python tools/ai_probe.py zai --model glm-4.7-flash

export NVIDIA_API_KEY='...'
python tools/ai_probe.py nvidia --list-models
python tools/ai_probe.py nvidia --model nvidia/nemotron-3.5-lightning-30b-a3b

export OPENROUTER_API_KEY='...'
python tools/ai_probe.py openrouter --list-models --free-only
python tools/ai_probe.py openrouter --model openrouter/free
```

If the terminal probe succeeds but the browser test reports no HTTP status, the provider/API key/model are working and the remaining problem is browser transport/CORS.
