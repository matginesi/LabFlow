# Current LabFlow architecture summary

The POC now follows a strict deterministic-first architecture.

## Scientific state

- uploaded ZIP: immutable source snapshot;
- one in-memory Working Copy: only editable scientific model;
- Canonical Store: semantic indexes/evidence/relations over the Working Copy;
- Analysis Dossier: compact deterministic review summary;
- Research Context Pack: bounded per-request AI/chat context.

The original source is never mutated. Save/export creates new files.

## Researcher OPERATIONS

Only eight researcher goals are exposed:

1. Analyze dataset — deterministic automatic;
2. Apply safe corrections — deterministic action;
3. Resolve ambiguities — AI assist;
4. Infer missing design — AI assist;
5. Interpret results — AI assist;
6. Generate report — AI assist;
7. Improve report — AI assist;
8. Prepare NOMAD export — deterministic action.

Assistant Chat uses the Context Builder but is not a Workshop OPERATION.

## Core boundaries

- deterministic code owns parsing, identities, calculations, quality gates and validation;
- AI owns ambiguity interpretation, Design suggestions, Results explanation and prose generation/revision;
- AI proposals do not write scientific state directly;
- Results are independent from Design;
- Report editor is the export text source of truth;
- one NOMAD mapping drives UI, validation and package generation;
- derived exports never mark the Working Copy saved.

See `docs/WORKFLOW.md` for the detailed workflow.
