---
title: Troubleshooting
section: Researcher guide
summary: Diagnose import, restore, AI/provider, Cabinet/KB and browser-runtime failures by boundary.
order: 90
---

# Troubleshooting

Diagnose the failing boundary first; do not treat every symptom as an AI or parser problem.

## Import fails before Results

Check Settings → Diagnostics for importer/parser/pipeline events. A structural contract failure should identify the invalid root/relation rather than continuing with partial scientific state.

Unknown files are normally preserved, not fatal. Duplicate basenames should remain distinct by full archive path.

## Restored workspace is rejected

Persisted scientific snapshots must satisfy the current snapshot contract. The POC intentionally fails obsolete/incompatible shapes rather than guessing a migration. Re-import the original RAW archive or use an export produced by the current build.

## Provider test has no HTTP status

The browser did not expose a provider response. Check endpoint URL, page origin/CORS/private-network permission and local server bind/firewall. Use `tools/ai_probe.py` to test the same endpoint outside browser CORS.

## Provider returns HTTP error

Authentication/quota/model/server statuses are provider failures. Read the sanitized provider message/request ID in Diagnostics; do not troubleshoot them as CORS.

## Action request returns 200 but fails

The model response may be empty, truncated, malformed, schema-invalid or semantically incomplete. Diagnostics should show a rejected response linked to the transport request.

## Cabinet item cannot be used

The item may be incomplete/invalid for its kind or may not declare a Design application capability. Fix the item in Cabinet; do not bypass validation by editing Design internals.

## KB source is not cited

Only retrieved active validated entries are available to the model. A claim relying on KB should contain a valid `[KB:<id>]` marker. Missing/unknown markers are not converted into invented citations.

## UI looks stale after replacing files

Check `LABFLOW_BUILD` in Diagnostics/runtime snapshot and ensure generated bundles were rebuilt. Browser cache/stale deployment should be distinguished from current-source behavior.

## Design completes but suggestions are empty

Inspect the Action/context logs before increasing model size. A healthy Design run should expose per-domain `cabinet.domain_candidates` and `knowledge.domain_candidates` when such references exist. The runtime should use deterministic reference fallback before blanket unresolved downgrade. If all domains become unresolved despite compatible structured references, run the Design/context unit tests and verify the generated KB/action/prompt bundles are current. See `DESIGN_INFERENCE.md`.
