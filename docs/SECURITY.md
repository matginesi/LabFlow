---
title: Security posture
section: Engineering reference
summary: POC threat boundaries for local storage, provider credentials, browser networking and imported content.
order: 26
---

# Security posture

LabFlow is a browser POC handling user-supplied archives and optional external API credentials. Its security posture is intentionally narrow and explicit rather than production-certified.

## Trust boundaries

- Uploaded ZIP/file content is untrusted input and is parsed locally.
- Persisted LabFlow snapshots are validated before restore.
- Provider responses are untrusted external content and must pass Action-result validation before storage/use.
- Provider/API credentials are secrets and must never enter scientific context or diagnostic output.
- Generated HTML/Markdown rendering must continue using the application's escaping/sanitization helpers rather than raw source insertion.

## Network exposure

The static app has no server-side secret store. AI credentials used from the browser are visible to that browser profile and should be treated accordingly. Local llama.cpp defaults to loopback; LAN binding is explicit.

## Imported archive handling

Archive path identity is preserved, but import/build/export code should reject unsafe parent traversal when materializing files outside the in-memory ZIP abstraction. Distributable fixture/build tooling should never extract arbitrary archive paths outside its intended destination.

## Production gap

A production multi-user deployment would require a separate security design for authentication, server-side secret handling, authorization, tenant isolation, audit retention and secure remote persistence. Those are deliberately outside the current static POC contract.
