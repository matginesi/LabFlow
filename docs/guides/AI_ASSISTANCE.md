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

For Design, each requested domain must be either usefully populated or explicitly listed in `unresolved_domains`. This lets LabFlow preserve good partial proposals without pressuring a model to invent unsupported chemistry, stack or process details.

## Bulk Design

“Complete all missing with AI” sequences the same single-experiment `design.infer` Action. Each experiment persists independently; a later failure does not erase earlier successful proposals, and rate limiting stops future calls rather than creating hidden retries.
