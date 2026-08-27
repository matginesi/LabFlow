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

LabFlow may add a small set of relevant records from the bundled scientific Knowledge Base to a Design Context Pack. Those records are **external scientific context**, never evidence that a procedure was performed in the imported experiment. Design AI is deliberately limited to solution chemistry and device stack. Its output is stored as a reviewable per-experiment suggestion and is applied only when the researcher chooses Accept experiment or Accept all suggestions. A Knowledge Base miss is normal, and failed experiments remain retryable without discarding successful suggestions.

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

Context is bounded before sending the request. Every AI step declares an operational `max_input_tokens` cap in addition to the Context Pack serialized-size budget; if necessary, lower-priority arrays and long evidence strings are deterministically reduced. This Action cap applies even when the selected model advertises a very large context window.

When a provider exposes a runtime context window, LabFlow also performs an Action preflight so estimated input + reserved output + safety margin fit the loaded context. The effective input ceiling is the tighter of the Action `max_input_tokens` cap and the model/runtime context headroom. For LM Studio, the loaded instance `context_length` takes priority over the model's theoretical maximum context. For llama.cpp, explicit **Detect** reads `/props.default_generation_settings.n_ctx` as the effective context **already assigned to one server slot**, and separately records `total_slots`. LabFlow's recommended profile is `--parallel 1 --ctx-size 65536`; therefore a matching runtime exposes the full 65,536-token context to the single Action slot and LabFlow does not divide that value again. If a different runtime profile is detected, Settings reports it explicitly. If compaction is required, the pack includes a notice and the runtime logs `context.compacted`.

A narrow user question should produce a narrow context instead of increasing the global budget.

## 5. Output budgeting

LabFlow does not impose one hidden global output ceiling. Every AI step declares its own `max_output_tokens` **target budget** in `action.json`; the detected provider/model capability is only a hard ceiling, never the requested target by itself. This prevents a model that supports 64k/128k output from being asked for that amount when an Action only needs a compact brief or interpretation.

The effective request budget is the tightest applicable value among: the Action/step target, detected exact model maximum (or safe context headroom when only that is known), the optional Assistant override for `assistant.chat`, and **Settings → Provider → Force max output**. Provider `0` means “do not add a global cap”; it does not mean “request the provider maximum”. A positive user cap can only lower the request.

Large writing Actions remain split into bounded work units. Automatic import enrichment is deliberately a micro-request: `analysis.enrich` is a semantic-only layer (objective, variables, comparisons, labelled hypotheses and gaps), caps estimated input at 3,200 tokens, targets about 320 output tokens with a 700-token ceiling, has a 45 s work-unit deadline, and disables semantic retry. The transport itself never retries provider requests. If enrichment cannot complete, LabFlow keeps the deterministic Experiment Brief and finishes the ZIP import.

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

Retry is **Action-declared** and applies only to semantic/checkpoint recovery through `max_retries`. The transport performs exactly one HTTP attempt for each provider request and never adds hidden provider retries. Compact/automatic Actions such as enrichment and Design deliberately use zero semantic retries.

When an Action enables semantic retry, the runner uses bounded delays (currently 5 s then 10 s at most) and retries only the failed work unit. Truncated structured output is never stored as partial JSON.

Provider throttling is a separate transport result. HTTP 429 and known provider rate-limit codes are surfaced once, together with `Retry-After` when available. LabFlow creates no client pacing, circuit breaker or persisted cooldown. See [`guides/AI_TOKENS_AND_RATE_LIMITS.md`](guides/AI_TOKENS_AND_RATE_LIMITS.md).

No unbounded retry loop or provider queue.

## 9. Provider settings

Provider, endpoint and model are browser-local settings. API keys are browser-local and isolated by provider; switching providers does not reuse another provider's credential.

Action output budgets remain in Action contracts. Connection settings must not become a hidden global scientific policy.

## 10. Assistant read-tool loop and safety boundary

Chat is read-only with respect to scientific Working Copy state. `assistant.chat` receives one deterministic, bounded context assembled locally from the current page, experiment state, results, findings, provenance/Design data and any useful local Knowledge Base matches. One user turn produces one provider request; there is no model-driven tool-planning loop before the answer.

Only Tools marked both `agent_visible: true` and `access: read` can execute with `agent: true`; the registry rejects write/internal Tools even if the model names them. Tool arguments are validated against each Tool's small input contract and observations are bounded before they are added to the final Assistant context. Planner JSON is an internal control result, not user-visible thinking.

The final answer is generated only after this retrieval phase and may expose which read Tools were used as telemetry. If the Assistant identifies something that should be corrected, it may explain it or direct the researcher to the appropriate Action/Review/Design control, but it cannot invoke mutating Actions, apply patches, edit Report/Paper or modify Design as a side effect of conversation.


## Provider rate limits

LabFlow treats provider rate limiting separately from model/output failures. The configured model is never substituted automatically. A `1305`/HTTP 429 or another recognized provider limit is returned to the caller after the single HTTP attempt; `Retry-After` is parsed and displayed when the provider supplies it. LabFlow does not add client pacing, automatic transport retry, a local circuit breaker or persisted cooldown. A later researcher-requested call is therefore allowed to try again. Multi-request operations such as **Suggest all** stop at the first throttle, preserve completed suggestions and leave untouched experiments pending so the researcher can resume later. Quota/usage-window errors also fail immediately rather than triggering model fallback.


## Adaptive output budgeting

LabFlow separates desired output size from provider capability. Each AI step may declare a minimum, target and maximum output budget. `ActionRunner` adapts the request to the work unit (including Report/Paper target words) and then clamps it to the detected model/provider ceiling and optional user cap. The provider maximum must never become the default requested output size.

Long model calls emit semantic phases (`prepare`, `request`, streaming, `validate`, `store/complete`). The live UI reports estimated/exact input/output tokens, Action target/ceiling, first-token latency and generation rate. Raw SSE event counts and wire bytes are diagnostics only because many tiny provider chunks can make those numbers look enormous without representing token use. The Action inference deadline starts when the HTTP request starts. Connection tests use one small bounded payload, make one HTTP attempt and never mutate provider/model selection.
