# LabFlow UI homogenization — design

Date: 2026-08-02 · Status: approved in brainstorming

## Goal

Homogenize the LabFlow static POC UI: consistent, professional and palette-coherent
across all pages, with special attention to the Pipeline system and its tools.
Vanilla HTML/CSS/JS only; no backend, no framework, no page-specific stylesheets.

## Scope decisions (from brainstorming)

1. **Priority scope:** Pipeline system and its tools first; then global CSS cleanup as a consequence.
2. **stack.html / solution.html:** repair by loading `assets/compatibility-domain.js` (they are detail views reached from compatibility pages, not primary routes, so the quarantine contract stays intact).
3. **Step headers:** unify `.tool-step-head` anatomy across the five CHOSE steps **and** promote per-step patterns to shared primitives.
4. **Colour system:** the Project accent (`--pipeline-accent`) governs the whole Pipeline; steps keep only a non-colour identification signal (roundel number/icon). Remove per-step `--step-tone`.
5. **CSS cleanup:** full design-system pass — missing tokens, conflicting duplicate selectors, hardcoded hex, misplaced component geometry.
6. **Page/shell anatomy:** uniform `.page-header` anatomy across primary pages; remove the redundant `projects.html` stub.
7. **Stubs:** delete only `projects.html`; **keep `project.html`** as the canonical Pipeline-step route (it renders the stepper/stage/fragment and is referenced by AGENTS.md validation routes).

## Execution order

Three sequential phases, each with its own spec→plan→implement cycle:

1. **Phase 1 — Functional fix:** repair broken detail pages; remove `projects.html`.
2. **Phase 2 — Pipeline coherence:** uniform step anatomy, single accent, shared primitives, regenerated bundle.
3. **Phase 3 — Design-system cleanup + page anatomy:** tokens, duplicates, hex→token, component geometry ownership, header uniformity.

Each phase ends with `python3 tools/validate_poc.py` and browser-console checks on the key routes.

---

## Phase 1 — Functional fix

### 1.1 Repair `stack.html` / `solution.html`

- Add `<script defer src="assets/compatibility-domain.js">` to both pages, preserving the existing script order (pipeline-bundle.js → pipeline-loader.js → app.js).
- Safety is confirmed: every `compatibility-domain.js` render starts with `if (!root) return`, so `renderProcesses`, `renderExperiments` and `bindProcessPage` are no-ops there; `renderStackBuilder()` finds `#stackBuilder` (stack.html) and `updateSolventBuilder()` finds `[data-solvent-editor]` (solution.html).
- **Add missing handlers** `edit-stack` and `edit-solution` (currently absent anywhere in the codebase). Behaviour: scroll the builder into view and show a confirmation toast. No new UI.
  - `edit-stack` → scroll/focus `#stackBuilder` panel + toast "Stack definition editor opened".
  - `edit-solution` → scroll/focus `[data-solvent-editor]` panel + toast "Solution recipe editor opened".

### 1.2 Update the validator

`tools/validate_poc.py:75` — `compatibility_routes` is `{processes.html, pipeline.html, experiments.html, experiment.html}`. Add `stack.html` and `solution.html` to this set so that:
- the "primary route loads quarantined compatibility model" check passes;
- the mirror rule (line 78) requires them to load `compatibility-domain.js`.

Rationale: these are detail views only reachable from compatibility pages (`experiment.html`) and internal links (`KB-005` → `solution.html`); they are not in the primary sidebar navigation.

### 1.3 Remove `projects.html` and migrate links

`projects.html` (6 lines) is reached from:
- `assets/app.js:1579` — action `project-new` → `location.href='projects.html#new'`.
- `assets/app.js:1809` — `if(page==='projects'&&location.hash==='#new')setTimeout(openProjectWizard,0)`.
- Six HTML links on compatibility pages (`experiment.html`, `processes.html`, `pipeline.html`, `experiments.html`) labelled "Return to Projects", "Open projects", "Manage projects".

Migration:
- HTML links on compatibility pages → `index.html` (My Workspace).
- Move the `#new` hash handling from `projects.html` to the dashboard: `if(page==='dashboard'&&location.hash==='#new')setTimeout(openProjectWizard,0)`. `project-new` continues to navigate to `index.html#new`.
- Delete `projects.html`.

### 1.4 Phase 1 completion criteria

- `python3 tools/validate_poc.py` OK.
- Browser: `stack.html` builder works (add layer, select, edit, move, duplicate, remove); `solution.html` solvent builder works (add/remove solvent, volume recalculation); `index.html` and compatibility pages load without console errors.

---

## Phase 2 — Pipeline coherence

### 2.1 Uniform `.tool-step-head` anatomy

All five CHOSE steps get the same header structure:

```html
<header class="tool-step-head">
  <div>
    <span class="eyebrow">…</span>
    <h3>…</h3>
    <p>…</p>
  </div>
  <div class="row wrap">…actions…</div>
</header>
```

- `materials`, `stack`: already conform — unchanged.
- `data`: add `.eyebrow` above `h3`; `.step-session-flag` stays as step content below the header.
- `analysis`: add `.eyebrow`; badge + `.analysis-measurement-path` stay as content.
- `export`: add `.eyebrow`; the five export buttons stay in the actions; `.summary-strip` stays below.

Edits go to `pipelines/chose/steps/*/index.html`, then regenerate `assets/pipeline-bundle.js` with `tools/sync_pipeline_bundle.py`.

### 2.2 Remove `--step-tone`; single accent

`feature-scientific-workbench.css:180` per-step rules (`--step-tone: teal/violet/accent/amber/teal`) are removed. Step headers use only `--pipeline-accent` (already applied by `scientific.css:227`). The roundel (number/icon) remains as a non-colour identification signal.

### 2.3 Shared primitives

Promote per-step patterns to reusable classes (in `feature-scientific-workbench.css`, or `components.css` when generic), and document/show each in `ui-kit.html`:

- `.step-path` — generalised stepper (from `.analysis-measurement-path`).
- `.step-flag` — reusable banner for "session only"/step notices (from `.step-session-flag`).
- `.step-strip` — generalised summary strip (from `.summary-strip`).
- `.measurement-step-selector` — keep, with consistent naming/variants.

### 2.4 Phase 2 completion criteria

- `validate_poc.py` OK (also checks the bundle is not stale).
- Browser: `project.html?step=materials|stack|data|analysis|export` all share the uniform header, single accent, no per-step colours, no console errors.

---

## Phase 3 — Design-system cleanup + page anatomy

### 3.1 Missing tokens (`assets/styles/tokens.css`)

- `--info-soft` — used by `feature-scientific-workbench.css:127`; define it in the signal-soft token family.
- `--panel` and `--radius-md` — used by `feature-reports-ai.css:714-715`; define `--panel` as a panel-surface alias and `--radius-md` as the medium radius (or map to existing semantics if they already cover the case).

### 3.2 Conflicting duplicate selectors

- `.eyebrow` (`components.css:180` muted vs `feature-workflows.css:23` accent): unify in `components.css` (muted is the canonical default); contextual colour overrides remain as targeted rules in `feature-*.css` where they are actually used (e.g. `pipeline-stage-header .eyebrow`).
- `#experimentStackList` (`feature-reports-ai.css:277` vs `feature-scientific-workbench.css:42`): single canonical definition; the other becomes contextual or is removed.
- `.report-cover` (`feature-foundations.css:248` vs `feature-workflows.css:526`): unify.

### 3.3 Hardcoded hex → tokens

Convert fixed hex / fixed `rgba` inside components to semantic tokens:
- `feature-reports-ai.css:52` `#39485a` → `var(--ink)` or `var(--muted)`.
- `feature-scientific-workbench.css` `#c79b42` (stack contact) → derive from an existing token or define a scientific token.
- `rgba(37,99,168,…)` in `feature-workflows.css` → `var(--accent)` with `color-mix` (pattern already used elsewhere).

### 3.4 Component geometry ownership

Move direct primitive definitions currently living in `feature-*.css` toward `components.css`/`tokens.css` (e.g. `.button`, `.input`, `.panel` variants defined in feature modules), respecting the ownership table in `docs/DESIGN_SYSTEM.md`. Verify the validator owner rules (`tools/validate_poc.py:178-194`) are not violated.

### 3.5 Uniform `.page-header` anatomy

On primary pages ensure consistent `eyebrow + h1 + p + page-actions`, canonical breadcrumbs (`project.html` gets a back-link to the Workspace, like `stack.html`/`solution.html`), and remove `compact-header` without `page-actions` where it no longer makes sense.

### 3.6 Phase 3 completion criteria

- `validate_poc.py` OK.
- Manual checks of the key routes in AGENTS.md (`index.html`, `project.html`, `project.html?step=stack`, `project.html?step=data`, `catalogs.html`, `editors.html`, `ui-kit.html`) without console errors.
- Visual comparison with `ui-kit.html`.

---

## Cross-cutting requirements

- All changes must keep `assets/pipeline-bundle.js` in sync with canonical YAML + step HTML (validator enforces this).
- `assets/docs-bundle.js` must remain in sync (validator enforces).
- No fetch() in runtime; no new stylesheets; no structural inline styles.
- Every phase re-runs `python3 tools/validate_poc.py`.
