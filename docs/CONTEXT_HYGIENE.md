---
title: Context hygiene
section: Engineering reference
summary: Small task-specific model inputs with explicit routing, fact ownership and reference boundaries.
order: 24
---

# Context hygiene

The governing rule is **deterministic work first; model context contains only the unresolved task**.

## Never send by default

Do not place full Action manifests/contracts, full JSON Schemas, complete ExperimentData, full KB records, provider diagnostics, Settings state, Action history, long conversation history or unrelated page state into a model request.

## Assistant routing context

Natural-language routing is separate from answer generation. The tiny router receives the user message and deterministic current page/view only. It must not receive scientific datasets, the Action catalog, KB records or conversation history. It returns a bounded routing decision and optional retrieval query.

Explicit slash commands bypass the router. Routed factual intents query canonical LabFlow state and produce a local final answer. Only interpretive/scientific intents build `assistant.chat` answer context.

## Assistant answer context

The answer context contains resolved task, scope and focused facts. Targeted KB/Cabinet references are added only when the router requests them. At most one previous turn is included, and only when the router marks the new message as dependent on that turn.

The answer Action input ceiling is 1400 tokens. Fitting removes optional references/history and compresses secondary records before it can drop focused facts. The user question is sent separately and is never silently rewritten to fit. A large provider context window is spare capacity, not a target.

## Ambiguity resolution

Only active ambiguous findings plus directly linked evidence are sent. Already-resolved records are not sent.

## Design

Only the selected Design target, missing domains, relevant experiment evidence, compact Cabinet candidates and compact source-free KB candidates are eligible. Bibliographic fields, DOI and URL are intentionally omitted. If deterministic references cover every pending domain, no model work unit is created.

## Results and Export

No model context is built for `results.interpret`, `results.compare` or `export.prepare`; they are deterministic Actions.

## Knowledge views

`compactForDesign` is source-free. Assistant retrieval may include a few source-bearing entries so `[KB:<id>]` remains traceable. KB and experiment facts remain separate namespaces in model context.

## Validation

Provider output is validated before use. Malformed route output fails closed to clarification. Unsupported KB citations are rejected. Invalid structured Action output is an error, not permission to fabricate missing scientific values.
