# AI, Research Context Packs and model boundaries

Read [`WORKFLOW.md`](WORKFLOW.md) and [`specs/OPERATIONS.md`](specs/OPERATIONS.md) first.

## 1. Core rule

AI is downstream of deterministic science.

AI may:

- interpret;
- propose;
- explain;
- generate/revise prose.

AI must not own:

- ZIP parsing;
- numeric Results;
- deterministic quality gates;
- silent scientific mutation;
- NOMAD readiness.

## 2. Shared Context Builder

Module: `assets/js/ai/context.js`.

Every AI entry point uses a bounded **Research Context Pack** generated from the current Canonical Store and UI/request context.

Do not default to `JSON.stringify(experiment)`.

RAW curve point arrays are excluded by default.

## 3. Context profiles

### Chat

May include:

- current route/view;
- user question;
- selected measurement/Design item;
- query-matched samples;
- compact measurement summaries;
- Results summary/top rankings;
- relevant findings/evidence;
- Design selection;
- Report excerpt on Report page;
- NOMAD missing/readiness on NOMAD page;
- bounded recent conversation.

### Ambiguity

Includes only:

- currently selected unresolved semantic findings;
- linked measurements/samples;
- linked evidence;
- explicit instruction to return unresolved if evidence is insufficient.

### Design

Includes only:

- one selected Design experiment/device;
- its sample entities;
- current known Design;
- explicit unknown fields;
- directly linked measurements/evidence.

### Results

Includes:

- deterministic summary;
- top REF/non-REF;
- best-by-sample subset;
- anomalies;
- relevant findings.

### Report

Includes:

- requested mode/document kind;
- current Markdown when relevant;
- current figure selection;
- deterministic Results summary;
- Design summary;
- findings;
- provenance.

## 4. Context budgeting

Context is bounded by characters before sending the request. If necessary, lower-priority arrays are deterministically reduced.

The pack includes a notice when it had to be bounded.

A narrow user question should produce a narrow context instead of increasing the global budget.

## 5. Output budgeting

There is no single global output-token setting for every model operation.

Each AI OPERATION owns an output budget appropriate to its job in `operation.json`.

Assistant output is configured separately from Operation contracts.

## 6. Structured AI output

Structured OPERATIONS use schemas under `operations/schemas/` and are validated locally after provider output is parsed.

If structured output is invalid:

- retry is checkpoint-scoped;
- validation feedback is included in the retry context;
- after bounded retries the run fails visibly.

Do not loosen schemas by inventing missing scientific values.

## 7. Streaming

`assets/js/ai/transport.js` is the only provider transport owner.

Provider output should expose meaningful streamed content/reasoning while it arrives. Empty heartbeat traffic must not be presented as scientific progress.

Final Markdown/JSON rendering must follow the active theme.

## 8. Retry contract

AI checkpoint retry schedule:

```text
first failure
  ↓ 5 s
retry 1
  ↓ failure
10 s
retry 2
  ↓ failure
manual Retry checkpoint
```

No unbounded retry loop or provider queue.

## 9. Provider settings

Provider, endpoint, model and API key are browser-local settings.

OPERATION output budgets remain in Operation contracts. Connection settings must not become a hidden global scientific policy.

## 10. Assistant safety boundary

Chat is read-only with respect to scientific Working Copy state.

If the Assistant identifies something that should be corrected, it may explain it or direct the researcher to Review/Design, but it must not mutate the experiment as a side effect of conversation.
