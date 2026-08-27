# LabFlow agent instructions

Before making architectural changes, read in this order:

1. `docs/WORKFLOW.md`
2. `LABFLOW_POC_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. the relevant spec under `docs/specs/`
5. `ui-kit.html` for visual/UI changes

The goal is to keep LabFlow small, deterministic-first and understandable to a researcher.

---

## 1. Non-negotiable product workflow

The experiment entry point is always:

```text
Upload & Review → Results → Design → Report → NOMAD
```

Do not add a project loader, hidden pre-import workflow, backend queue or alternate experiment entry point unless explicitly requested.

---

## 2. Source / Working Copy invariant

The uploaded ZIP is immutable source evidence.

At import:

- clone source bytes;
- never attach the caller-owned upload buffer directly to mutable state;
- preserve original archive paths/names/content.

There is exactly one editable scientific state:

```text
LF.State.state.experiment
```

Every scientific edit applies to that Working Copy only.

Never create:

- a second editable experiment copy;
- page-owned scientific state that can diverge;
- a hidden second autosave model that can diverge from the Working Copy;
- a separate export data model that becomes more authoritative than the Working Copy.

The current Working Copy is **autosaved locally** to IndexedDB so closing/reopening LabFlow restores the same experiment, drafts, chat and Action history. **Save** remains an explicit checkpoint marker for the current revision; **Reset session** is the deliberate boundary that clears the persisted Working Copy/RAW snapshot. Provider/API-key/UI preferences persist separately. **Export** creates the durable Working Copy ZIP; Report/NOMAD/other derived exports do not overwrite source.

When modifying export code, preserve the byte-for-byte original-source regression contract.

---

## 3. Canonical Store invariant

`LF.CanonicalStore` is the internal Canonical Data Model / semantic index over the Working Copy, not another editable model. New cross-cutting capabilities should consume its grouped `labflow-canonical-v2` domains rather than invent page-specific representations.

Use stable IDs, aliases, relations and evidence references instead of repeatedly inferring semantics from filenames in pages/Actions.

### Naming rule

A filename is provenance, not automatically a sample identity.

Prefer deterministic scientific identity in this order:

1. explicit parsed identity;
2. known deterministic filename rule;
3. other deterministic source evidence;
4. explicit ambiguity.

If identity is uncertain, create a finding. Do not silently guess.

### Evidence rule

If a feature needs to explain *why* a fact exists, add/use a compact evidence item and stable reference rather than copying entire RAW text into multiple objects.

### Relation rule

Connect scientific entities by stable IDs. Avoid page-specific repeated name matching when an explicit relation can exist.

---

## 4. Deterministic-first scientific boundary

Before adding AI, ask:

> Can this be established, calculated, validated or applied by code?

If yes, it belongs in deterministic code.

Deterministic code owns at minimum:

- archive inventory;
- known-format parsing;
- canonical identity/alias resolution when unambiguous;
- FW/RV pairing;
- JV metrics;
- hysteresis;
- ranking/quality gates;
- safe correction detection/application;
- proposal target validation/application;
- Results;
- NOMAD mapping/readiness validation;
- save/export serialization.

AI may:

- resolve genuine semantic ambiguity;
- infer missing Design fields from evidence;
- interpret already-computed Results;
- generate/revise scientific prose;
- answer bounded read-only Chat questions.

A configured provider may also run the internal `analysis.enrich` step immediately after deterministic import analysis. Its output is a shared, provenance-marked Experiment Brief used by downstream AI contexts. It must not recalculate deterministic metrics or become a second scientific state. This automatic enrichment is fail-fast and deliberately small: target about 320 output tokens, 700-token hard output ceiling, 45 s absolute deadline, zero Action retries and zero provider rate-limit retries, with deterministic-Brief fallback so ZIP import always completes. Invalidate the AI brief on scientific-input changes, not on Report/Paper text edits.

AI must never silently mutate scientific state or become the authoritative calculator/readiness gate.

### Report / Paper rule

A fresh import starts with empty Report and Paper documents. Do not insert placeholder/template prose automatically. Drafting is an explicit researcher action. `report.generate` and `report.improve` must receive the shared Experiment Brief plus bounded Results/Design/findings/provenance context; split large drafting or editing jobs into deterministic document blocks/sections. Keep Common, Report-specific and Paper-specific writing aids as modes of the same bounded Actions rather than unrelated ad-hoc model calls. Report/Paper Markdown may contain standard inline `$...$` and display `$$...$$` LaTeX; prompts may use equations only when evidence supports them, and exports must preserve/render them.

---

## 5. Researcher Actions

An Action is a researcher-understandable goal, not an implementation function.

The Action manager public catalog is intentionally limited to:

1. Analyze dataset
2. Apply safe corrections
3. Resolve ambiguities
4. Infer missing design
5. Interpret results
6. Generate report
7. Improve report
8. Prepare NOMAD export

`assistant.chat` is visible in Settings → Actions so every executable Action can be inspected and edited; it remains non-mutating.

Do not expose internal services as new public Actions merely because they have multiple steps.

Examples that should stay internal:

- compute Results;
- rebuild Canonical Store;
- validate proposal;
- apply proposal;
- rebuild evidence;
- validate NOMAD;
- store output.

`analysis.summarize` is an internal deterministic Action (auto-run with `dataset.analyze`): it stores the Analysis Dossier statistics bundle on the Working Copy. It is inspectable in Settings → Actions but is not a public researcher action. Its per-scan `groupStatistics` and `metrics` are the single deterministic source shared by the Results Compare table, Report statistics/figures and NOMAD derived `analysis.json`.

If adding a public Action, document:

- researcher goal;
- why it exists;
- kind (`DETERMINISTIC` or `AI`);
- role (Automatic / Researcher action / AI assist);
- required input/dependency;
- mutation scope;
- ordered checkpoints;
- output;
- what it must not do.

Update `docs/specs/ACTIONS.md` and `docs/WORKFLOW.md` when the public catalog changes.

---

### Tool rule

A Tool is a small typed capability over the Canonical Data Model; an Action is a researcher goal/workflow that may compose Tools and AI steps. New deterministic Action checkpoints should use `tool` IDs registered in `LF.ToolRegistry`, not new direct runner branches. Keep algorithm implementations in ordinary modules / `ActionSteps` services behind the Tool Registry.

Read Tools intended for the Assistant must be explicitly `agent_visible` and `access: read`. Never expose a write Tool to the Assistant merely because the underlying function is convenient.

## 6. Action sources and build

Sources:

```text
actions/<id>/action.json
actions/<id>/prompt.md       AI only
actions/schemas/*.json       structured AI output
prompts/policies/*.md      shared policies
assets/js/ai/action-steps.js deterministic checkpoint functions
assets/js/ai/actions.js      generic runner
```

Settings exposes one **Actions** view for every executable Action. Deterministic, AI-assisted and hybrid Actions share the same registry, runner, totem and browser-local runtime overrides.

Generated files are not hand-edited:

```text
assets/js/ai/action-registry.js
assets/js/ai/prompt-bundle.js
```

After Action/prompt changes run:

```bash
python tools/build_prompt_bundle.py
python tools/build_action_registry.py
python tools/validate_action_contract.py
```

---

## 7. Action runtime contract

`LF.ActionRunner` is single-run and sequential.

- successful checkpoints auto-advance;
- one active run only;
- Stop aborts the run;
- AI retry count is declared per step (`max_retries`, 0..2); retry delays are 5 s then 10 s when enabled;
- after bounded retries expose Retry checkpoint;
- completed earlier checkpoints are preserved;
- no manual Continue gate;
- no provider queue;
- no background model job;
- no parallel model fan-out;
- no unbounded retry loop.

Provider output is closed by default but meaningful streamed content should appear live when opened. Final Markdown/JSON follows the active theme.

---

## 8. Analysis Dossier and Review

`dataset.analyze` is automatic and deterministic.

It refreshes:

- Canonical Store;
- deterministic Results;
- Analysis Dossier;
- safe fixes;
- true semantic ambiguity classification.

Review must distinguish:

1. deterministic findings;
2. safe corrections;
3. AI ambiguity proposals;
4. unresolved items requiring researcher decision.

Technical warnings such as encoding/parse/missing-file facts are not automatically AI ambiguity work.

Safe corrections can be applied individually/bulk. AI proposals are applied only through local deterministic validation.

---

## 9. Research Context Pack

AI Action contexts use `LF.ContextBuilder` over Canonical Store references. Each Action declares its profile in `input.context`. Assistant chat uses only a small bootstrap Context Pack plus observations explicitly retrieved through its allowlisted read Tools.

Never default to serializing the full experiment or RAW curves.

Context should be selected from:

- current route;
- user question;
- current selection;
- relevant canonical entities;
- compact measurements/Results;
- findings;
- evidence;
- bounded history/document excerpts.

When context is too large, narrow selection first. Do not solve every context issue by increasing a global budget.

Every AI step declares an Action-specific output target; provider/model maxima are ceilings, never automatic request sizes. Output budgets belong to individual Action contracts. Assistant output/context settings are separate. Automatic import enrichment must remain fail-fast, semantic-only and bounded; provider throttling must never turn it into a long import wait.

---

## 10. Results

Results are deterministic and independent from Design.

Keep `ORIGINAL_REQUEST/jv_analyzer.html` as the functional reference for useful JV behaviour.

Preserve:

- overview;
- rankings;
- REF/non-REF;
- measurements;
- warnings/anomalies;
- individual/overlay curves;
- group comparison;
- backing tables.

AI interpretation is read-only prose layered over deterministic Results.

---

## 11. Design

Use the UI Kit **Single-experiment Design** pattern as ground truth.

Design must be useful before AI:

- deterministic known fields visible immediately;
- researcher can edit directly;
- evidence/provenance visible;
- missing fields explicit.

`design.infer` operates only on the selected experiment/device and only missing fields. Known/user-confirmed values are authoritative and must not be silently regenerated.

---

## 12. Report

The current Markdown editor is the single textual source of truth.

`report.generate` and `report.improve` write into that editor. PDF/DOCX use the current editor text plus only explicitly selected figures.

Do not regenerate different narrative text during export.

When changing Report figures, keep the same figure-selection state for preview and exports.

Derived Report export does not mark the Working Copy saved.

---

## 13. NOMAD

NOMAD is deterministic-first.

One Canonical → NOMAD mapping plan powers:

- page UI;
- validation;
- generated entry;
- exported mapping metadata.

Do not create a second mapping implementation.

Required missing values block readiness. Optional missing values remain visible. AI is not a NOMAD readiness authority.

A relevant Working Copy mutation invalidates stale staging.

---

## 14. UI requirements

`ui-kit.html` is the visual ground truth.

Keep:

- compact scientific layout;
- sticky top bar;
- readable sidebar typography;
- explicit responsive tabs;
- responsive tables;
- theme-aware JSON/Markdown;
- truthful Action progress;
- provider output closed by default;
- progressive disclosure for detail.

Avoid oversized headings, giant cards, excessive rounding, duplicate controls and page-specific components that ignore the UI Kit.

---

## 15. Documentation rule

If an architectural change affects any of these, update documentation in the same change:

- source/Working Copy lifecycle;
- Canonical Store;
- public Action catalog;
- AI Context Pack;
- Review correction workflow;
- Design inference scope;
- Report source-of-truth/export;
- NOMAD mapping/readiness;
- save/export semantics.

`docs/WORKFLOW.md` is the canonical explanatory document. Other docs should not contradict it.

---

## 16. Verification before packaging

Run:

```bash
python tools/build_prompt_bundle.py
python tools/build_action_registry.py
python tools/validate_action_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
find assets/js tests -name '*.js' -print0 | xargs -0 -n1 node --check
```

For changes to source/edit/save semantics, test that the original archive remains byte-identical after Working Copy mutation.

For broad architectural changes, exercise at least:

```text
Import → Review → correction → Results → Design → Report → NOMAD → Save working copy
```


### Provider rate-limit handling
Treat model/provider ceilings, Action output budgets and semantic retries as separate concerns. Provider rate limits (including Z.AI 1305/HTTP 429) are surfaced after the single HTTP attempt; LabFlow performs no hidden transport retry, pacing, persisted cooldown or circuit breaker. Quota exhaustion must fail clearly.


## Long Action progress and AI output contract

- Progress MUST be monotonic and composed from Action checkpoint, foreach/work-unit position, semantic phase, and bounded SSE/token telemetry. Provider events may refine the streaming phase but MUST NOT consume validation/store completion bands.
- Sequential multi-Action UI (Design all, Report/Paper All) MUST project child progress into one parent progress bar and MUST NOT reset to zero between items.
- Provider/model output limits are ceilings. AI steps SHOULD declare `min_output_tokens`, `target_output_tokens`, and `max_output_tokens`; the runner sizes the request from the current work item and then clamps it to user/provider ceilings.
- Report/Paper work items SHOULD declare `target_words`, `min_words`, and `max_words`; prompts must produce finished substantive prose when evidence supports the requested depth.
- Applying all Design AI proposals fills only safe missing fields and MUST NOT imply completeness when source gaps remain.
- Report and Paper figure selections are document-scoped and are reviewed through the figure picker before export.
