---
title: Contributing
section: Engineering reference
summary: Change discipline, ownership rules, generated artifacts and definition of done.
order: 2
---

# Contributing

LabFlow favors small explicit changes over broad abstraction. The expected standard is not “works in the browser”; it is “ownership is clear, failure behavior is bounded, and the change is reproducible by another developer.”

## Before editing

Identify the owner module and read the corresponding contract/test. Do not begin from the page that happens to display the data.

For structural changes, read `ARCHITECTURE.md`. For scientific state, read `specs/DATA_MODEL.md`. For AI behavior, read `specs/ACTIONS.md` and `specs/AI_PROVIDERS.md`.

## Change discipline

Prefer:

- one owner API over repeated direct assignment;
- declarative registry metadata over Action/type switches;
- deterministic transformations over AI when the rule is mechanically knowable;
- explicit failure over silent compatibility guesses;
- bounded context/output/retry behavior over open-ended model calls;
- detached snapshots for reuse/reference application;
- tests at the boundary that owns the invariant.

Avoid introducing a dependency, framework, migration layer or storage system unless the existing architecture creates a demonstrated problem it solves.

## Comments

A useful comment answers one of these questions:

- Why is this branch necessary?
- Which invariant is protected?
- Which external protocol/provider quirk is normalized here?
- Why is an apparently simpler implementation unsafe?
- Which module owns the behavior being delegated?

Delete comments that merely restate syntax. Keep public architectural rules in documentation/tests rather than relying on comments as the only specification.

## Generated code

If a file starts with a generated marker or is produced by one of `tools/build_*`, edit its source and rebuild it. A review should never need to reverse-engineer whether generated output was hand-patched.

## Tests

Add the smallest test that proves the changed contract. Prefer owner-level unit tests; use browser regression only when behavior depends on actual DOM/browser semantics.

Private scientific fixtures are useful integration evidence but are not a replacement for self-contained synthetic tests in the distributable repository.

## Definition of done

A change is complete when:

- owner and persistence class are unambiguous;
- no parallel scientific representation was introduced;
- error/empty/invalid paths are intentional;
- generated artifacts are synchronized;
- documentation reflects the new contract;
- `./release_check.sh` passes;
- relevant browser/private-fixture checks pass when available.
