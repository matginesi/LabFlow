---
title: AI provider console
section: Researcher guide
summary: Browser and terminal diagnostics for provider catalogue, connectivity and model compatibility.
order: 32
---

# AI provider console

The DevTools API exercises the same provider registry/transport as Actions without including experiment data.

```js
LabFlow.AIConsole.help()
LabFlow.AIConsole.providers()
await LabFlow.AIConsole.models('openrouter')
await LabFlow.AIConsole.doctor('openrouter', { model: 'openrouter/free' })
```

`models()` queries the provider catalogue when supported. `doctor()` combines discovery with one bounded chat probe. A browser/network result with no exposed HTTP status indicates transport/CORS/private-network failure rather than a provider HTTP error.

## Terminal diagnosis

`tools/ai_probe.py` bypasses browser CORS and uses the same conceptual provider endpoint/model contract. This is useful to distinguish “endpoint/key/model works” from “browser is not permitted to call it.”

Example:

```bash
export OPENROUTER_API_KEY='...'
python tools/ai_probe.py openrouter --list-models --free-only
python tools/ai_probe.py openrouter --model openrouter/free

export GLM_API_KEY='...'
python tools/ai_probe.py glm --model glm-4.7-flash
```

The diagnostic tools never intentionally print the API key.
