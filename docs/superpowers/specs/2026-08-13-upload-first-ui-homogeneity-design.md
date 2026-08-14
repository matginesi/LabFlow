# LabFlow Upload-first landing + UI homogeneity — design

Date: 2026-08-13. Status: approved by researcher (design gate).

Researcher request: "La pagina deve iniziare da Upload zip. Rendi più omogenea
la UI. Aggiorna ui-kit e la skill e la documentazione dove c'è bisogno."

Clarified decisions (approved):
1. The app ALWAYS starts on Upload ZIP on browser open, even when a saved
   workspace exists: the first page is the same empty Upload ZIP page reached
   after Reset all, and the researcher resumes the saved flow manually via the
   stepper / "Open Review". Keep the sidebar label "Experiment / RAW to NOMAD";
   it lands on Upload ZIP.
2. UI homogeneity covers all areas: navigation shell, tabs system, tables and
   lists, panels and sections, plus a full inconsistency audit.
3. Update `ui-kit.html`, the `labflow-ui` project skill and the docs where
   needed, in the same change.

---

## 1. Start always on Upload ZIP

### Behaviour
- On fresh boot (no saved workspace) the default route is already
  `'experiment-import'` (`state.js:39`). Unchanged.
- On workspace restore (`app.js:448`): currently resumes `ui.route` when it
  matches `/^experiment-/`, else defaults to `'experiment-understand'`. Change:
  always set `S.state.route = 'experiment-import'` (and `S.state.ui.route`
  accordingly) and set `S.state.ui.uploadLanding = true`. The restored
  experiment is still set, but the transient `uploadLanding` flag makes Upload
  render the empty Upload ZIP page (the same as Reset all); any navigation
  clears the flag (`setRoute`), after which Upload shows the immutable source
  receipt + "Open Review". The user resumes the flow manually via stepper.
- `experiment-home` alias (`state.js:120`): currently resolves to the last
  experiment route when an experiment exists. Change: always `'experiment-import'`.
- Remove the now-dead `ui.lastExperimentRoute` state:
  - `state.js:40` default; `state.js:122` tracking; `state.js:236` reset;
  - `app.js:448` write;
  - `tests/unit/state-shape-test.js:127` assertion (route test keeps asserting
    `route === 'logs'`; drop the `lastExperimentRoute` line, or replace with an
    assertion that a non-experiment route leaves route untouched);
  - verified: no other references in `tools/`, `docs/`, `LABFLOW_POC_SPEC.md`.
- Sidebar nav (`index.html` `data-route="experiment-home"`): unchanged, label
  stays "Experiment / RAW to NOMAD"; active-state logic (`app.js:129`, matches
  any `/^experiment-/` route) unchanged.
- Upload page (import-page.js): unchanged in content — it already renders the
  upload/start state when no experiment and the receipt when one exists.

### Tests to update/add
- `state-shape-test.js:122-133` — remove the `lastExperimentRoute` assertion.
- Add unit coverage (where existing route/state tests live): `experiment-home`
  resolves to `'experiment-import'` even with an experiment set; restore path
  lands on `'experiment-import'`.
- Check `tools/validate_state_contract.py` and `tools/validate_ui_contract.py`
  for any implicit dependency on `lastExperimentRoute` (none found at write
  time; re-verify during implementation).

## 2. UI homogeneity (full audit)

### 2.1 Remove dead CSS
Classes that pages/tests no longer render but that still exist in
`assets/css/app.css` and/or are still shown as examples in `ui-kit.html`:

- `design-variant`, `design-blueprint`, `design-workbench`, `design-canvas`
  (replaced by the tables workbench + chip bar in T7).
- `curve-gallery`, `curve-card`, `curve-grid` (JV curve explorer simplified).
- `compare-layout`, `compare-canvas`, `box-stats-panel`, `box-group-list`
  (replaced by `compare-workbench` / `compare-chart-shell` / `compare-group-row`
  per-scan compare).
- `report-markdown-tools` (markdown tools live in `.markdown-tools`).

Gate: before deleting a block, grep the whole `assets/js` + `tests` to confirm
zero usages (allowed to remain only if actually used).

### 2.2 Heading hierarchy rule
- Page title: `h1.h1` (in `workflowHead` / `pageHead`).
- Panel / section title: `h2.h2`.
- Nested sub-sections: `h3.h2`.
- Audit result (2026-08-13): all page renders already use `h2.h2` in
  `.panel-head` (zero `h3.h2` across `assets/js/pages/*.js`). The mix lives
  only in `ui-kit.html` examples → update those to `h2.h2` and keep pages as-is.

### 2.3 Tabs
- Base `.tabs`/`.tab` in `ui.css` stays the single definition (border surface-2
  track, active dot, min-height 32px).
- `results-tabs`, `changes-tabs`, `settings-tabs` remain minimal per-page
  overrides only (scrollbar/nowrap). Audit that no page redefines tab look.
- `report-document-choice` (document switcher) and `design-chip` (selection)
  remain documented interaction patterns, not tabs.

### 2.4 Tables
- Every table uses `.table-wrap` + `.data-table`; numeric cells `th.num`/`td.num`,
  provenance `td.mono`, dense variant `dense-table` where needed.
- Empty rows use the shared `emptyRow(n)` helper with a column count matching the
  table header. Audit every page's empty row.

### 2.5 Panels, empty states, notices, badges, buttons
- Panels: `.panel` / `.panel-head` / `.panel-body`, eyebrow + `h2.h2` + meta in
  heads where applicable.
- Empty states: `.empty`. Notices: `.notice info|warning|success`. Help text:
  `.help`. Inline metadata: `.meta`. Eyebrows: `.eyebrow`.
- Badges: `.badge info|warning|success|ai`.
- Buttons: `.button` + modifiers `primary|ghost|compact`.
- Sweep pages to replace ad-hoc variants with these classes. No structural
  layout changes; keep compact scientific density.

## 3. ui-kit.html update (visual ground truth)

- Replace the "Interactive BoxPlot workbench" section with the current Compare
  pattern: `compare-control-panel` (metric, scan FW+RV/FW/RV, ranking-eligible,
  All/REF/Clear, group rows), per-scan FW/RV boxes (`compare-chart-shell`,
  legend, raw values ≤150), `compare-summary-compact`, 6-column stats table
  (`Group | n | FW median±IQR | FW min–max | RV median±IQR | RV min–max`), PNG
  export, horizontal scroll hint, deterministic bundle reuse note.
- Update the Design section: `design-experiment-bar` chip list
  (`design-chip-list`/`design-chip`, active state, completion % + missing count),
  "AI fill gaps", "Apply experiment", "Refresh evidence", proposal panel, and
  the three editable tables (Solutions & solvents / Fabrication / Device stack).
  Remove the old variant-rail / blueprint example markup.
- Update Report Studio: Write/Preview toggle (no Split), `.markdown-tools`,
  "Improve selection" button (disabled without selection), lab/paper
  `report-document-choice` tabs, figure selector, doc-kind select in Workshop.
- Add an "Upload ZIP" entry-pattern section (start/empty state + receipt) and
  update the receipt "Navigation contract": *the app always starts on Upload
  ZIP, the first page being the same empty Upload ZIP page reached after Reset
  all; a restored workspace resumes via stepper / Open Review*.
- Single-source rule: every class used by ui-kit examples must exist in
  `assets/css/app.css`/`assets/css/ui.css` (or be added there); no example-only
  CSS. Dead examples are removed, not kept.

## 4. Project skill update (`.agent/skills/labflow-ui/SKILL.md`)

Sync the skill to current patterns:
- Entry point: the page always opens on Upload ZIP; manual resume.
- Compare per-scan FW/RV boxes + 6-column stats table.
- Design chip selector + "Apply experiment".
- Report: lab/paper tabs, Write/Preview, "Improve selection", no Split.
- Keep its mandate to read `docs/WORKFLOW.md`, `LABFLOW_POC_SPEC.md`,
  `ui-kit.html` and the relevant spec before UI changes.

## 5. Documentation

- `docs/WORKFLOW.md`: entry-point semantics — the app always starts on Upload
  ZIP; flow resume is manual; remove any mention of resuming the last route.
- Other docs only where the audit surfaces a contradiction (check
  `docs/specs/OPERATIONS.md`, `docs/ARCHITECTURE.md`).

## 6. Verification

Run the full battery (AGENTS.md §16):
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
Plus a smoke check of the landing/restore behaviour and of the ui-kit page
against the live CSS.

## Non-goals
- No change to the public OPERATION catalog.
- No structural page layouts changes; density and composition stay as in
  `ui-kit.html` "Density and composition".
- No change to save/export semantics; `raw/source.zip` stays byte-identical.
