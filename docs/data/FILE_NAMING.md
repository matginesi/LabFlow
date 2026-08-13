# File naming and canonical identity

Real experiment archives contain inconsistent spaces/separators, sample/group tokens, `REF`, repeated runs and laboratory-specific filenames. LabFlow never requires researchers to rename source files and never rewrites RAW paths.

A **file is not a sample**. Import keeps file identity and scientific sample identity separate:

1. prefer an explicit internal device/sample field configured by the ground-truth policy (for current JV files: `General info.Device`);
2. otherwise derive a candidate from the configured filename pattern;
3. otherwise use the configured parent-directory fallback;
4. if identity is still non-unique/uncertain, create a deterministic ambiguity finding rather than merging silently.

The chosen sample receives a stable LabFlow ID. Original filename-derived values, raw device labels and equivalent observed names remain aliases/provenance in `LF.CanonicalStore`.

Example: a source file named `0001_..._Stability (JV)_NEW-1A.txt` may map to canonical sample `NEW-1A`; the full filename remains a file path/alias and can still be cited or round-tripped.

Operational normalization and identity rules live in `prompts/policies/data-ground-truth.md`. This document is explanatory only and must not become a competing rule source.
