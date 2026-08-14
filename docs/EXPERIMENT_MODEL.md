# Experiment model

For the full lifecycle see [`WORKFLOW.md`](WORKFLOW.md).

## Source layer

The uploaded ZIP is immutable source evidence. Its bytes are cloned at import. Original paths, filenames and contents remain available for provenance and round-trip export.

## Working Copy

`LF.State.state.experiment` is the single editable scientific model.

All researcher changes target this object only.

## Canonical Store

`LF.CanonicalStore` adds deterministic semantic access without becoming a second model:

- stable identities;
- aliases;
- relations;
- evidence;
- lookup indexes.

It references current Working Copy arrays and rebuilds its indexes for the current revision.

## Analysis Dossier

Compact deterministic status view for Review and Action scoping. It is not another dataset copy.

## Research Context Pack

Ephemeral bounded data selected for one AI/chat request.

The Context Pack is not scientific state and should not be persisted as a replacement for canonical data.

## Provenance statuses

Values may carry statuses/concepts such as:

- parsed;
- derived;
- known;
- AI inferred/proposed;
- user confirmed;
- unknown;
- excluded.

User-confirmed values must not be silently overwritten by AI inference.
