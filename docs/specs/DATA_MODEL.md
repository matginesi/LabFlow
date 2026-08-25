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

### Canonical Data Model / Store

`LF.CanonicalStore` is the deterministic internal representation and semantic index/view over the Working Copy, not another editable state. Internal format `labflow-canonical-v2` groups data into explicit domains for UI, Tools and Actions while retaining compatibility aliases for existing modules.

Current grouped domains are:

- `experiment` and `source`;
- `entities.files`, `entities.samples`, `entities.measurements`;
- `scientific.design`, `scientific.results`, `scientific.findings`;
- `documents.lab`, `documents.paper`, `documents.active_kind`;
- `evidence`, `relations`, `aliases`;
- `provenance.patches`, `provenance.document_edits`, `provenance.records`.

This internal v2 representation is rebuilt/cached from the Working Copy. It does not own independent scientific mutations.

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
- derived Action/chat state;
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

A finding is not automatically an error and is not automatically an Action.

## 8. Design source projection

`design` is populated from explicit source evidence before AI. LabFlow scans relevant imported auxiliary metadata (for example notes containing stack, precursor/passivation formulation, coating, antisolvent, annealing or atmosphere), normalizes it, and groups replicates that share the same source-backed design signature.

The Design model records:

- `sourceEvidence`: bounded RAW-backed fabrication notes with sample/group/path references;
- `evidenceSummary`: source record count, parsed record count, covered samples and recovered variants;
- `sourceProjection`: projection version/summary used to make normal rendering idempotent;
- source-derived solutions, stack and process fields with `raw_evidence` provenance.

The projection is fill-only for existing Design records. Once the researcher edits a field, a normal `ensureShape()` / re-render must not restore the RAW value over that edit. An explicit **Re-read source** operation may rerun projection deliberately.

If the archive contains measurements but no fabrication recipe, LabFlow preserves the experimental/sample structure and explicit unknown fields; absence of source Design evidence must never be represented as an empty or silently inferred experiment.

## 8.1 Local Knowledge Base

The Knowledge Base is a separate folder-backed `library.json` with schema version `1`:

- `records[]` with stable `id`, `kind`, `name`, `summary`, `tags`, primary `sources[]`, timestamps and kind-specific `data`;
- supported kinds: `material`, `solution`, `process`, `stack`;
- stack layers keep role, material, thickness and process in physical order.

It is neither part of `LF.State.state.experiment` nor a Canonical Store domain. Resetting an experiment session does not erase or rewrite it. The management page writes create/update/delete operations directly to the connected file. Import merges records by stable ID into that file; export serializes the complete versioned library as a backup. The directory handle may be remembered in IndexedDB, but the records themselves are not stored in browser `localStorage`.

Records are retrieved, not synchronized into scientific state. A deterministic lexical ranker selects bounded records by experiment/Design terms, missing-field type, tags and source text. Retrieval returns stable IDs, scores, matched terms, record data and source metadata. The Assistant accesses it through the read-only `knowledge.search` Tool; AI Action Context Packs receive only their small ranked slice.

For Design, retrieved records are external candidate knowledge and are never copied before inference. `design.infer` may use a record for a missing-field proposal and must preserve its ID in `knowledge_refs`. Exact recipe quantities are allowed only when copied from that identified record and remain `provenance_kind: knowledge` with confidence capped at 0.45. The researcher accepts the resulting AI proposal through the ordinary fill-only gate; ZIP/researcher-confirmed values remain authoritative.

## 9. Patches and provenance

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

## 10. Derived state

Derived state includes data such as:

- Analysis Dossier;
- Results interpretation;
- Design AI proposal;
- NOMAD mapping/validation.

Derived state is revision-scoped and must not masquerade as current after relevant scientific mutation.

## 11. Analysis Dossier

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

## 12. Tool views and Context Packs

A Tool result and a Context Pack are ephemeral bounded views, not persistent scientific truth. Read Tools retrieve named slices of the Canonical Data Model with typed arguments. AI Actions receive a profile declared in `action.json` under `input.context`.

The Assistant begins from a small bootstrap Context Pack and obtains additional data only through explicit allowlisted read Tools. Returned observations are bounded before reuse. Stable IDs/evidence references should be preferred over copied raw data.

## 13. Serialization

### Working package

`experiment.json` represents the current Working Copy.

### Canonical snapshot

`canonical.json` (`labflow-canonical-v2`) contains a portable compact semantic snapshot:

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
