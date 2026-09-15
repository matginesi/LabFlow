---
title: Validation and release gates
section: Engineering reference
summary: Reproducible build, architecture, privacy, unit and regression checks for a distributable LabFlow release.
order: 10
---

# Validation and release gates

Use the release wrapper for a distributable check:

```bash
./release_check.sh
```

Use `./release_check.sh --full` when the environment permits browser automation.

## What the default gate proves

The default gate rebuilds/validates generated artifacts and runs static/contract/unit/self-contained regression checks. It is designed to work without credentials and without private scientific fixtures.

Key validators protect:

- build/generated consistency;
- single-aggregate architecture and schema ownership;
- source/mutation hygiene and portable defaults;
- Action manifest/result/execution contracts;
- state/UI persistence and binding boundaries;
- UI route/design-system contract;
- local-first/privacy constraints;
- JavaScript syntax and deterministic unit behavior;
- synthetic Upload & Review regression behavior.

## Private and environment-dependent checks

Private real-dataset fixtures under `TEST_DATA/` provide additional integration evidence but are intentionally excluded from the distributable repository/gate.

Browser automation requires an environment that allows Playwright to reach the local static server. A browser-policy failure to navigate localhost is an environment limitation, not application evidence; record it separately rather than relabeling it as a test failure.

Live provider tests are also separate because they require credentials, provider availability, quota and browser network permission.

## Generated artifacts

Run the builders after changing their source:

```bash
python tools/build_prompt_bundle.py
python tools/build_knowledge_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py
```

A release should fail when generated output is stale rather than silently shipping inconsistent source/artifacts.

## Test-fixture policy

Synthetic fixtures are deterministic and safe to distribute. Real/private archives remain local and ignored by Git. See `specs/TEST_FIXTURES.md`.
