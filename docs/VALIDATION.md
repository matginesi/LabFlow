---
title: Validation and release gates
section: Engineering reference
summary: Required checks for logic, generated artifacts, UI, source hygiene and distribution.
order: 40
---

# Validation and release gates

Validation is layered so deterministic scientific behavior is checked independently from optional provider behavior.

## Main commands

```bash
node tests/unit/run.js
./release_check.sh
```

After source changes that affect generated assets:

```bash
./release_check.sh --fix
./release_check.sh
```

Use the full browser audit when the environment can launch/navigate a local page:

```bash
./release_check.sh --full
```

## What the gate checks

- source/architecture ownership;
- Action manifests, guards and generated registry;
- prompt bundle consistency;
- Knowledge Base schema/bundle consistency;
- documentation and UI Kit generated assets;
- source hygiene/readability;
- deterministic pipeline/import regressions;
- UI contracts and responsive/browser checks where available;
- distribution structure.

## Generated files

Do not patch generated artifacts to make a test pass. Change their source, rebuild, then verify. Important generated files include Action registry/prompt bundle, KB bundle, docs bundle, UI Kit inline bundle and Action runtime matrix.

## Provider failure tests

Some unit suites intentionally simulate network/provider/rate-limit/error paths and therefore emit warning/error log lines. A logged simulated error is not a failed test; the suite exit status and assertions are authoritative.

## Test fixtures

`TEST_DATA/` is retained as regression evidence and must not be removed by cleanup. Existing archive fixtures are also retained when packaging a release.
