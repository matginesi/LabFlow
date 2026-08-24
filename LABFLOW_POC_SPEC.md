# LabFlow POC specification

> **Primary detailed guide:** [`docs/WORKFLOW.md`](docs/WORKFLOW.md). This specification defines the compact product contract; the workflow document explains the full lifecycle, Action behavior, data layers and developer rules.

## 1. Product model

LabFlow is a static, local-first laboratory workbench with a deliberately small mental model:

**Upload & Review → Results → Design → Report → Changes → NOMAD**

The ZIP is the only experiment entry point. Upload and Review are one first step: before a ZIP exists the page is an upload gate; after import the same page shows the immutable source receipt and the deterministic-first review workbench. No project loader, backend, queue or hidden background workflow precedes it.

## 2. Source, Canonical Store and Working Copy

The uploaded ZIP is immutable source evidence. Original paths/names are always preserved for provenance and round-trip export; they do not define the application's semantic model.

After import, `LF.State.state.experiment` is the one scientific Working Copy. `LF.CanonicalStore` indexes that object instead of creating a second editable projection. Its internal `labflow-canonical-v2` view is the common application representation used by Tools and Actions. It groups stable domains (`experiment`, `source`, `entities`, `scientific`, `documents`, `evidence`, `relations`, `provenance`) while keeping compatibility aliases for existing modules. It provides:

- stable file/sample/measurement identity;
- sample aliases derived from original naming;
- explicit relations between samples, measurements, files, Design and evidence;
- current Results/findings/Design and Report/Paper document views;
- evidence and provenance references with source/locator provenance;
- deterministic lookup indexes.

Scientific collections remain on the Working Copy; Canonical Store indexes/reference them rather than copying RAW curves into another mega-object. RAW bytes remain at `raw.sourceArchive` and are never rewritten.

Every manual edit, safe correction and accepted AI proposal changes only the same Working Copy. The RAW upload is snapshotted byte-for-byte at import and never shares mutable scientific state. LabFlow autosaves the current Working Copy, RAW snapshot, drafts, chat and Action history locally and restores them on the next app load. **Save** marks an explicit revision checkpoint; **Reset session** explicitly clears the persisted scientific session. The reusable Design Knowledge Base persists in a separately connected local folder; provider/model/API-key/UI preferences persist separately in the browser. **Export** and NOMAD export create durable new files and never overwrite the uploaded source.

Normal package export includes `canonical.json` (`labflow-canonical-v1`) containing portable canonical identities, aliases, compact measurements, relations, evidence, findings, patches, Design and provenance. RAW content remains separate and pristine.

## 3. Analysis Dossier and Experiment Brief

`dataset.analyze` is automatic and fully deterministic. It refreshes canonical identity/evidence, calculates deterministic Results and produces a compact Analysis Dossier for the current scientific state.

The dossier is a **view**, not another dataset copy. It contains counts, compact sample/measurement references, findings, safe fixes, true semantic ambiguities and coverage/evidence summaries. Large RAW arrays, full curves and duplicate auxiliary evidence do not belong in the dossier.

LabFlow also derives one shared **Experiment Brief**. Its deterministic part summarizes scope, performance, group comparisons, quality, Design coverage and unresolved questions. When an AI provider is configured at import, the internal `analysis.enrich` Action may add a bounded scientific interpretation layer (goal, variables, meaningful comparisons, interpretations, knowledge gaps and recommended focus). This enrichment is explicitly derived/provenanced, never replaces deterministic facts, and is reused by every later AI Context Pack. It targets 3072 output tokens, has a 90 s absolute deadline, does not auto-retry during import, and falls back to the deterministic Brief if unavailable. It is invalidated only when scientific inputs change, not when the researcher merely edits Report/Paper prose.

## 4. Research Context Packs

AI Actions use deterministic, profile-specific `LF.ContextBuilder` views over the Canonical Store. The context profile is declared by each Action in `input.context` rather than inferred from the Action ID.

The Assistant is different: its bootstrap context is intentionally small (question, current page/selection, bounded history and tool policy). It may then retrieve only the evidence it needs through allowlisted read-only Tools. Tool observations are bounded before final model reuse, so the full experiment is never sent by default.

Profiles select only what a workflow needs, for example:

- assistant — small bootstrap context plus explicit read-tool observations;
- ambiguity — unresolved findings plus directly linked records/evidence;
- design — one selected experiment, researcher-entered known values, explicit missing fields and linked evidence;
- results — deterministic summary/rankings/anomalies/relevant findings;
- report — shared Experiment Brief, current document/work block plus compact scientific evidence;
- nomad — canonical staging facts only when required.

RAW JV point arrays are excluded by default. AI works with stable LabFlow IDs/references and may cite them; it must not invent evidence that is not present in the Context Pack.

## 5. Researcher Actions

An Action represents a researcher-understandable goal. Internal functions such as parsing, result computation, Design evidence indexing, applying accepted proposals and validation gates are **steps/services**, not separate Actions.

The public set is intentionally limited to eight goals:

1. `dataset.analyze` — **Automatic / DETERMINISTIC**. Build/refresh Canonical Store, Results and Analysis Dossier. No provider.
2. `dataset.correct-safe` — **Action / DETERMINISTIC**. Apply only mechanically provable fixes, then re-analyze.
3. `dataset.resolve-ambiguities` — **AI assist**. Propose resolutions for semantic ambiguities only; AI may return unresolved and never writes directly.
4. `design.infer` — **AI assist**. Suggest only missing fields for the currently selected experiment; known/user-confirmed fields are not regenerated.
5. `results.interpret` — **AI assist**. Explain deterministic Results; it never calculates or mutates them.
6. `report.generate` — **AI assist**. Generate report/paper prose from deterministic evidence.
7. `report.improve` — **AI assist**. Revise the current scientific document in one explicit mode.
8. `nomad.prepare` — **Action / DETERMINISTIC**. Build known mappings and run authoritative local staging validation. Missing semantics remain visible for researcher review.

`analysis.enrich` is an **internal automatic AI enrichment**, not a researcher-facing action. It runs only when a provider is configured and never blocks import if unavailable.

`assistant.chat` is visible in Actions like every executable Action. It is **tool-aware but read-only**: a bounded model planning loop may select only allowlisted read Tools, after which the final response is generated from those observations. It cannot invoke write Tools, mutate the Working Copy or autonomously execute mutating Actions.

Settings contains one editable **Actions** catalog for deterministic, AI-assisted and hybrid Actions. Each Action has one JSON definition and, only when needed, one Markdown prompt. Browser-local overrides never duplicate the source definition.

## 6. Action runtime

AI and deterministic checkpoints execute sequentially in `LF.ActionRunner` with one AbortController. Deterministic checkpoints resolve `tool` IDs through `LF.ToolRegistry`. `requires[]` is an actual current-revision prerequisite gate: stale/missing prerequisites block execution before step 1. Success auto-advances. Cancel aborts the run. Each AI step declares its output target and `thinking: off|auto|on`, and may declare `deadline_ms` plus `max_retries` (0..2); enabled retries use the bounded 5 s / 10 s delays. The Action policy is reconciled with detected model capability, so non-reasoning and reasoning-required models cannot receive incompatible overrides. Provider/model output limits are ceilings, not request targets. No background queue, concurrency, parallel model fan-out, manual Continue gate or unbounded retry loop is allowed.

Provider output is closed by default but streams live content/reasoning when available. Markdown/JSON rendering follows the active theme.

## 7. Results

Results read canonical measurements/samples directly and never require Design. Deterministic code owns FW/RV pairing, hysteresis, ranking, quality gates, Top REF/non-REF, anomalies, curve data and group comparison. JV Analyzer inspects one measurement with FW/RV parameter deltas, RAW point integrity and descriptive scan separation; Overlay is a separate multi-curve comparison view.

AI Results interpretation is optional prose layered on these deterministic values.

## 8. Design

The Design page is researcher-first and useful without AI. Deterministic analysis prepares the experiment rail, identity links, available formulations/process/stack data, evidence and missing-field inventory immediately after import. The researcher edits the selected experiment directly.

A separate folder-backed **Design Knowledge Base** manages reusable materials, formulations, processes and device stacks in `library.json`. It is not scientific experiment state. Applying a library record is explicit and deterministic: only compatible empty fields on the selected device are filled, and a provenance patch links the resulting Working Copy values to the record. Existing source/researcher values are protected. Its own page connects/changes/refreshes the folder, searches and edits records, merges JSON imports and exports backups. **Reset session** never modifies the connected folder.

`design.infer` is optional and receives only the currently selected experiment, its explicit missing fields, linked evidence and a bounded set of relevant local Knowledge Base records. Local records remain non-experimental knowledge context unless RAW evidence independently supports them. The Action produces proposals only; accepted values are merged locally without overwriting user-confirmed fields. Each proposal displays a 0–100 evidence-weighted reliability estimate across its decisions; this is explicitly an estimated review aid, not observed ground-truth accuracy or a replacement for validation.

The active Report/Paper Markdown editor is the single textual source for MD/LaTeX/DOCX/PDF and supports standard inline/display LaTeX formulas. A fresh import starts with both documents empty. Prose is created only by researcher typing or an explicit Draft action. Drafting and AI editing use the shared Experiment Brief and bounded scientific Context Packs; long documents are generated/revised as ordered sections rather than one monolithic prompt. PDF/DOCX append only figures explicitly selected in Report Studio.

## 9. NOMAD

NOMAD staging and readiness are deterministic. One revision-scoped Canonical → NOMAD mapping is shared by the UI, validation and generated `experiment.archive.yaml`. Required missing mappings block staging; AI is never authoritative for technical readiness.

## 10. UI, privacy and validation

`ui-kit.html` is the visual ground truth. Keep layouts compact/responsive, tables readable, tabs explicit and Action progress truthful. Modal/totem surfaces expose explicit Cancel/Close controls according to lifecycle and support Esc.

No runtime `.env`, analytics, trackers, cookies, WebSocket or remote runtime assets. API keys are local browser settings and redacted from logs.

Before packaging, pass Action/state/UI/privacy validators, unit tests and JavaScript syntax checks.


## Bounded long-running Actions

Long-running Actions report hierarchical progress instead of estimating completion from raw stream size alone. The visible hierarchy is Action → checkpoint → work unit → phase; SSE events and estimated output tokens refine progress only within the model-response phase. Multi-experiment/multi-section sequences retain one monotonic parent progress indicator.

AI steps use adaptive output profiles (`min_output_tokens`, `target_output_tokens`, `max_output_tokens`). Model/provider capability is an absolute ceiling. Report/Paper work units additionally carry word-count targets so scientific drafting receives enough output budget while compact enrich/analysis Actions remain short.

Design can complete missing variants sequentially and can apply all already-generated AI inferences in one reviewed operation. Remaining gaps remain explicitly incomplete. Report and Paper use independent figure selections and export layouts must wrap long prose, identifiers, formulas and table content in PDF/DOCX.
