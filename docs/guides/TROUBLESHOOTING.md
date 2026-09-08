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

This is a technical structured/semantic contract failure. Logs now include invalid JSON/schema/semantic details where available. It is different from `design.infer` returning `insufficient_evidence`, which is successful and shown as **Needs context**.

## `MODEL_OUTPUT_TRUNCATED`

The model/server stopped before returning a complete usable output. Reduce model verbosity/context or use a model with sufficient completion capacity.

## `MODEL_CONTEXT_LENGTH`

The request exceeds the configured model/server context. Inspect the Action's bounded input/output budget and local server context size.

## `429` / rate limiting

LabFlow surfaces provider throttling and does not create hidden automatic request loops. Retry later or use another configured provider/model.

## Local provider works but model name shows a path

Current LabFlow should display only the basename in user-visible model/log surfaces while retaining the exact full ID internally. A full visible path is a regression.

## Design says Needs context

This is not an error. It means the model returned `insufficient_evidence` for the selected experiment. Add/confirm Design evidence manually or leave the field unresolved.

## What to copy when reporting a bug

Include the relevant log entries, Action ID, error code, pipeline status, and `LabFlow.Data.summary()` / `validate()` output. Do not include API keys.
