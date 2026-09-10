---
title: Troubleshooting
section: Researcher guide
summary: Diagnose import, Action, provider and structured-output failures without confusing scientific uncertainty with technical errors.
order: 40
---

# Troubleshooting LabFlow

## Healthy import

A healthy import finishes without any AI request. Check:

```js
LabFlow.Data.summary()
LabFlow.Data.validate()
LabFlow.Data.pipeline()
```

The pipeline should be `ready`; Review may still contain semantic decisions, which is not an import failure.

## Naming looks wrong

Inspect:

```js
LabFlow.Data.tree()
LabFlow.Data.experiments()
LabFlow.Data.samples()
```

Canonical naming is deterministic. If a scientific token is genuinely ambiguous, Review should expose it rather than silently guessing.

## `MODEL_OUTPUT_INVALID`

This is a structured/semantic contract failure. Logs include invalid JSON/schema/semantic details where available. For `design.infer`, incomplete coverage is retried inside the same Action; only after bounded retries are exhausted does the selected experiment expose **Retry inference**.

## `MODEL_OUTPUT_TRUNCATED`

The model/server stopped before returning a complete usable output. Reduce model verbosity/context or use a model with sufficient completion capacity.

## `MODEL_CONTEXT_LENGTH`

The request exceeds the configured model/server context. Inspect the Action's bounded input/output budget and local server context size.

## `429` / rate limiting

LabFlow surfaces provider throttling and does not create hidden automatic request loops. Retry later or use another configured provider/model.


## Local provider works on the computer but not from another device

`127.0.0.1` and `localhost` point to the device running the browser. From a phone, they point to the phone, not to the workstation. In **Settings → Connection**, use a LAN-resolvable host such as `http://fedora:8080/v1`, `http://fedora.local:8080/v1`, or the workstation private IP. The server must listen on a LAN interface and allow the LabFlow origin with CORS.

For llama.cpp, bind `llama-server` with `--host 0.0.0.0` (or the intended interface) and configure `--cors-origins`. LM Studio must enable **Serve on Local Network** and CORS. Ollama must be exposed with `OLLAMA_HOST` and allow the LabFlow origin through `OLLAMA_ORIGINS`. If LabFlow is opened from an HTTPS host such as GitHub Pages, the browser may additionally require Local Network permission; if that browser cannot/does not allow HTTPS → HTTP LAN access, use an HTTPS model endpoint or a compatible local LabFlow origin.

## Local provider works but model name shows a path

Current LabFlow should display only the basename in user-visible model/log surfaces while retaining the exact full ID internally. A full visible path is a regression.

## Design says Needs context

For Design there is no separate successful “insufficient evidence” state. The Action attempts the missing domains and retries incomplete output internally. If all attempts fail, review the available evidence manually or use **Retry inference** for another provider run.

## What to copy when reporting a bug

Include the relevant log entries, Action ID, error code, pipeline status, and `LabFlow.Data.summary()` / `validate()` output. Do not include API keys.
