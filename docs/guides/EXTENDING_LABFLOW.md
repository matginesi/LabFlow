---
title: Extending LabFlow
section: Engineering reference
summary: Practical extension recipes that preserve ownership, persistence and deterministic/AI boundaries.
order: 50
---

# Extending LabFlow

The fastest safe extension is the one that fits an existing ownership boundary. Start by classifying the change, not by choosing a UI location.

## Add a scientific field or record

1. Define the canonical shape/default in `DomainSchema`.
2. Declare root ownership/persistence metadata where applicable.
3. Update `DataContracts` when the invariant is structural.
4. Add owner query/mutation behavior rather than page-level assignment.
5. Register cross-module structure metadata in `LF.Structures` when useful.
6. Add a unit test for persistence/restore/mutation behavior.

Do not create a second default literal in importer/page code.

## Add a derived projection

Register its dependencies and invalidation in `DerivedState`. The projection must be reconstructible from authoritative data and excluded from persistence unless there is a documented reason otherwise.

## Add a pipeline stage

Use `DataPipeline.register(...)` with explicit `after`, `reads`, `writes`, `phase` and deterministic `run`. Do not call downstream stages manually. Return a bounded restart request when an accepted mutation requires an upstream recomputation.

## Add an Action

Create `actions/<id>/action.json` plus prompt/schema when required. Declare target, context, result, effect, guards, execution and UI metadata. Implement deterministic step/context support and add contract/behavior tests.

Do not add the Action ID to page/Assistant switch statements; discovery and capability must remain manifest-driven.

## Add or change Cabinet resources

Cabinet owns its resource registry. Add fields and kind semantics there so normalization, validation, summaries, UI editor/grouping and application capability derive from one registry.

When a resource applies to Design, add/extend a `DesignModel` mutation API and have `Cabinet.applyToDesign()` delegate to it. Store a detached snapshot plus source reference.

## Add KB fields/content

Keep baseline knowledge in JSONL and validation in the KB owner. New fields must be optional/backward-safe within the current entry contract or accompanied by a deliberate contract update and validation test.

KB retrieval remains bounded and reference-only.

## Add a page

Pages may query canonical/reference/derived state and keep UI-only selection/filter/draft state. They call owner APIs for writes and must not parse source files or recreate scientific defaults.

Use shared UI primitives/tokens from the UI Kit; page CSS is composition, not a second component library.

## Add persistence

First decide whether the data is scientific, Action, reference, preference, derived or UI runtime. Persist through the owning subsystem. Do not add ad-hoc fields to the scientific snapshot because they happen to be convenient.

## Add export format

Build a deterministic projection from validated current state. Export code is not an editable data model and does not mutate source/scientific state.

## Verification

Run `./release_check.sh`, add the smallest owner-level test for the new invariant, and run browser/private-fixture checks when the feature actually depends on them.
