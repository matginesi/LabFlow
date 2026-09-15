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

Each event carries timestamp, monotonic/performance time, level, scope, event name and sanitized structured data. Console output promotes only useful scalar fields; the structured payload remains expandable.

## Correlation

Provider detection/tests and Action requests use correlation identifiers so network, transport, model-output and semantic-validation events can be followed as one operation.

A successful HTTP response that produces malformed/truncated/schema-invalid/semantically-invalid Action output is logged as a **rejected response**, linked to the originating request. Transport success is never presented as semantic success.

## Privacy

Logger sanitization redacts credential-like keys, Authorization/Bearer values, passwords, access tokens, secrets and query tokens before buffering or printing.

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
