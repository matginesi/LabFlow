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

Design is **source-first**. Before AI is called, LabFlow deterministically projects explicit fabrication metadata from RAW evidence into normalized Design variants. Repeated samples with the same group/recipe are grouped as replicates; source values keep RAW provenance and normal re-rendering never overwrites later researcher edits.

Includes only:

- one selected Design experiment/device;
- its sample entities;
- current known Design;
- explicit unknown fields;
- directly linked measurements/evidence;
- a `design_evidence_summary` that states whether RAW design/fabrication evidence was actually found;
- when RAW design evidence is absent, an optional domain-knowledge note explicitly marked as non-experimental suggestion basis.

LabFlow may add relevant records from the bundled scientific Knowledge Base to a Design Context Pack. Those records are **external scientific context**, never evidence that a procedure was performed in the imported experiment. Knowledge-backed candidates retain their record IDs in `knowledge_refs`; model-only inference remains explicitly reviewable. Unsupported quantitative recipe details are never auto-applied.

A measurement-only dataset therefore remains useful even when fabrication metadata is absent: the UI still shows experimental groups/samples, coverage and explicit missing fields. `design.infer` may produce conservative qualitative candidates from relevant scientific context or model inference, but an empty Knowledge Base search is not an error and must never block the Action.

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

Fresh Report/Paper documents are empty. `report.generate` drafts only after an explicit researcher action and splits long jobs into bounded ordered sections; `report.improve` similarly targets the relevant section(s). The UI groups improvement modes into Common, Report and Paper aids. Each document-specific group also exposes **All**, which runs only that group's section-specific helpers sequentially (never in parallel); whole-document Common passes remain explicit researcher choices.

## 4. Context budgeting

Context is bounded before sending the request. Context Packs have a hard serialized-size budget; if necessary, lower-priority arrays and long evidence strings are deterministically reduced.

When a provider exposes a runtime context window, LabFlow also performs an Action preflight so estimated input + reserved output + safety margin fit the loaded context. For LM Studio, the loaded instance `context_length` takes priority over the model's theoretical maximum context. If compaction is required, the pack includes a notice and the runtime logs `context.compacted`.

A narrow user question should produce a narrow context instead of increasing the global budget.

## 5. Output budgeting

LabFlow does not impose one hidden global output ceiling. Every AI step declares its own `max_output_tokens` **target budget** in `action.json`; the detected provider/model capability is only a hard ceiling, never the requested target by itself. This prevents a model that supports 64k/128k output from being asked for that amount when an Action only needs a compact brief or interpretation.

The effective request budget is the tightest applicable value among: the Action/step target, detected exact model maximum (or safe context headroom when only that is known), the optional Assistant override for `assistant.chat`, and **Settings → Provider → Force max output**. Provider `0` means “do not add a global cap”; it does not mean “request the provider maximum”. A positive user cap can only lower the request.

Large writing Actions remain split into bounded work units. Automatic import enrichment is deliberately fail-fast: `analysis.enrich` targets 3072 output tokens, has a 90 s absolute deadline and does not auto-retry. If it cannot complete, LabFlow keeps the deterministic Experiment Brief and finishes the ZIP import.

## 6. Structured AI output

Structured Actions use schemas under `actions/schemas/` and are validated locally after provider output is parsed.

If structured output is invalid:

- retry is checkpoint-scoped;
- validation feedback is included in the retry context;
- after bounded retries the run fails visibly.

Do not loosen schemas by inventing missing scientific values.

## 7. Streaming

`assets/js/ai/transport.js` is the only provider transport owner. Provider errors delivered inside an SSE stream are still provider responses: they must retain their real category (for example `MODEL_CONTEXT_LENGTH`) and must never be rewritten as browser CORS/network failures merely because the stream ended with an error event.

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

Provider, endpoint and model are browser-local settings. API keys are browser-local and isolated by provider; switching providers does not reuse another provider's credential.

Action output budgets remain in Action contracts. Connection settings must not become a hidden global scientific policy.

## 10. Assistant read-tool loop and safety boundary

Chat is tool-aware but read-only with respect to scientific Working Copy state. `assistant.chat` declares its allowed Tools in `action.json`. The runner performs at most the configured bounded number of planning rounds (currently six): each round may request one exact read Tool with JSON arguments or declare that enough evidence has been gathered. Broad or diagnostic questions are instructed to cover the relevant Results, scope, findings and provenance/Design slices before answering. Duplicate identical calls stop the loop.

Only Tools marked both `agent_visible: true` and `access: read` can execute with `agent: true`; the registry rejects write/internal Tools even if the model names them. Tool arguments are validated against each Tool's small input contract and observations are bounded before they are added to the final Assistant context. Planner JSON is an internal control result, not user-visible thinking.

The final answer is generated only after this retrieval phase and may expose which read Tools were used as telemetry. If the Assistant identifies something that should be corrected, it may explain it or direct the researcher to the appropriate Action/Review/Design control, but it cannot invoke mutating Actions, apply patches, edit Report/Paper or modify Design as a side effect of conversation.


## Provider rate limits

LabFlow treats provider rate limiting separately from model/output failures. For Z.AI `glm-4.7-flash`, consecutive requests are paced to avoid burst traffic. HTTP 429 or provider code `1305` triggers a bounded transport-level cooldown and retry of the exact same request; `Retry-After` is honored when present. This retry does not rebuild prompts, rerun deterministic checkpoints, or count as an Action semantic retry. Quota-exhaustion codes such as 1308/1310 are not retried automatically.


## Adaptive output budgeting

LabFlow separates desired output size from provider capability. Each AI step may declare a minimum, target and maximum output budget. `ActionRunner` adapts the request to the work unit (including Report/Paper target words) and then clamps it to the detected model/provider ceiling and optional user cap. The provider maximum must never become the default requested output size.

Long model calls emit semantic phases (`prepare`, `request`, streaming, `validate`, `store/complete`). SSE events and estimated generated tokens refine streaming progress only; they do not imply that validation or storage has completed. Connection tests use the regular provider transport with a small bounded payload and Z.AI rate-limit handling.
