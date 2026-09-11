# JavaScript Logging

LabFlow POC keeps structured browser diagnostics enabled while the data model, recovery rules and AI integration are being validated. More verbose levels remain available when troubleshooting.

## Defaults

- Logging: enabled.
- Level: `INFO`.
- Console output: enabled.
- In-memory ring buffer: enabled.
- Buffer limit: 2500 entries.
- UI interaction tracing: disabled by default.
- network request tracing: enabled.

Inspect events under **Settings → Diagnostics**, filter by level/scope/text, expand bounded sanitized payload previews on demand, or download the buffered JSONL diagnostic trace. Oversized strings are clipped before they enter the in-memory logger so a long AI session cannot make Diagnostics itself exhaust the browser.

## Format

Console messages use a readable one-line summary followed by the expandable structured object:

```text
[LabFlow][15:11:34.221][+8253ms][LEVEL][scope] event · diagnosticId=... · provider=... · phase=... · transport=... · endpoint=... · status=... · elapsedMs=... · error=...
```

Only scalar diagnostic fields are promoted into the summary; the sanitized structured payload remains available as the second console argument and in Settings → Diagnostics.

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

- Action/feature ID and provider diagnostic correlation ID;
- provider, model and sanitized endpoint;
- explicit phase (`validate`, `catalogue`, `chat-probe`, `capabilities`, `persist` where applicable);
- direct-browser network route, target address space and request phase;
- message count and character counts;
- prompt/context sizes;
- direct SSE/JSON request lifecycle, including stream events, bytes and time to first content;
- response status;
- failed HTTP status, provider code/message, request ID and sanitized response body when available;
- latency;
- returned content/reasoning character counts;
- structured-JSON parse strategy, safe-syntax cleanup and detailed failure diagnosis;
- provider `finish_reason`, JSON-mode state and requested/effective reasoning policy;
- a `thinking.provider-required` warning when an endpoint rejects a disable-reasoning override, plus `reasoningCompatibilityRetry=true` on the recovered request metadata and the real HTTP request count.

If the provider returns HTTP 200 but the model output is empty, truncated,
malformed JSON, or violates an Action contract, LabFlow records an `ERROR`
event named `assistant.response.rejected`. It shares the transport
`requestLogId`, so the unified **Event stream** preserves the call as a **Rejected
response** and its lazy detail exposes the sanitized raw provider envelope,
model output, finish reason, token usage, validation error, stack and cause. A
successful HTTP response is therefore never mistaken for a usable Action result.

It does **not** intentionally dump API keys. Common secret fields are redacted by the logger.

### Provider diagnostics

**Detect** and **Save & test** use one diagnostic ID per operation and the canonical **Action Totem** for the full visible lifecycle. Settings → Diagnostics intentionally has one diagnostic surface: provider catalogue requests, chat requests, failures and the rest of LabFlow events all appear in the unified **Event stream**, with **Recent errors** kept above it for quick triage. A successful provider result still requires a completed live chat probe; catalogue metadata by itself is never reported as connectivity success.

Network routing is explicit in both the console and Settings → Diagnostics. `network.route` identifies the browser request to the endpoint configured in Settings and `network.direct-failed` records a browser/network failure before any HTTP response is exposed. Hosted and local providers use that configured endpoint directly. HTTP authentication/quota/server statuses remain provider failures and are not relabeled as CORS.

The Runtime snapshot includes `LABFLOW_BUILD`, which helps detect a stale GitHub/browser copy during debugging. The browser logger redacts credential-like keys and Bearer/query tokens before buffering or printing them.

### Errors

Global hooks capture:

- uncaught JavaScript errors;
- unhandled promise rejections;
- network failures;
- module-level errors with stack traces when available.

## Privacy / redaction

The logger redacts common fields such as `apiKey`, `Authorization`, passwords, access tokens and secrets.

Do not add RAW file contents, full API credentials or sensitive research data to debug objects unless it is specifically required to diagnose a problem. Prefer filenames, IDs, byte counts, line counts, checks, hashes and short evidence summaries.
