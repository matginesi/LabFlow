# JavaScript logging and diagnostics

LabFlow includes one local JavaScript diagnostic system for the whole static POC. It writes structured entries to the browser console and keeps a bounded in-memory copy for inspection. It never transmits, persists or uploads logs.

## Goals

The logger makes page initialization, rendering, user-triggered operations, exports and failures understandable without exposing credentials or creating a second analytics system.

Every entry has:

- ISO timestamp;
- elapsed time since the page bootstrap;
- level;
- scope;
- event name;
- current LabFlow page;
- local entry filename;
- sanitized context.

Console entries use the form:

```text
[LabFlow][INFO][app] page.init-start
[LabFlow][INFO][export] download.started
[LabFlow][ERROR][app] page.init-failed
```

## Levels

The default level is `info`.

- `debug` — detailed local state transitions and UI diagnostics;
- `info` — page lifecycle, module readiness, view changes and exports;
- `warn` — recoverable rendering, validation or document issues;
- `error` — uncaught JavaScript errors, rejected promises, missing assets and failed operations.

Enable detailed logging for the current page by adding `lf_debug=1` to an HTTP-hosted URL, or from the console:

```javascript
LabFlowLog.setLevel("debug")
```

## API

```javascript
const Log = LabFlowLogger.child("module-name")

Log.debug("state.changed", { count: 3 })
Log.info("operation.started", { type: "pdf" })
Log.warn("document.incomplete", { documentId: "PROJECT" })
Log.error("operation.failed", { error })

const finish = Log.time("operation", { type: "pdf" })
finish({ status: "success" })
```

Inspect the current bounded log buffer with:

```javascript
LabFlowLog.snapshot()
```

Clear only the in-memory diagnostic buffer with:

```javascript
LabFlowLog.clear()
```

## Automatic diagnostics

The bootstrap logger records:

- logger readiness;
- DOM readiness and window load timing;
- uncaught JavaScript errors;
- unhandled promise rejections;
- failed script, stylesheet and image resources;
- page initialization and renderer failures;
- theme application;
- search-index creation;
- report draft application;
- PDF, DOCX, XLSX and bundle generation;
- browser download dispatch;
- state reset and important in-memory state updates;
- AI & Models view changes;
- Tools workspace changes;
- documentation rendering warnings and failures.

## Safety and privacy

Logging remains console-only and memory-only.

The logger:

- performs no request;
- uses no cookies or browser storage;
- has no telemetry or analytics endpoint;
- never intercepts or replaces the native console;
- redacts context keys matching passwords, API keys, tokens, credentials, authorization values and secrets;
- limits string length, collection size, object depth and retained entries;
- reports only the local asset filename for resource failures rather than a full filesystem path;
- does not log report text, assistant questions, document contents or uploaded file contents by default.

A module should log identifiers, counts, operation types, status and timing—not scientific payloads or credentials.

## File-origin compatibility

Direct `file://` usage is supported. LabFlow does not call `history.replaceState` for local files and does not append appearance parameters to local navigation. This avoids unique-origin security errors while preserving ordinary project and view query parameters.

On GitHub Pages or another static HTTP host, theme, palette and density may continue to travel through internal navigation parameters.

## Agent requirements

When adding or modifying JavaScript:

1. use `LabFlowLogger.child("scope")` rather than ad-hoc `console.log` calls;
2. log operation boundaries and actionable failures;
3. never log sensitive field values or complete scientific records;
4. let errors propagate after logging when the caller must handle them;
5. keep fallback UI useful when an optional module is missing;
6. verify both `file://` and static HTTP operation;
7. avoid adding remote logging, telemetry or persistent diagnostic storage.
