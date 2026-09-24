---
title: Privacy and local-first boundary
section: Engineering reference
summary: Browser-local scientific state, credential storage, external requests and diagnostic redaction.
order: 25
---

# Privacy and local-first boundary

LabFlow is a local-first static browser application. Scientific parsing, deterministic analysis, validation, context construction, persistence and export generation run client-side.

## Local assets and runtime

LabFlow avoids analytics/tracking services, remote fonts, service-worker infrastructure and hidden application backends. Core UI/runtime assets are shipped with the application. Browser Local is the explicit exception: when selected, LabFlow may fetch the pinned wllama runtime and the chosen GGUF model, then inference runs on-device in the browser.

## Browser persistence

Scientific working state and immutable source snapshot are persisted locally so a session can be restored. UI/provider/NOMAD preferences use browser storage. Provider API keys and the optional future NOMAD token are stored separately from scientific/export payloads.

Resetting the scientific session does not silently erase unrelated provider credentials unless the corresponding settings are explicitly cleared.

## External network requests

External model inference requests occur only through the selected provider capability. For Browser Local, inference stays in the page, but first-use runtime/model preparation may fetch the pinned wllama runtime from jsDelivr and the selected GGUF from its configured model URL. External providers are contacted directly; there is no hidden relay.

The current NOMAD direct-upload control is a non-networking stub. Package generation remains local.

## Context minimization

Actions/Assistant receive bounded semantic context required for the requested task. Provider settings, API keys and unrelated Settings diagnostics are not scientific context and are not inserted into model prompts.

Cabinet and KB context remain labelled reference data so a model cannot legitimately treat them as evidence from the current experiment.

## Diagnostics

Credential-bearing headers/fields and common secret names are redacted before events enter the logger. Diagnostics may contain endpoint host/path, HTTP status, provider error codes/messages, request timing and bounded sanitized response details.

A new network integration must document what leaves the browser, what credentials it uses, and how a user can tell that a request will occur.

## Design reference provenance

Design context may include researcher-curated Cabinet resources and sourced KB entries. They remain labelled reference data. Exact `CABINET:<id>` and `KB:<id>` markers identify provenance but do not reveal credentials and do not assert current-experiment use. Contact information from Workspace profiles is not required for Design inference.
