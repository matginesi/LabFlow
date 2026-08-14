# JavaScript Logging

LabFlow POC keeps structured browser diagnostics enabled while the data model, recovery rules and AI integration are being validated. More verbose levels remain available when troubleshooting.

## Defaults

- Logging: enabled.
- Level: `INFO`.
- Console output: enabled.
- In-memory ring buffer: enabled.
- Buffer limit: 1200 entries.
- UI interaction tracing: disabled by default.
- network request tracing: enabled.

Change these under **Settings → Logging configuration**. Inspect events on the dedicated **Logs** page, filter by level/scope/text, expand complete sanitized details, or download JSONL.

## Format

Console messages use:

```text
[LabFlow][LEVEL][scope] event
```

Each buffered entry contains:

- ISO timestamp;
- `performance.now()` time;
- level;
- scope/module;
- event name;
- structured data.

Typical scopes include:

- `app`
- `state`
- `storage`
- `packages`
- `parser`
- `analysis`
- `prompts`
- `ai`
- `assistant`
- `network`
- `report`
- `nomad`
- `ui`
- `ui.event`
- `window`

## Important traces

### Dataset import

The expected chain is approximately:

```text
app.dataset.import
parser.dataset.parse
parser.dataset.manifest
parser.dataset.summary-fw
parser.dataset.summary-rv
parser.dataset.jv-fallback
parser.dataset.jv-file
parser.dataset.recovery
analysis.experiment.analyze
analysis.measurement.derive
state.experiment.set
storage.working-copy.save
```

This makes it possible to identify where a sample name, missing scan, metric, quality flag or ranking decision came from.

### AI

AI logging records:

- action ID;
- provider and model;
- endpoint;
- message count and character counts;
- prompt/context sizes;
- direct SSE/JSON request lifecycle, including stream events, bytes and time to first content;
- response status;
- failed HTTP status, provider code/message, request ID and sanitized response body when available;
- latency;
- returned content/reasoning character counts;
- structured-JSON parse strategy, safe-syntax cleanup and detailed failure diagnosis;
- provider `finish_reason`, JSON-mode state and requested reasoning effort.

If the provider returns HTTP 200 but the model output is empty, truncated,
malformed JSON, or violates an Action contract, LabFlow records an `ERROR`
event named `assistant.response.rejected`. It shares the transport
`requestLogId`, so **Provider transactions** shows the call as **Rejected
response** and exposes the sanitized raw provider envelope, model output,
finish reason, token usage, validation error, stack and cause. A successful
HTTP response is therefore never mistaken for a usable Action result.

It does **not** intentionally dump API keys. Common secret fields are redacted by the logger.

### Errors

Global hooks capture:

- uncaught JavaScript errors;
- unhandled promise rejections;
- network failures;
- module-level errors with stack traces when available.

## Privacy / redaction

The logger redacts common fields such as `apiKey`, `Authorization`, passwords, access tokens and secrets.

Do not add RAW file contents, full API credentials or sensitive research data to debug objects unless it is specifically required to diagnose a problem. Prefer filenames, IDs, byte counts, line counts, checks, hashes and short evidence summaries.
