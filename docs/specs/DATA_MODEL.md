# LabFlow data model contract

Read [`../WORKFLOW.md`](../WORKFLOW.md) for the complete lifecycle.

## 1. Source versus semantic data

The uploaded ZIP and the LabFlow experiment are deliberately different objects.

### Source Vault

Immutable-by-contract source snapshot:

- byte-for-byte original archive;
- original paths/names;
- RAW and auxiliary source evidence.

### Working Copy

`LF.State.state.experiment` is the one editable scientific state.

### Canonical Store

`LF.CanonicalStore` is a deterministic semantic index/view over the Working Copy, not another editable state.

## 2. Working Copy root

The normalized experiment contains the scientific collections and derived state required by the UI. Major concepts include:

- experiment metadata;
- source/raw archive reference;
- files;
- samples;
- measurements;
- findings;
- patches/provenance;
- Design;
- Results analysis;
- Report;
- NOMAD state;
- derived OPERATION/chat state;
- sync/revision metadata.

Do not create separate mutable copies of these collections for individual pages.

## 3. Canonical identity

### Files

File identity is the full source archive path / stable LabFlow file ID.

### Samples

Sample identity is a stable LabFlow sample ID plus a canonical human-facing name.

Original names remain aliases/provenance.

### Measurements

Measurements have stable IDs and point to the canonical sample plus source file/path.

A measurement file name is not automatically the sample identity.

## 4. Alias model

Aliases preserve original naming without forcing laboratory users to rename their archives.

A canonical sample can retain:

- canonical name;
- raw/internal name;
- filename-derived name;
- known equivalent aliases.

Alias lookup is case/format normalized for retrieval, while original display strings remain preserved.

## 5. Evidence model

Evidence is compact and referential. It should explain why LabFlow believes a fact without copying an entire source file into every finding/context.

Evidence fields conceptually include:

- stable evidence ID;
- evidence type;
- source file/finding ID;
- source path;
- related entity IDs;
- fact/summary;
- locator such as path/row/finding ID.

Evidence is used by Review, Design, AI Context Packs and provenance.

## 6. Relation model

Relations connect stable IDs rather than relying on repeated name matching.

Current relation types include:

- sample → measurement;
- measurement → file;
- sample → file;
- entity → evidence;
- file → evidence;
- sample → Design.

Future relations should follow the same ID-based pattern.

## 7. Findings

Findings are deterministic observations about the current Working Copy.

They can be classified for Review as:

- safe-correctable;
- semantic ambiguity;
- informational/technical;
- resolved.

A finding is not automatically an error and is not automatically a OPERATION.

## 8. Patches and provenance

Every applied correction must be traceable.

Patch records should preserve, as applicable:

- patch type;
- target;
- field;
- before/from;
- after/to;
- source (`deterministic`, `ai`, `user` or equivalent);
- reason;
- evidence IDs/summaries;
- confidence when AI-derived;
- review status/reviewer;
- timestamp.

AI proposals are not patches until they are deterministically validated and applied.

## 9. Derived state

Derived state includes data such as:

- Analysis Dossier;
- Results interpretation;
- Design AI proposal;
- NOMAD mapping/validation.

Derived state is revision-scoped and must not masquerade as current after relevant scientific mutation.

## 10. Analysis Dossier

The dossier is compact by design.

It may contain:

- source revision;
- status;
- counts;
- compact sample/measurement references;
- safe fixes;
- ambiguity list;
- informational findings;
- evidence coverage;
- deterministic Results summary.

It must not duplicate full RAW curves or giant source text.

## 11. Context Pack

Context Pack is an ephemeral bounded view, not persistent scientific truth.

It contains only the fields selected for one AI/chat request. Stable IDs/evidence references should be preferred over copied raw data.

## 12. Serialization

### Working package

`experiment.json` represents the current Working Copy.

### Canonical snapshot

`canonical.json` (`labflow-canonical-v1`) contains a portable compact semantic snapshot:

- canonical identities;
- aliases;
- compact measurements;
- relations;
- evidence;
- findings;
- patches;
- Design;
- provenance.

Large RAW curve arrays are not duplicated into `canonical.json`.
