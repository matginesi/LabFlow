# LabFlow POC specification

> **Primary detailed guide:** [`docs/WORKFLOW.md`](docs/WORKFLOW.md). This specification defines the compact product contract; the workflow document explains the full lifecycle, Action behavior, data layers and developer rules.

## 1. Product model

LabFlow is a static, local-first laboratory workbench with a deliberately small mental model:

**Upload ZIP → Review → Results → Design → Report → Changes → NOMAD**

The ZIP is the only experiment entry point. No project loader, backend, queue or hidden background workflow precedes it.

## 2. Source, Canonical Store and Working Copy

The uploaded ZIP is immutable source evidence. Original paths/names are always preserved for provenance and round-trip export; they do not define the application's semantic model.

After import, `LF.State.state.experiment` is the one scientific Working Copy. `LF.CanonicalStore` indexes that object instead of creating a second editable projection. It provides:

- stable file/sample/measurement identity;
- sample aliases derived from original naming;
- explicit relations between samples, measurements, files, Design and evidence;
- evidence references with source/locator provenance;
- deterministic lookup indexes.

Scientific collections remain on the Working Copy; Canonical Store indexes/reference them rather than copying RAW curves into another mega-object. RAW bytes remain at `raw.sourceArchive` and are never rewritten.

Every manual edit, safe correction and accepted AI proposal changes only the same in-memory Working Copy. The RAW upload is snapshotted byte-for-byte at import and never shares that mutable state. **Save** is an explicit user action that persists the internal LabFlow representation in the browser. **Export** and NOMAD export explicitly create new files from the current revision; they never overwrite the uploaded source. There is no hidden autosave copy.

Normal package export includes `canonical.json` (`labflow-canonical-v1`) containing portable canonical identities, aliases, compact measurements, relations, evidence, findings, patches, Design and provenance. RAW content remains separate and pristine.

## 3. Analysis Dossier and Experiment Brief

`dataset.analyze` is automatic and fully deterministic. It refreshes canonical identity/evidence, calculates deterministic Results and produces a compact Analysis Dossier for the current scientific state.

The dossier is a **view**, not another dataset copy. It contains counts, compact sample/measurement references, findings, safe fixes, true semantic ambiguities and coverage/evidence summaries. Large RAW arrays, full curves and duplicate auxiliary evidence do not belong in the dossier.

LabFlow also derives one shared **Experiment Brief**. Its deterministic part summarizes scope, performance, group comparisons, quality, Design coverage and unresolved questions. When an AI provider is configured at import, the internal `analysis.enrich` Action may add a bounded scientific interpretation layer (goal, variables, meaningful comparisons, interpretations, knowledge gaps and recommended focus). This enrichment is explicitly derived/provenanced, never replaces deterministic facts, and is reused by every later AI Context Pack. It is invalidated only when scientific inputs change, not when the researcher merely edits Report/Paper prose.

## 4. Research Context Packs

All AI entry points use one deterministic `LF.ContextBuilder` over the Canonical Store. A Context Pack is bounded and profile-specific; the default Assistant budget is about 12,000 characters (roughly a few thousand tokens), not the full experiment.

Profiles select only what the request needs, for example:

- chat — current page, question-matched entities, selection, relevant Results/findings/evidence and bounded history;
- ambiguity — unresolved findings plus directly linked records/evidence;
- design — one selected experiment, researcher-entered known values, explicit missing fields and linked evidence;
- results — deterministic summary/rankings/anomalies/relevant findings;
- report — shared Experiment Brief, current document/work block plus compact scientific evidence;
- nomad — canonical staging facts only when required.

RAW JV point arrays are excluded by default. AI works with stable LabFlow IDs/references and may cite them; it must not invent evidence that is not present in the Context Pack.

## 5. Researcher Actions

A Action represents a researcher-understandable goal. Internal functions such as parsing, result computation, Design evidence indexing, applying accepted proposals and validation gates are **steps/services**, not separate Actions.

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

`assistant.chat` is visible in Actions like every executable Action, while remaining read-only with respect to scientific Working Copy state.

Settings contains one editable **Actions** catalog for deterministic, AI-assisted and hybrid Actions. Each Action has one JSON definition and, only when needed, one Markdown prompt. Browser-local overrides never duplicate the source definition.

## 6. Action runtime

AI and deterministic checkpoints execute sequentially in `LF.ActionRunner` with one AbortController. Success auto-advances. Stop aborts the run. An AI checkpoint failure may retry exactly twice, after 5 seconds and 10 seconds; after those bounded attempts the user may Retry checkpoint. No background queue, concurrency, parallel model fan-out, manual Continue gate or unbounded retry loop is allowed.

Provider output is closed by default but streams live content/reasoning when available. Markdown/JSON rendering follows the active theme.

## 7. Results

Results read canonical measurements/samples directly and never require Design. Deterministic code owns FW/RV pairing, hysteresis, ranking, quality gates, Top REF/non-REF, anomalies, curve data and group comparison. `ORIGINAL_REQUEST/jv_analyzer.html` is the functional reference for useful JV analysis behavior.

AI Results interpretation is optional prose layered on these deterministic values.

## 8. Design

The Design page is researcher-first and useful without AI. Deterministic analysis prepares the experiment rail, identity links, available formulations/process/stack data, evidence and missing-field inventory immediately after import. The researcher edits the selected experiment directly.

`design.infer` is optional and receives only the currently selected experiment, its explicit missing fields and linked evidence. It produces proposals only; accepted values are merged locally without overwriting user-confirmed fields.

The active Report/Paper Markdown editor is the single textual source for MD/LaTeX/DOCX/PDF. A fresh import starts with both documents empty. Prose is created only by researcher typing or an explicit Draft action. Drafting and AI editing use the shared Experiment Brief and bounded scientific Context Packs; long documents are generated/revised as ordered sections rather than one monolithic prompt. PDF/DOCX append only figures explicitly selected in Report Studio.

## 9. NOMAD

NOMAD staging and readiness are deterministic. One revision-scoped Canonical → NOMAD mapping is shared by the UI, validation and generated `experiment.archive.yaml`. Required missing mappings block staging; AI is never authoritative for technical readiness.

## 10. UI, privacy and validation

`ui-kit.html` is the visual ground truth. Keep layouts compact/responsive, tables readable, tabs explicit and Action progress truthful.

No runtime `.env`, analytics, trackers, cookies, WebSocket or remote runtime assets. API keys are local browser settings and redacted from logs.

Before packaging, pass Action/state/UI/privacy validators, unit tests and JavaScript syntax checks.
