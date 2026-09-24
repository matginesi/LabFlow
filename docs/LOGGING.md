---
title: Logging and diagnostics
section: Engineering reference
summary: Structured browser diagnostics, correlation, redaction and failure interpretation.
order: 20
---

# Logging and diagnostics

LabFlow keeps structured browser diagnostics enabled during the POC because import recovery and direct-browser AI transport need inspectable failure evidence.

## Runtime behavior

Default logging is INFO-level to console plus a bounded in-memory ring buffer. Settings → Diagnostics exposes filtering, recent errors and downloadable JSONL. Large strings are clipped before buffering so diagnostics cannot grow without bound during long AI sessions.

Each event carries timestamp, monotonic/performance time, level, scope, event name and sanitized structured data. Console output promotes only useful scalar fields; the structured payload remains expandable. Entries also carry route, workspace, experiment and process identifiers when they exist, so a report can be tied to one piece of work without exposing its content.

## Correlation

Provider detection/tests and Action requests use correlation identifiers so network, transport, model-output and semantic-validation events can be followed as one operation.

A successful HTTP response that produces malformed/truncated/schema-invalid/semantically-invalid Action output is logged as a **rejected response**, linked to the originating request. Transport success is never presented as semantic success.

## Privacy

One sanitizer (`LF.Redact`, `assets/js/redact.js`) serves logging, diagnostics and shareable export projections.

- At buffer time, credential-like keys, Authorization/Bearer/Basic values, key-shaped tokens, URL userinfo, credential query parameters and direct personal identifiers (contact names, emails, phone-like fields, personal notes inside a contact container) are replaced with `[redacted]`.
- Diagnostic exports are privacy-safe by default: the JSONL export and the diagnostic bundle drop prompts, provider responses and free-text fields while keeping timing, HTTP status, provider/model, scope, event name and correlation identifiers. The in-page buffer keeps the full locally inspectable payload.
- Organization names, scientific identifiers, workspace/experiment/process IDs, file sizes and hashes are technical metadata and are not redacted.
- Assistant session memory logs only structured state (`focusKind`, `focusId`, last intent/target, cache-hit counters) and never the researcher's question or answer text.

Do not log RAW file bodies or large research payloads by default. Prefer IDs, paths, sizes, hashes, counts and short bounded evidence excerpts when they are necessary for diagnosis.

## Useful scopes

Common scopes include state, storage, importer/parser, pipeline/analysis, AI/network, Assistant, NOMAD and UI. Scope names are diagnostic metadata, not API contracts.

## Failure interpretation

Keep these failure classes distinct:

- browser/network/CORS: no provider HTTP response;
- provider HTTP error: authentication/quota/model/server response exists;
- model content rejection: transport succeeded, semantic contract failed;
- deterministic contract failure: local scientific/state invariant failed.

This separation is necessary for actionable support and for avoiding misleading “provider down” diagnoses.
