# LabFlow Legacy Audit — Phase A (Remove Process/Experiment Compatibility Pages) Design

Date: 2026-08-02 · Status: approved design for the first sub-project of the codebase audit
(decisions recorded during brainstorming; parent audit design to be written for sub-projects B–E).

## Goal

Remove the four quarantined Process/Experiment compatibility pages and their demo model,
after intentionally migrating every useful concept they still own into the primary
`User → Workspace → Project → Pipeline → Step` workflow. No loss of capability: anything that
still has a job to do moves; anything that duplicated primary-model concepts is deleted.

## Why now

The TODO lists "unfinished cleanup, huge amounts of code, strange things". The audit found
`compatibility-domain.js` (273 lines) plus four HTML pages are pure compatibility surface that
ships duplicated demo data (`PSC-2026-041` 29× in app.js, `experiments` array in
`compatibility-domain.js:37-43`, `experimentRows` in app.js:468-473). The primary workflow now
covers these concepts via the Project (Pipeline steps, run records, samples, measurements,
results) and the shared Lab Cabinet. AGENTS.md §10 allows removal once concepts are migrated.

## Scope decisions (recorded during brainstorming)

1. **Remove only the legacy Process/Experiment pages.** `processes.html`, `pipeline.html`,
   `experiments.html`, `experiment.html` and their routes. `solution.html`, `stack.html`,
   `material.html`, `imports.html` stay (they are Lab Cabinet detail views, listed in the TODO
   as "to improve", not to remove).
2. **The 8-step experiment wizard is covered by Pipeline + run records.** The CHOSE pipeline's
   five steps plus `workspace.html` Project Data (samples/process runs) already express the
   guided execution flow. The wizard logic in `app.js` (`showWizardStep`, wizard actions,
   hash-to-step mapping) is deleted.
3. **Experiment cards redirect to Project run records.** The `experimentRows` cards on the
   dashboard and on `project.html` now link to `workspace.html?project=…` (Project Data), not
   to `experiment.html`.
4. **Solvent/stack builders are NOT legacy.** `solution.html` and `stack.html` (kept pages)
   depend on `updateSolventBuilder`/`addSolventRow` and the stack builder from
   `compatibility-domain.js`. These move into `app.js` (already loaded by both pages) so the
   pages keep working when `compatibility-domain.js` is deleted.
5. **KB sources re-target.** KB-002 protocol (`pipeline.html` → `project.html`), KB-008
   experiment (`experiment.html` → `workspace.html`), KB-009 stays on `report.html`.
6. **Validator contracts updated.** Remove the `compatibility_routes` set, the compatibility
   notice check and the legacy-nav check; keep every other contract intact.
7. **Docs updated.** `README.md` (compatibility-view sections, file list) and
   `docs/ARCHITECTURE.md` reflect the removal.

---

## 1. Files removed

| File | Role today |
|---|---|
| `processes.html` | compatibility pipeline catalogue |
| `pipeline.html` | compatibility Process definition detail |
| `experiments.html` | compatibility experiment directory + create wizard |
| `experiment.html` | compatibility 8-step experiment wizard |
| `assets/compatibility-domain.js` | quarantined Process/Experiment demo model + renders |

## 2. Migrations (concepts that keep a job)

### 2.1 Solvent builder → `app.js`

- Move `solventRows`, `updateSolventBuilder`, `addSolventRow` (currently
  `compatibility-domain.js:137-175`) into `app.js` as shared helpers.
- Consumers: `solution.html` (`data-solvent-editor`), `experiment.html` (removed, so only
  `solution.html` remains). The input/change handlers stay global as today.
- Script tag in `solution.html`/`stack.html`: remove `compatibility-domain.js` (they already
  load `app.js`, which now carries the builders).

### 2.2 Stack builder → `app.js`

- Move `stackBuilder`, `renderStackBuilder`, `modifySelectedLayer` and their click handlers
  (`compatibility-domain.js:177-272`) into `app.js`.
- Consumer: `stack.html` (`#stackBuilder`), `experiment.html` (removed).

### 2.3 Experiment cards → Project run records

- Keep the `experimentRows` demo array as card data (it models Project-level experiments), but
  change each `actionLink` from `experiment.html#…` to
  `workspace.html?project=…` (Project Data). The `stack.html` link inside cards stays.
- The dashboard section and `project.html#projectExperiments` renderer (app.js:604) need no
  structural change — only the target links.

### 2.4 Experiment wizard logic → delete

Remove from `app.js`:
- `wizardStep`, `showWizardStep` (app.js:763-783) and the hash-to-step mapping (app.js:1809,
  `page==='experiment'` branch, app.js:1817).
- Wizard actions: `experiment-wizard`, `minimal-experiment-create` (app.js:1599-1600),
  `create-complete` experiment target, `wizard-*` actions (app.js:1658-1662),
  `solution-prep-complete` (app.js:1543), `process-select` (process branch), `process-new`,
  `use-stack` (app.js:1719).
- The `experiment.html`-only `#startExperimentModal` logic (all in `compatibility-domain.js`).

### 2.5 KB sources re-target (app.js:1412, 1418, 1419)

- KB-002 `href: 'pipeline.html'` → `'project.html'`.
- KB-008 `href: 'experiment.html'` → `'workspace.html'`.
- KB-009 unchanged (`report.html`).

### 2.6 Residual links in kept pages

| Page | Current | New |
|---|---|---|
| `editors.html:26` | `experiment.html#analysis` | `workspace.html` |
| `solution.html:43` | `experiment.html#solutions` | `workspace.html` |
| `stack.html:38` | `pipeline.html` | `project.html` |
| `ui-kit.html:102` | `experiment.html#stacks` | `workspace.html` |

## 3. `app.js` cleanup beyond migrations

- User popover block `Compatibility processes` (app.js:198): remove.
- `currentProcess()` fallback (app.js:86-89) still referenced by `mountShell` via
  `pipelineStyle` — keep a minimal `pipelineStyle` fallback; drop the `page==='process'`
  query branch.
- Any `page==='experiments'`/`page==='process'`/`page==='processes'` handling in shell/search
  is dead once pages are gone; remove the leftover branches that reference removed pages
  (e.g. `processSearch`/`experimentSearch` in local search inputs, app.js:391, 401).

## 4. Validator (`tools/validate_poc.py`)

- Delete the `compatibility_routes` set and its two branches (lines 75-79).
- Delete the "Compatibility pages must say what they are" block (lines 238-242).
- Delete the legacy-nav check inside buildNavigation (lines 87-95) and the redundant
  buildNavigation duplicate check is kept as-is (still valid).
- The `# 2` block (duplicated pipeline metadata) and `# 2a` (bundle freshness) stay.
- Update the summary count line automatically (it derives from glob).

## 5. Docs

- `README.md`: remove the "compatibility/detail views" wording and the file-list entries for
  the four removed pages; drop `compatibility-domain.js` from the asset tree.
- `docs/ARCHITECTURE.md`: remove Process/Experiment compatibility mentions; note that
  execution records live in Project data (`workspace.html`).

## 6. Order of implementation

1. Migrate builders into `app.js` (2.1, 2.2) — verify `solution.html`, `stack.html` still work.
2. Remove legacy pages and drop the `compatibility-domain.js` script tags from kept pages.
3. Re-target experiment cards, KB sources, residual links (2.3, 2.5, 2.6).
4. Delete wizard + legacy branches from `app.js` (2.4, §3).
5. Update validator (§4) and run `python3 tools/validate_poc.py`.
6. Update docs (§5).
7. Browser smoke test per AGENTS.md: `index.html`, `project.html`, `?step=stack`, `?step=data`,
   `catalogs.html`, `editors.html`, `ui-kit.html` plus `solution.html`, `stack.html`,
   `workspace.html` — zero console errors.

## Out of scope (later sub-projects)

- Unified demo data file (`assets/core/demo-data.js`) and removal of remaining duplicates
  (Phase B).
- Splitting `app.js` into modules (Phase C).
- CSS consolidation / promotion into the design system (Phase D).
- UI Kit + docs alignment (Phase E).
