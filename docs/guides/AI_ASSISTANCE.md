---
title: AI assistance
section: Researcher guide
summary: Where AI is useful, what authority its output has, and where it is deliberately absent.
order: 30
---

# AI assistance

AI is optional. Import, normalization, validation, JV analysis, safe-cleanup detection and export preparation remain deterministic.

## Supported uses

- **Resolve ambiguities:** propose semantic resolutions deterministic rules cannot prove.
- **Complete Design:** propose missing qualitative chemistry, device stack and process content for one experiment. Design retrieval uses experiment evidence first, then compatible Cabinet resources and domain-targeted Knowledge Base references; unsupported domains may remain explicitly unresolved instead of being fabricated.
- **Interpret Results:** explain deterministic summaries/findings.
- **Compare Results:** explain differences among selected deterministic groups.
- **Assistant:** answer questions from bounded current context and recommend existing Actions.

## Authority

AI output is a proposal, derived annotation, or read-only answer. It is not an authoritative measurement and does not silently overwrite accepted scientific data.

## Context

Context builders send the minimum semantic information needed for the current task. They preserve authority labels: experiment evidence, Cabinet references, KB references and existing Action output are not interchangeable.

Provider/model/endpoint settings and transport controls stay outside scientific context.

## Validation

Structured Action output is parsed and validated before storage. A provider may return HTTP 200 and still fail the Action because output is truncated, malformed, schema-invalid or semantically incomplete. Design adds bounded transport repair for common small-model JSON mistakes (for example Python-style boolean/null literals outside quoted strings), but scientific values are never repaired or invented.

For Design, each requested domain should preferentially become a useful review candidate from experiment evidence, Cabinet, domain-targeted Knowledge Base references or cautious qualitative model inference. `unresolved_domains` is the final fallback, not the default. When the researcher accepts an explicitly unresolved domain, LabFlow persists it as a reviewed known unknown: the scientific gap remains visible, but it is no longer treated as pending AI work until that Design domain changes.

## Bulk Design

“Complete all missing with AI” sequences the same single-experiment `design.infer` Action. Each experiment persists independently; a later failure does not erase earlier successful proposals, and rate limiting stops future calls rather than creating hidden retries.


### Conservative Design coverage fallback

For `design.infer`, a syntactically valid response does not fail merely because a required Design domain was omitted or represented by an unusable partial candidate. LabFlow owns the deterministic requested-domain scope: after normalization, any required domain that is neither usefully populated nor explicitly unresolved is deterministically downgraded to an auditable unresolved known-unknown. Incomplete candidate content for that domain is discarded so it cannot be applied accidentally. This fallback adds no scientific facts and is intended to make small and large models behave consistently without encouraging fabrication.


## Design source nature and confidence

Design is intentionally more structured than ordinary assistant prose. Every candidate is labelled by source nature so the researcher can tell whether it came from current experiment evidence, the Lab Cabinet, the sourced Knowledge Base, or model inference.

The runtime retrieves Cabinet and KB candidates independently for `solutions`, `stack` and `process`. If a model returns sparse but valid output, LabFlow attempts a deterministic Cabinet/KB reference fallback before declaring the domain unresolved. This makes small local models useful without relaxing scientific provenance.

The displayed confidence is recalibrated by LabFlow from source nature and provider-reported confidence. A high provider confidence cannot turn a literature archetype into experiment evidence. Unsupported exact quantities are capped and kept review-only.

See [Design inference and confidence](DESIGN_INFERENCE.md) for the current calibration and fallback contract.
