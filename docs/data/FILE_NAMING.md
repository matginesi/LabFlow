# File naming and canonical identity

Real experiment archives contain inconsistent spaces/separators, sample/group tokens, `REF`, repeated runs and laboratory-specific filenames. LabFlow never rewrites RAW paths. Instead it keeps the verbatim RAW name/path as provenance and exposes a deterministic canonical name in the Working Copy.

A **file is not a sample**. Import keeps file identity and scientific sample identity separate:

1. prefer an explicit internal device/sample field configured by the ground-truth policy (for current JV files: `General info.Device`);
2. otherwise derive a candidate from the configured filename pattern;
3. otherwise use the configured parent-directory fallback;
4. if identity is still non-unique/uncertain, create a deterministic ambiguity finding rather than merging silently.

The chosen sample receives a stable LabFlow ID. Original filename-derived values, raw device labels and equivalent observed names remain aliases/provenance in `LF.CanonicalStore`.

Example: a RAW device token `N1 3 -1A` maps deterministically to canonical identity `N1_3_1A`; a source file `0001_..._Stability (JV)_N1 3 -1A.txt` is represented canonically as `0001_..._Stability (JV)_N1_3_1A.txt`. The RAW filename/path remains stored separately and is still used to round-trip the pristine archive.

Operational normalization and identity rules live in `prompts/policies/data-ground-truth.md`. This document is explanatory only and must not become a competing rule source.
