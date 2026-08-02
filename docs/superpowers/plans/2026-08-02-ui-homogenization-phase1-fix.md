# LabFlow UI Homogenization — Phase 1 (Functional Fix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the broken `stack.html`/`solution.html` detail pages and remove the redundant `projects.html` stub, without touching the Pipeline system.

**Architecture:** Load the quarantined compatibility model (`assets/compatibility-domain.js`) on the two detail pages that need its builders, add the two missing action handlers next to the existing `use-stack` handler in `app.js`, teach the validator that these are compatibility routes, then delete `projects.html` and reroute its links/`#new` hash handling to the dashboard.

**Tech Stack:** Vanilla HTML/CSS/JS, static POC, no build step. Verification via `python3 tools/validate_poc.py` plus manual browser checks.

## Global Constraints

- Static POC: no frameworks, no backend, no fetch(), no new stylesheets.
- Every root page keeps exactly one `assets/app.css` link and one `assets/theme-init.js`.
- Script order requirement: `pipeline-bundle.js` → `pipeline-loader.js` → `app.js` (validator enforces).
- `assets/pipeline-bundle.js` and `assets/docs-bundle.js` are generated; do not edit by hand, and keep them in sync (validator enforces).
- No structural inline styles; no page-specific CSS.
- The canonical hierarchy `Workspace → Project → Pipeline → Step` must not be weakened. `project.html` stays as the Pipeline-step route.
- `compatibility-domain.js` is quarantined: it may load only on compatibility/detail routes, never on primary sidebar routes.
- Before finishing any change run `python3 tools/validate_poc.py` and confirm no browser-console errors on the touched routes.

---

### Task 1: Load `compatibility-domain.js` on `stack.html`

**Files:**
- Modify: `stack.html:9-12` (script block)
- Test: run validator + browser check

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `#stackBuilder` and `#stackLayerEditor` become interactive (rendered by `compatibility-domain.js` `renderStackBuilder()`); `data-action="stack-add-layer"`, `stack-select-layer`, `stack-layer-up/down/duplicate/remove` become live.

- [ ] **Step 1: Add the script tag**

Edit `stack.html` so the script block becomes:

```html
<link href="assets/app.css" rel="stylesheet"><script defer src="assets/exporters.js"></script>
  <script defer src="assets/pipeline-bundle.js"></script>
  <script defer src="assets/pipeline-loader.js"></script>
  <script defer src="assets/compatibility-domain.js"></script>
  <script defer src="assets/app.js"></script>
```

Placement: after `pipeline-loader.js`, before `app.js` (keeps bundle → loader → app order and loads the compatibility handlers before `app.js` reads them).

- [ ] **Step 2: Run the validator to confirm the expected failure**

Run: `python3 tools/validate_poc.py`
Expected: FAIL with `stack.html: primary route loads quarantined Process/Experiment compatibility model` — this is expected until Task 3 updates the validator.

- [ ] **Step 3: Commit**

```bash
git add stack.html
git commit -m "fix(stack): load compatibility domain so the stack builder is interactive"
```

---

### Task 2: Load `compatibility-domain.js` on `solution.html`

**Files:**
- Modify: `solution.html:9-12` (script block)
- Test: run validator + browser check

**Interfaces:**
- Consumes: nothing.
- Produces: `[data-solvent-editor]` becomes interactive (`updateSolventBuilder()` runs on DOMContentLoaded); `data-action="solvent-add"` / `solvent-remove` become live; volume recalc works on input.

- [ ] **Step 1: Add the script tag**

Edit `solution.html` so the script block becomes:

```html
<link href="assets/app.css" rel="stylesheet"><script defer src="assets/exporters.js"></script>
  <script defer src="assets/pipeline-bundle.js"></script>
  <script defer src="assets/pipeline-loader.js"></script>
  <script defer src="assets/compatibility-domain.js"></script>
  <script defer src="assets/app.js"></script>
```

- [ ] **Step 2: Run the validator to confirm the expected failure**

Run: `python3 tools/validate_poc.py`
Expected: FAIL with `solution.html: primary route loads quarantined Process/Experiment compatibility model` — expected until Task 3.

- [ ] **Step 3: Commit**

```bash
git add solution.html
git commit -m "fix(solution): load compatibility domain so the solvent builder is interactive"
```

---

### Task 3: Teach the validator that `stack.html`/`solution.html` are compatibility routes

**Files:**
- Modify: `tools/validate_poc.py:75` (the `compatibility_routes` set)
- Test: run validator

**Interfaces:**
- Consumes: Tasks 1–2 added the script tags.
- Produces: validator passes on Tasks 1–2 changes; the mirror rule at line 78 now *requires* `stack.html`/`solution.html` to load `compatibility-domain.js`.

- [ ] **Step 1: Extend the route set**

Edit `tools/validate_poc.py` line 75 from:

```python
    compatibility_routes = {"processes.html", "pipeline.html", "experiments.html", "experiment.html"}
```

to:

```python
    compatibility_routes = {"processes.html", "pipeline.html", "experiments.html", "experiment.html", "stack.html", "solution.html"}
```

- [ ] **Step 2: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS (`LabFlow validation OK: …`). No other failures.

- [ ] **Step 3: Commit**

```bash
git add tools/validate_poc.py
git commit -m "chore(validate): treat stack/solution detail pages as compatibility routes"
```

---

### Task 4: Add `edit-stack` / `edit-solution` handlers in `app.js`

**Files:**
- Modify: `assets/app.js:1716-1717` (next to the existing `edit-material` and `use-stack` handlers)
- Test: browser check on `stack.html` and `solution.html`

**Interfaces:**
- Consumes: `toast()` (defined at `app.js:340`, same scope).
- Produces: `data-action="edit-stack"` scrolls `#stackBuilder` into view with a toast; `data-action="edit-solution"` scrolls `[data-solvent-editor]` into view with a toast.

- [ ] **Step 1: Add the two handlers**

Edit `assets/app.js`, inserting immediately before the existing line:

```js
    if(action==='use-stack'){const sId=$('#stackId')?.textContent||'STK-001';location.href=`experiment.html?stack=${encodeURIComponent(sId)}`;}
```

Insert:

```js
    if(action==='edit-stack'){const builder=$('#stackBuilder');builder?.scrollIntoView({behavior:'smooth',block:'start'});toast('Stack definition editor opened','info','Edit layers, sources and deposition methods above.');}
    if(action==='edit-solution'){const editor=$('[data-solvent-editor]');editor?.scrollIntoView({behavior:'smooth',block:'start'});toast('Solution recipe editor opened','info','Adjust the solvent mixture and its basis above.');}
```

- [ ] **Step 2: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 3: Browser check**

Open `stack.html` and click "Edit definition": page scrolls to the graphical stack builder and a toast appears.
Open `solution.html` and click "Edit recipe": page scrolls to the solvent builder and a toast appears.
Expected: no console errors on either page.

- [ ] **Step 4: Commit**

```bash
git add assets/app.js
git commit -m "fix(app): add edit-stack and edit-solution handlers for detail pages"
```

---

### Task 5: Reroute `projects.html` links to `index.html`

**Files:**
- Modify: `experiment.html:21`, `processes.html:18`, `processes.html:20`, `pipeline.html:18`, `experiments.html:18`, `experiments.html:23`
- Test: validator + click-through

**Interfaces:**
- Consumes: nothing.
- Produces: no page links to `projects.html` (so Task 7 can delete it).

- [ ] **Step 1: Replace the links**

For each file, replace every `href="projects.html"` with `href="index.html"`:

- `experiment.html:21` — "Return to Projects" → `href="index.html"`
- `processes.html:18` — "Return to Projects" → `href="index.html"`
- `processes.html:20` — "Open projects" → `href="index.html"`
- `pipeline.html:18` — "Return to Projects" → `href="index.html"`
- `experiments.html:18` — "Return to Projects" → `href="index.html"`
- `experiments.html:23` — "Manage projects" → `href="index.html"`

- [ ] **Step 2: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 3: Verify no remaining HTML links**

Run: `grep -rn "projects\.html" --include="*.html" .`
Expected: no matches in `*.html` (only the two `app.js` references below remain).

- [ ] **Step 4: Commit**

```bash
git add experiment.html processes.html pipeline.html experiments.html
git commit -m "refactor(pages): point compatibility pages at index.html instead of projects.html"
```

---

### Task 6: Move the `#new` hash handling to the dashboard

**Files:**
- Modify: `assets/app.js:1579` and `assets/app.js:1809`
- Test: validator + browser check on `index.html#new`

**Interfaces:**
- Consumes: `openProjectWizard()` (defined at `app.js:422`).
- Produces: `project-new` navigates to `index.html#new`; visiting `index.html#new` opens the project wizard on the dashboard.

- [ ] **Step 1: Update the `project-new` action**

Edit `assets/app.js:1579` from:

```js
    if(action==='project-new'){location.href='projects.html#new';}
```

to:

```js
    if(action==='project-new'){location.href='index.html#new';}
```

- [ ] **Step 2: Update the boot-time hash check**

Edit `assets/app.js:1809` from:

```js
  mountShell(); mountGlobalSearch(); mountUnifiedSearch(); mountAIDrawer(); mountProcessStepWizard(); mountCabinetSelector(); renderCabinet(); renderToolsContext(); renderToolCatalog(); renderKnowledgeSources(); renderKnowledgeWelcome(); initProjectPipeline(); setPalette(document.documentElement.dataset.palette||'blue'); if(page==='report')initReportImages(); if(page==='projects'&&location.hash==='#new')setTimeout(openProjectWizard,0);
```

to (replace the trailing `page==='projects'` check with `page==='dashboard'`):

```js
  mountShell(); mountGlobalSearch(); mountUnifiedSearch(); mountAIDrawer(); mountProcessStepWizard(); mountCabinetSelector(); renderCabinet(); renderToolsContext(); renderToolCatalog(); renderKnowledgeSources(); renderKnowledgeWelcome(); initProjectPipeline(); setPalette(document.documentElement.dataset.palette||'blue'); if(page==='report')initReportImages(); if(page==='dashboard'&&location.hash==='#new')setTimeout(openProjectWizard,0);
```

- [ ] **Step 3: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 4: Browser check**

Open `index.html#new` in a fresh tab: the project wizard modal opens. No console errors.

- [ ] **Step 5: Commit**

```bash
git add assets/app.js
git commit -m "refactor(app): handle #new project wizard hash on the dashboard route"
```

---

### Task 7: Delete `projects.html`

**Files:**
- Delete: `projects.html`
- Test: validator + grep

**Interfaces:**
- Consumes: Tasks 5–6 removed all references.
- Produces: the redundant stub is gone; `index.html` is the sole projects surface.

- [ ] **Step 1: Confirm no references remain**

Run: `grep -rn "projects\.html" --include="*.html" --include="*.js" . | grep -v "docs-bundle"`
Expected: no matches (or only comments). If any remain, complete Tasks 5–6 first.

- [ ] **Step 2: Delete the file**

```bash
git rm projects.html
```

- [ ] **Step 3: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 4: Final phase check**

Run:
```bash
python3 tools/validate_poc.py
```
Then open in a browser: `index.html`, `stack.html`, `solution.html`, `experiment.html`, `processes.html`, `pipeline.html`, `experiments.html` — no console errors; the stack and solvent builders are interactive; "New project" and the `index.html#new` wizard both work.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: remove redundant projects.html stub"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 1 §1.1 (repair stack/solution) → Tasks 1–2; §1.2 (validator) → Task 3; §1.3 (remove projects.html + migrate links + #new handling) → Tasks 5–7; §1.1 missing handlers (`edit-stack`/`edit-solution`) → Task 4. Phase 1 completion criteria §1.4 → validator step in every task plus the final browser check in Task 7 Step 4.
- **Placeholder scan:** no TBD/TODO; every step shows exact code and expected output.
- **Type consistency:** `#stackBuilder`, `[data-solvent-editor]`, `openProjectWizard()`, `toast()` names match the codebase definitions verified during planning (`app.js:340`, `app.js:422`, `compatibility-domain.js:188/138`).
