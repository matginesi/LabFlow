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

## 8.1 Knowledge Base

The Knowledge Base is separate from experiment state and uses schema version `1`. Its shipped source is intentionally split by purpose:

- `knowledge-base/science.json` — sourced scientific `material`, `solution`, `process`, `stack` and `concept` records;
- `knowledge-base/labflow.json` — `guide` records that explain LabFlow itself.

`tools/build_knowledge_bundle.py` combines these files into the browser bundle. The bundled library is ready at startup: no directory permission, external database, indexing step or retrieval toggle exists. Resetting the experiment does not alter it because it is neither part of `LF.State.state.experiment` nor a Canonical Store domain.

The Knowledge Base page may create, import or edit records. Those changes are stored only as small browser-local overrides keyed by stable record ID. A same-ID override wins over the bundled record and can be reset; a new ID behaves as a custom local record. JSON import merges into those overrides and JSON export serializes the effective versioned library.

Lookup is deterministic and bounded. Query terms are matched against record names, tags, summaries, kind-specific data and source metadata. Scientific Action Context Packs search only the `science` collection and receive `knowledge_context` only when useful records exist. The Assistant may search both collections. A lookup miss or lookup failure simply means no additional context; it is never an Action failure.

Retrieved scientific records are external candidate knowledge, not evidence about the imported experiment. `design.infer` may cite a supporting record in `knowledge_refs`. Model-only scientific suggestions have no fabricated record IDs and are confidence-capped. Exact model-only recipe quantities are kept visible for researcher review but are not automatically applied; qualitative identifiers such as `N2`, `SnO2`, `C60` or `2PACz` are not treated as quantitative settings merely because they contain digits. The ordinary fill-only Design apply gate remains the only mutation path.

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
