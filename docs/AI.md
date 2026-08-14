# AI, Research Context Packs and model boundaries

Read [`WORKFLOW.md`](WORKFLOW.md) and [`specs/ACTIONS.md`](specs/ACTIONS.md) first.

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

Every AI entry point uses a bounded **Research Context Pack** generated from the current Canonical Store and UI/request context. Every pack also carries the shared Experiment Brief: deterministic facts always, plus optional `analysis.enrich` interpretation when that enrichment is fresh for the current scientific signature.

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
- directly linked measurements/evidence;
- a `design_evidence_summary` that states whether RAW design/fabrication evidence was actually found;
- when RAW design evidence is absent, an optional domain-knowledge note explicitly marked as non-experimental suggestion basis.

For the perovskite POC, `prompts/knowledge/perovskite-design.md` is the bounded fallback used by `design.infer`. It is **not** experiment evidence and must never be presented as something imported from the ZIP. Knowledge-only candidates must retain `provenance_kind: "knowledge"`, a low confidence (at most `0.45`), and a reason explaining that they are domain hypotheses rather than RAW facts. Quantitative recipe details that are not supported by RAW evidence remain unknown.

A measurement-only dataset can therefore still produce a useful qualitative candidate design, while the UI and stored proposal continue to distinguish imported evidence from inferred knowledge.

### Results

Includes:

- deterministic summary;
- top REF/non-REF;
- best-by-sample subset;
- anomalies;
- relevant findings.

### Report

Includes:

- shared Experiment Brief;
- requested mode/document kind and current work block;
- current Markdown only when relevant;
- current figure selection;
- deterministic Results summary;
- Design summary;
- findings;
- provenance.

Fresh Report/Paper documents are empty. `report.generate` drafts only after an explicit researcher action and splits long jobs into bounded ordered sections; `report.improve` similarly targets the relevant section(s). The UI groups improvement modes into Common, Report and Paper aids.

## 4. Context budgeting

Context is bounded by characters before sending the request. If necessary, lower-priority arrays are deterministically reduced.

The pack includes a notice when it had to be bounded.

A narrow user question should produce a narrow context instead of increasing the global budget.

## 5. Output budgeting

There is no single global output-token setting for every model Action.

Each AI Action owns an output budget appropriate to its job in `action.json`.

Assistant output is configured separately from Action contracts.

## 6. Structured AI output

Structured Actions use schemas under `actions/schemas/` and are validated locally after provider output is parsed.

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

Action output budgets remain in Action contracts. Connection settings must not become a hidden global scientific policy.

## 10. Assistant safety boundary

Chat is read-only with respect to scientific Working Copy state.

If the Assistant identifies something that should be corrected, it may explain it or direct the researcher to Review/Design, but it must not mutate the experiment as a side effect of conversation.
