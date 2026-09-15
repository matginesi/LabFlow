---
title: Privacy and local-first boundary
section: Engineering reference
summary: Browser-local scientific state, credential storage, external requests and diagnostic redaction.
order: 25
---

# Privacy and local-first boundary

LabFlow is a local-first static browser application. Scientific parsing, deterministic analysis, validation, context construction, persistence and export generation run client-side.

## Local assets and runtime

The POC intentionally avoids analytics/tracking services, remote fonts, service-worker infrastructure and hidden application backends. Runtime assets are shipped with the application.

## Browser persistence

Scientific working state and immutable source snapshot are persisted locally so a session can be restored. UI/provider/NOMAD preferences use browser storage. Provider API keys and the optional future NOMAD token are stored separately from scientific/export payloads.

Resetting the scientific session does not silently erase unrelated provider credentials unless the corresponding settings are explicitly cleared.

## External network requests

External requests occur only through explicit capabilities such as an AI Action/Assistant/provider test. The configured provider endpoint is contacted directly; there is no hidden relay.

The current NOMAD direct-upload control is a non-networking stub. Package generation remains local.

## Context minimization

Actions/Assistant receive bounded semantic context required for the requested task. Provider settings, API keys and unrelated Settings diagnostics are not scientific context and are not inserted into model prompts.

Cabinet and KB context remain labelled reference data so a model cannot legitimately treat them as evidence from the current experiment.

## Diagnostics

Credential-bearing headers/fields and common secret names are redacted before events enter the logger. Diagnostics may contain endpoint host/path, HTTP status, provider error codes/messages, request timing and bounded sanitized response details.

A new network integration must document what leaves the browser, what credentials it uses, and how a user can tell that a request will occur.
