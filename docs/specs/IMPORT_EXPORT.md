# Import and export contract

## 1. Import invariant

The uploaded ZIP is immutable source evidence.

`LF.Importer.parseDataset(arrayBuffer, sourceName, onProgress)` must snapshot source bytes instead of attaching a caller-owned mutable buffer directly to editable experiment state.

Import produces the one Working Copy and deterministic canonical analysis.

## 2. Import stages

Conceptually:

```text
snapshot source
 ↓
inventory archive
 ↓
classify files
 ↓
parse known formats
 ↓
resolve canonical entities/aliases
 ↓
build measurements
 ↓
build evidence/relations
 ↓
calculate Results/findings
 ↓
build Analysis Dossier
```

Unknown source files remain preserved.

Ambiguous semantics become findings rather than implicit guesses.

## 3. Original versus Working Copy

Original source:

- immutable;
- provenance/audit source;
- never edited.

Working Copy:

- mutable in memory;
- used by every Action/page;
- serialized only on explicit save/export.

## 4. Save internal state and export Working Copy

**Save** persists the current internal LabFlow representation in browser storage. **Export** creates a new LabFlow ZIP representing the current Working Copy revision.

It is the only action that marks the current revision saved.

It never overwrites the originally uploaded file.

## 5. Derived exports

Derived exports include Report PDF/DOCX and NOMAD ZIP.

They:

- read the current Working Copy;
- do not rewrite source RAW bytes;
- do not mark the Working Copy saved.

## 6. LabFlow package content

Normal package export includes as applicable:

- `manifest.json`;
- current `experiment.json`;
- `canonical.json`;
- preserved source/RAW files;
- provenance/patch information.

## 7. Canonical snapshot

`canonical.json` is a portable compact semantic representation. It intentionally avoids duplicating full RAW curves.

## 8. Report export contract

The Report editor Markdown is the single text source for all document exports.

PDF/DOCX must serialize the current editor content and only the figures explicitly selected in Report Studio.

Current figure selection may include:

- PCE distribution;
- hysteresis distribution;
- best JV curve;
- PCE vs hysteresis;
- top efficiency;
- group comparison.

Export must not silently regenerate different narrative text.

## 9. NOMAD export contract

NOMAD export maps from the same current Canonical Store revision used by the NOMAD page.

One mapping plan is shared by UI, validation and entry generation.

The staging package includes audit metadata such as:

- canonical snapshot;
- mapping plan;
- provenance/patches;
- schema/entry content.

Any relevant Working Copy mutation invalidates stale NOMAD staging.
