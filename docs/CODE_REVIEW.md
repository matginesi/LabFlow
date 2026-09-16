---
title: Code review guide
section: Engineering reference
summary: Reviewer-oriented checklist for architecture, scientific integrity, AI safety and maintainability.
order: 3
---

# Code review guide

This checklist is written for a reviewer who did not author the change.

## Architecture

- Is there still exactly one mutable `ExperimentData` aggregate?
- Is each new data shape owned by one module and assigned a persistence class?
- Are pages/controllers delegating writes to owners?
- Are derived projections invalidated declaratively?
- Did the change introduce an unnecessary framework, compatibility layer, database or duplicate registry?
- Do required dependencies fail fast rather than degrade into partial behavior?

## Scientific integrity

- Are RAW bytes/paths untouched?
- Are deterministic calculations still deterministic and reproducible?
- Are unknown/ambiguous semantics represented explicitly rather than guessed?
- Does every accepted correction preserve provenance and trigger required recomputation?
- Is reference context (Cabinet/KB) clearly separated from experiment evidence?

## AI and Actions

- Does the capability belong in an Action rather than the deterministic pipeline, or vice versa?
- Does the manifest declare target, context, result, effect, guards, execution and UI metadata?
- Are state bindings and commands manifest-driven rather than hardcoded by Action ID?
- Is structured output validated before storage?
- Are retries, token budgets and deadlines bounded?
- Can an HTTP-successful but semantically invalid model response ever be reported as success? It must not.
- Can AI mutate scientific state without explicit owner-controlled acceptance? It must not.

## Persistence and privacy

- Does the snapshot contain only declared persistent scientific roots?
- Are credentials stored separately from scientific/export payloads and redacted from diagnostics?
- Does any new network path bypass the configured provider/export boundary?
- Is a purported stub genuinely non-networking?

## Maintainability

- Do comments explain reasons/invariants rather than syntax?
- Is the public contract documented in one authoritative location?
- Are generated artifacts rebuilt from source?
- Are failure messages actionable and free of workstation-specific assumptions?
- Is new complexity covered by a test at the owning boundary?

## Release evidence

Minimum distributable evidence:

```bash
./release_check.sh
```

Then add feature-specific browser or private-fixture evidence when the change touches those surfaces.

## Design inference review checks

When reviewing Design-inference changes, verify that:

- Cabinet/KB context stays labelled reference context rather than experiment evidence;
- a small-model optimization does not reduce useful reference-backed output to blanket unresolved domains;
- a large-model optimization cannot bypass provenance verification or acceptance;
- confidence remains provenance-calibrated and is not presented as scientific probability;
- structured KB hints remain sourced and qualitative where exact values are unsupported;
- deterministic fallback copies only validated supplied references;
- generated action/prompt/KB/docs bundles are rebuilt from their canonical sources.
