# LabFlow Results/Report/Compare/Design improvements — design

Date: 2026-08-13. Status: approved by researcher (design gate).

Covers the working session tasks #3–#6, built after the two already-fixed bugs
(#1 totem responsiveness, #2 Top REF empty due to `parser.js` `\bREF\b`
underscore-boundary bug — both implemented and verified).

Build order (approved): **#6 analysis OPERATION → #5 Report/Paper split → #3 Compare → #4 Design**.

---

## 1. #6 — New deterministic OPERATION `analysis.summarize`

### Goal (researcher-understandable)
"Prepare analysis summary": one compact, deterministic, revision-scoped analysis
bundle that Report (AI + export), Compare and NOMAD can consume without
re-computing derived statistics on every render.

### Contract
- kind `DETERMINISTIC`, role `automatic`. Public in the Workshop and runnable
  from the Report page via a "Update analysis" button.
- Requires: `dataset.analyze` (Working Copy analysed).
- Mutation scope: none. Read-only deterministic work; it does **not** advance
  the revision and does **not** invalidate NOMAD.
- Output: `exp.analysisSummary = { version, sourceRevision, computedAt, ... }`.

### Checkpoints (deterministic, no prompt/provider)
1. `analysis.collect` — compute from the current Working Copy:
   - per-metric/per-direction statistics (`eff|voc|jsc|ff` × `fw|rv`):
     n, mean, median, stddev, min, max, quartiles (Q1/Q3, IQR);
   - `groupStatistics` (per group, per scan);
   - `topNonRef`, `topRef`, `bestBySample` (compact, as in `Analysis.analyze`);
   - `anomalies` (measurements with flags);
   - findings severity summary; `dataState` (basis/revision).
2. `analysis.store` — write `exp.analysisSummary` stamped with
   `sourceRevision` = current `sync.revision`.

### Relationship to `dataset.analyze`
`dataset.analyze` refreshes Canonical Store, deterministic Results, the Analysis
Dossier, findings, safe fixes and ambiguity classification. `analysis.summarize`
produces the reusable statistical bundle for display/export. Both deterministic;
the new operation depends on the former.

### Invalidation
`exp.analysisSummary` is derived and revision-scoped. `S.State.touch('dataset')`
(state.js:153‑161 list) deletes it so stale summaries never feed Report. Freshness
check: `analysisSummary.sourceRevision === exp.sync.revision`, else re-run
deterministic collect on demand (read-only).

### Consumers
- `packReport` (assets/js/ai/context.js:28) reads statistics/groups/anomalies
  from the bundle instead of re-deriving.
- Report render + DOCX/PDF read statistics and `chartData` from the bundle.
  Figure PNGs for DOCX are rasterized **only at export time**, not on every
  page `render()` (eliminates the current per-render cost of
  report.js:317‑325 / report-page.js:26,40).
- Compare statistics table and NOMAD mapping reuse `groupStatistics`.
- `assistant.chat` context can reference the compact bundle.

### Docs to update
`docs/specs/OPERATIONS.md` catalog table, `docs/WORKFLOW.md` (§ OPERATION
catalog), regenerated registry bundle. AGENTS.md §5/§16 apply.

---

## 2. #5 — Report/Paper: two independent documents via tabs

### State model (keep "document = experiment state", "mode = UI state")
- `exp.report.labMarkdown | paperMarkdown` remain the two sources of truth;
  `report.kind` = active tab.
- `report.markdown` / `report.title` become read-only accessors derived from
  `kind` on read (single source, no persisted duplicated mirror).
- `reportMode` shrinks to `editor | preview`; drop the vestigial `'split'`
  default coercion (model.js:78).
- Keep per-document titles (`labTitle|paperTitle`) and timestamps.

### Page layout (report-page.js)
- Two clear tabs (Lab Report / Paper) from `docChoice()`. Each tab renders its
  own: meta panel, AI actions, editor + preview, export strip. Switching is
  `syncActiveReportEditor('document-switch')` → `setKind` → render (existing
  safe pattern).

### No cross-injection
- `report.store` (operation-steps.js:56) writes **only** the target document.
- `syncDesignEvidence` / `syncAnalysisEvidence` (report.js:105‑148) stop
  upserting provenance sections into **both** documents; provenance
  sections belong only to the document being written, inserted from the
  deterministic analysis bundle.

### AI per document, explicit target
- Per-tab AI actions: Generate / Improve methods · results · discussion /
  Review / Improve selection. The active tab always sends `document_kind` equal
  to the active document.
- From the Operations Workshop, `report.generate` / `report.improve` expose a
  document target selector so `document_kind` is never empty/ambiguous.
- Expose "Improve selection" in the editor toolbar whenever text is selected
  (today unreachable from the page UI).
- `report.store` unifies: given `document_kind` (or active doc) writes only that
  markdown via `setKind`/`setActiveMarkdown`.

### Figure selection & options
- Keep `figureSelection` per-figure toggles and `includeCharts` derived from it.
- Add a small "Report options" control so `includeValidation` (the unused
  `data-report-option` handler) becomes reachable.

---

## 3. #3 — Compare: scans affordated, never merged

### Scan selector
- `direction` becomes explicit: `fw | rv | both`:
  - `fw` / `rv`: single distribution per group (current behaviour, just that scan).
  - `both`: **two side-by-side boxplots per group** (FW and RV), labeled
    per box; never a merged multi-modal distribution (current `compareData`
    bug); optional paired/bridged styling.
- Plot meta line explains scan split when `both`.

### Clarity
- Blocked-measurement footnote: when `eligibleOnly` is active show
  "N measurements excluded (blocked)".
- Unified empty state when no group is selected (one message, not two).
- Stats table mirrors the plot: columns per scan (n, median, IQR) instead of a
  single merged set.
- The "REF" shortcut button now works (depends on the #2 `isRef` fix).

---

## 4. #4 — Design: one experiment at a time + visual stack/solutions

### Experiment selector
- Activate the already-defined chip selector (`.design-chip-list` /
  `.design-chip`, app.css:1752‑1753, never wired) in place of / beside the
  dropdown; `[data-design-device]` handler (app.js:311) already exists.
  Selected chip drives `selectedDesignDeviceId`.

### Apply one experiment
- New per-device button **"Apply experiment"** →
  `DesignAnalysis.applyOne(exp,'device',<idx>,'all')` scoped to the selected
  device (scope `applyAllDesign` in operation-steps.js:70 by `deviceId`).
- "AI fill gaps" (`design.infer`) remains per-device (`data-action-device`).
- Proposal panel (`proposalPanel`, design-page.js:10‑13) filters to the
  selected device (today it shows the whole stored proposal).

### Visual stack/solutions graphics
- Reactivate the unused UI-Kit vocabulary (app.css:813‑986; source
  ui-kit.html:203‑218): `.design-stack-layer` + `.layer-tone-*` colored layer
  column (substrate → top contact), `.design-solution-node` /
  `.design-formulation-block` solution cards.
- Stack graphic and solution cards sit beside / above the editable
  `.design-edit-table` tables; tables remain authoritative, graphics are
  read-only derived previews (single source of truth preserved).

---

## 5. Cross-cutting constraints (from AGENTS.md)

- Deterministic-first: analysis bundle, stats, rankings, group statistics,
  anomalies and readiness remain code-owned; AI only consumes the bundle.
- Single Working Copy (`exp`) is the only editable scientific state; all new
  derived objects are revision-scoped and invalidated by `touch()`.
- Public OPERATION additions must update `docs/specs/OPERATIONS.md` and
  `docs/WORKFLOW.md`; `analysis.summarize` qualifies (goal, why, kind, role,
  deps, mutation scope, checkpoints, output, must-nots).
- Verification (§16): regenerate `prompt-bundle.js`/`operation-registry.js`,
  run all 5 validators, unit tests, and the responsive browser audit.

## 6. Out of scope

- No new project loader / alternate entry point.
- No parallel AI, background jobs, queues, or provider fan-out.
- No second editable copy of the experiment.
- No changes to RAW source bytes or the byte-for-byte export contract.