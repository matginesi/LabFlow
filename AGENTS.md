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
Upload ZIP → Review → Results → Design → Report → Changes → NOMAD
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
- hidden autosave state;
- a separate export data model that becomes more authoritative than the Working Copy.

Only **Save** marks the internal browser representation as saved. **Export** creates the Working Copy ZIP; Report/NOMAD/other derived exports do not overwrite source.

When modifying export code, preserve the byte-for-byte original-source regression contract.

---

## 3. Canonical Store invariant

`LF.CanonicalStore` is a semantic index/view over the Working Copy, not another editable model.

Use stable IDs, aliases, relations and evidence references instead of repeatedly inferring semantics from filenames in pages/OPERATIONS.

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

AI must never silently mutate scientific state or become the authoritative calculator/readiness gate.

---

## 5. Researcher OPERATIONS

A OPERATION is a researcher-understandable goal, not an implementation function.

The Workshop public catalog is intentionally limited to:

1. Analyze dataset
2. Apply safe corrections
3. Resolve ambiguities
4. Infer missing design
5. Interpret results
6. Generate report
7. Improve report
8. Prepare NOMAD export

`assistant.chat` is visible in Workshop so every executable OPERATION can be inspected and edited; it remains non-mutating.

Do not expose internal services as new public OPERATIONS merely because they have multiple steps.

Examples that should stay internal:

- compute Results;
- rebuild Canonical Store;
- validate proposal;
- apply proposal;
- rebuild evidence;
- validate NOMAD;
- store output.

`analysis.summarize` is an internal deterministic OPERATION (auto-run with `dataset.analyze`): it stores the Analysis Dossier statistics bundle on the Working Copy. It is inspectable in the Workshop but is not a public researcher action. Its per-scan `groupStatistics` and `metrics` are the single deterministic source shared by the Results Compare table, Report statistics/figures and NOMAD derived `analysis.json`.

If adding a public OPERATION, document:

- researcher goal;
- why it exists;
- kind (`DETERMINISTIC` or `AI`);
- role (Automatic / Researcher action / AI assist);
- required input/dependency;
- mutation scope;
- ordered checkpoints;
- output;
- what it must not do.

Update `docs/specs/OPERATIONS.md` and `docs/WORKFLOW.md` when the public catalog changes.

---

## 6. Operation sources and build

Sources:

```text
operations/<id>/operation.json
operations/<id>/prompt.md       AI only
operations/schemas/*.json       structured AI output
prompts/policies/*.md      shared policies
assets/js/ai/operation-steps.js deterministic checkpoint functions
assets/js/ai/operations.js      generic runner
```

Settings exposes the same executable definitions in two views: **Operations Workshop** (all OPERATIONS) and **AI Helpers** (only OPERATIONS with AI checkpoints). AI Helpers must never create duplicate prompt/configuration state; both views edit the same browser-local runtime overrides.

Generated files are not hand-edited:

```text
assets/js/ai/operation-registry.js
assets/js/ai/prompt-bundle.js
```

After OPERATION/prompt changes run:

```bash
python tools/build_prompt_bundle.py
python tools/build_operation_registry.py
python tools/validate_operation_contract.py
```

---

## 7. Operation runtime contract

`LF.OperationRunner` is single-run and sequential.

- successful checkpoints auto-advance;
- one active run only;
- Stop aborts the run;
- AI failure retries after 5 s and 10 s only;
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

All AI/chat context uses `LF.ContextBuilder` over Canonical Store references.

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

Output budgets belong to individual Operation contracts. Assistant output/context settings are separate.

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
- truthful OPERATION progress;
- provider output closed by default;
- progressive disclosure for detail.

Avoid oversized headings, giant cards, excessive rounding, duplicate controls and page-specific components that ignore the UI Kit.

---

## 15. Documentation rule

If an architectural change affects any of these, update documentation in the same change:

- source/Working Copy lifecycle;
- Canonical Store;
- public OPERATION catalog;
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
python tools/build_operation_registry.py
python tools/validate_operation_contract.py
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
