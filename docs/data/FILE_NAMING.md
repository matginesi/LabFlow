---
title: File naming and identity
section: Scientific data
summary: Separation of immutable RAW paths, file identity, sample identity and canonical display names.
order: 31
---

# File naming and identity

RAW archive names are provenance and are never rewritten. LabFlow may derive deterministic canonical names for the scientific model while retaining the original path/name separately.

A file is not a sample. Sample identity prefers configured internal evidence, then configured filename patterns, then configured parent-path fallback. If identity remains uncertain or non-unique, LabFlow creates an ambiguity finding rather than merging silently.

Duplicate basenames in different directories remain distinct files/measurements because full archive path is the source-file identity.

Operational normalization rules live in `prompts/policies/data-ground-truth.md`; update that policy rather than hardcoding a new naming convention inside page/import code.
