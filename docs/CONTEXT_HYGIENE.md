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

## Conversation memory and focus

Assistant memory is **session-only**. Conversation focus (the sample, measurement, group or Design experiment a question refers to), the last intent/target and a small router cache live in module state and are never written to `ExperimentData`: `derived` is persisted, so memory stored there would end up inside the saved workspace. Reset session and Clear conversation both clear it.

Focus is resolved deterministically from canonical LabFlow identifiers (sample/measurement/group/Design names, ids and aliases) plus the current page selection for short entity-free messages. No language-specific keyword list is involved; the tiny router stays the only intent authority. A cached route is reused only for the same page/view and the same normalized question, `clarify` is never cached, and an entity-free follow-up may deterministically reuse the previous intent instead of failing closed to clarification.

## Answer context shape

Sections are selected by intent and target first, with the open page only a secondary signal, so an export question asked from Results still receives export facts. The pack keeps a compact machine-readable JSON body plus a flat `<facts>` digest of the most important scalars (`key=value`), which small models read more reliably. The digest is bounded, is the first optional element dropped under budget pressure, and is excluded from the JSON body to avoid duplicate tokens.

Budget tiers, most expendable first: P3 previous turn and digest, P2 references, P1 facts/scope, P0 task.


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
