# Phase A: Remove Process/Experiment Compatibility Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the four quarantined Process/Experiment compatibility pages and their demo model, migrating the still-useful solvent/stack builders into `app.js` and re-targeting experiment cards, KB sources and residual links into the primary Project workflow.

**Architecture:** This is a static POC — vanilla HTML/CSS/JS, no build step, no test framework. Each task keeps the pages loadable and the app console-clean. Verification per task is `python3 tools/validate_poc.py` plus a browser smoke check of the affected pages via agent-browser (`open`/`errors`/`console`). The solvent and stack builders move verbatim from `compatibility-domain.js` into `app.js` (already loaded by `solution.html`/`stack.html`); the wizard code and legacy branches are deleted; validator and docs are updated last.

**Tech Stack:** Vanilla JS (no modules, `window.LabFlow*` globals), HTML, CSS cascade layers, Python 3 validator, agent-browser for smoke checks.

## Global Constraints

(From AGENTS.md and the Phase A spec — apply to every task.)

- Vanilla HTML/CSS/JS only. No frameworks, no build step, no fetch/XHR at runtime.
- Every root page loads exactly one `assets/app.css` and `assets/theme-init.js`; script order must stay `pipeline-bundle.js → pipeline-loader.js → app.js` whenever `app.js` is loaded.
- `assets/pipeline-bundle.js` and `assets/docs-bundle.js` are generated — never edit by hand. Do not create new files unless the task says so.
- No structural inline styles; inline values only for data-driven values (progress widths, ratios).
- Do not duplicate Pipeline metadata or step HTML anywhere in `app.js`.
- `compatibility-domain.js` is the file being deleted this phase. `solution.html` and `stack.html` are KEPT pages; they must work after its removal.
- Every change ends with: `python3 tools/validate_poc.py` passing and zero console errors on the affected pages.
- Do not commit unless a task explicitly says to.

---

### Task 1: Migrate solvent and stack builders into `app.js`

**Files:**
- Modify: `assets/app.js`
- Reference: `assets/compatibility-domain.js:137-272` (source being migrated, deleted later)

**Interfaces:**
- Consumes: `$`, `$$`, `escapeHtml` (already defined in `app.js` at lines 4-5, 347).
- Produces: global-side functions `updateSolventBuilder`, `addSolventRow`, `renderStackBuilder`, `modifySelectedLayer` plus a `stackBuilder` state object, and click/input handlers for actions `solvent-add`, `solvent-remove`, `stack-select-layer`, `stack-add-layer`, `stack-layer-up`, `stack-layer-down`, `stack-layer-duplicate`, `stack-layer-remove` and `[data-stack-field]` inputs. Later tasks (and kept pages `solution.html`/`stack.html`) depend on these.

- [ ] **Step 1: Add the builder functions to `app.js`**

Insert the following block right after the `renderProcessInspector` function (currently ends at `assets/app.js:761`, before the `/* Wizard and ABX3 */` comment at line 763). Use the Edit tool with `oldString` = the `/* Wizard and ABX3 */` comment line, `newString` = the new block + that comment line.

```javascript
  /* Solvent and stack builders (migrated from compatibility-domain.js) */
  function solventRows(root) { return $$('[data-solvent-row]', root); }
  function updateSolventBuilder(root = document) {
    const editor = $('[data-solvent-editor]', root) || (root.matches?.('[data-solvent-editor]') ? root : null);
    if (!editor) return;
    const totalVolume = Number($('[data-solution-total-volume]', editor)?.value || 5);
    const rows = solventRows(editor);
    const ratios = rows.map(row => Math.max(0, Number($('[data-solvent-ratio]', row)?.value || 0)));
    const total = ratios.reduce((sum, value) => sum + value, 0);
    rows.forEach((row, index) => {
      const ratio = ratios[index];
      const normalized = total > 0 ? ratio / total : 0;
      const volume = $('[data-solvent-volume]', row);
      if (volume) volume.textContent = `${(totalVolume * normalized).toFixed(2)} mL`;
      const band = $('[data-solvent-band]', row);
      if (band) band.style.setProperty('--ratio', `${Math.max(3, normalized * 100)}%`);
    });
    const status = $('[data-solvent-status]', editor);
    if (status) {
      status.className = `badge ${Math.abs(total - 100) < 0.01 ? 'success' : 'warning'}`;
      status.textContent = Math.abs(total - 100) < 0.01 ? '100% · valid mixture' : `${total.toFixed(1)}% · adjust ratios`;
    }
    const visual = $('[data-solvent-visual]', editor);
    if (visual) visual.innerHTML = rows.map((row, index) => {
      const name = $('[data-solvent-name]', row)?.value || `Solvent ${index + 1}`;
      const normalized = total > 0 ? ratios[index] / total * 100 : 0;
      return `<span style="--ratio:${Math.max(4, normalized)}%"><b>${escapeHtml(name)}</b><small>${normalized.toFixed(0)}% · ${(totalVolume * normalized / 100).toFixed(2)} mL</small></span>`;
    }).join('');
  }
  function addSolventRow(editor) {
    const list = $('[data-solvent-list]', editor);
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'solvent-component-row';
    row.dataset.solventRow = '';
    row.innerHTML = `<span class="solvent-swatch" data-solvent-band></span><label><small>Solvent</small><input class="input" data-solvent-name value="GBL"></label><label><small>Ratio % v/v</small><input class="input" type="number" min="0" max="100" step="1" data-solvent-ratio value="0"></label><span class="solvent-calculated" data-solvent-volume>0.00 mL</span><button class="icon-button small" type="button" data-action="solvent-remove" aria-label="Remove solvent">×</button>`;
    list.append(row);
    updateSolventBuilder(editor);
  }
  const stackBuilder = {
    selected: 3,
    layers: [
      { type: 'substrate', role: 'Substrate', material: 'Glass / ITO', thickness: '1.1 mm', source: 'SUB-ITO-025', method: 'Cleaning + UV-Ozone' },
      { type: 'transport', role: 'Electron transport layer', material: 'SnO₂', thickness: '30 nm', source: 'SOL-SNO2-014', method: 'Spin coating' },
      { type: 'absorber', role: 'Absorber', material: 'FA–Cs perovskite', thickness: '400 nm', source: 'SOL-081', method: 'Spin coating + annealing' },
      { type: 'transport', role: 'Hole transport layer', material: 'Spiro-OMeTAD', thickness: '180 nm', source: 'SOL-HTL-012', method: 'Spin coating' },
      { type: 'contact', role: 'Back contact', material: 'Au', thickness: '80 nm', source: 'MAT-AU-03', method: 'Thermal evaporation' }
    ]
  };
  function renderStackBuilder() {
    const root = $('#stackBuilder');
    if (!root) return;
    const ordered = [...stackBuilder.layers].reverse();
    root.innerHTML = `<div class="stack-builder-canvas"><div class="stack-builder-scale"><span>Top contact</span><span>Substrate</span></div><div class="stack-builder-layers">${ordered.map((layer, visualIndex) => {
      const index = stackBuilder.layers.length - visualIndex - 1;
      return `<button type="button" class="stack-builder-layer ${layer.type} ${index === stackBuilder.selected ? 'selected' : ''}" data-action="stack-select-layer" data-layer-index="${index}"><span>${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(layer.material)}</strong><small>${escapeHtml(layer.role)} · ${escapeHtml(layer.method)}</small></span><b>${escapeHtml(layer.thickness)}</b></button>`;
    }).join('')}</div></div>`;
    const layer = stackBuilder.layers[stackBuilder.selected] || stackBuilder.layers[0];
    const form = $('#stackLayerEditor');
    if (form && layer) {
      form.innerHTML = `<div class="panel-header"><div class="panel-title"><strong>Selected layer ${stackBuilder.selected + 1}</strong><small>Every layer links material, source and deposition evidence.</small></div><span class="badge info">${escapeHtml(layer.type)}</span></div><div class="panel-body form-grid compact-form"><div class="field"><label>Role</label><input class="input" data-stack-field="role" value="${escapeHtml(layer.role)}"></div><div class="field"><label>Material</label><input class="input" data-stack-field="material" value="${escapeHtml(layer.material)}"></div><div class="field"><label>Thickness</label><input class="input" data-stack-field="thickness" value="${escapeHtml(layer.thickness)}"></div><div class="field"><label>Definition / batch</label><input class="input mono" data-stack-field="source" value="${escapeHtml(layer.source)}"></div><div class="field span-2"><label>Deposition or creation method</label><input class="input" data-stack-field="method" value="${escapeHtml(layer.method)}"></div></div><div class="panel-footer stack-layer-actions"><button class="button small" type="button" data-action="stack-layer-down">Move toward substrate</button><button class="button small" type="button" data-action="stack-layer-up">Move toward top</button><button class="button small" type="button" data-action="stack-layer-duplicate">Duplicate</button><button class="button small danger" type="button" data-action="stack-layer-remove">Remove</button></div>`;
    }
    const count = $('#stackBuilderCount');
    if (count) count.textContent = `${stackBuilder.layers.length} ordered layers`;
  }
  function modifySelectedLayer(direction) {
    const index = stackBuilder.selected;
    const next = index + direction;
    if (next < 0 || next >= stackBuilder.layers.length) return;
    [stackBuilder.layers[index], stackBuilder.layers[next]] = [stackBuilder.layers[next], stackBuilder.layers[index]];
    stackBuilder.selected = next;
    renderStackBuilder();
  }

  /* Wizard and ABX3 */
```

- [ ] **Step 2: Add the builder event handlers to `app.js`**

Extend the existing global `input` listener. Locate the block that handles `[data-stack-field]` inputs (currently `assets/app.js` contains a single `document.addEventListener('input', ...)`). Insert the solvent/stack `input` handling inside it. Find the existing `document.addEventListener('input', event => { ... })` and append these lines before its closing brace:

```javascript
    if (event.target.matches('[data-solvent-ratio],[data-solvent-name],[data-solution-total-volume]')) updateSolventBuilder(event.target.closest('[data-solvent-editor]'));
    if (event.target.matches('[data-stack-field]')) {
      const layer = stackBuilder.layers[stackBuilder.selected];
      if (layer) {
        layer[event.target.dataset.stackField] = event.target.value;
        const selected = $('[data-action="stack-select-layer"].selected');
        if (selected) {
          const strong = $('strong', selected);
          const small = $('small', selected);
          const thickness = $('b', selected);
          if (strong) strong.textContent = layer.material;
          if (small) small.textContent = `${layer.role} · ${layer.method}`;
          if (thickness) thickness.textContent = layer.thickness;
        }
      }
    }
```

Extend the existing global `click` listener. Locate the `document.addEventListener('click', event => { const button = event.target.closest('button,[data-action],...') ... })` handler (starts at `assets/app.js:1529`). Add these lines inside it, next to the other `if(action===...)` branches:

```javascript
    if (action === 'solvent-add') addSolventRow(button.closest('[data-solvent-editor]'));
    if (action === 'solvent-remove') { const editor = button.closest('[data-solvent-editor]'); button.closest('[data-solvent-row]')?.remove(); updateSolventBuilder(editor); }
    if (action === 'stack-select-layer') { stackBuilder.selected = Number(button.dataset.layerIndex); renderStackBuilder(); }
    if (action === 'stack-add-layer') { const type = button.dataset.layerType || 'transport'; stackBuilder.layers.push({ type, role: type === 'contact' ? 'Contact' : 'Functional layer', material: 'New material', thickness: '—', source: 'Select resource', method: 'Select method' }); stackBuilder.selected = stackBuilder.layers.length - 1; renderStackBuilder(); }
    if (action === 'stack-layer-up') modifySelectedLayer(1);
    if (action === 'stack-layer-down') modifySelectedLayer(-1);
    if (action === 'stack-layer-duplicate') { stackBuilder.layers.splice(stackBuilder.selected + 1, 0, { ...stackBuilder.layers[stackBuilder.selected] }); stackBuilder.selected += 1; renderStackBuilder(); }
    if (action === 'stack-layer-remove' && stackBuilder.layers.length > 1) { stackBuilder.layers.splice(stackBuilder.selected, 1); stackBuilder.selected = Math.min(stackBuilder.selected, stackBuilder.layers.length - 1); renderStackBuilder(); }
```

Extend the boot sequence. Locate the end of the `DOMContentLoaded` callback where the last boot calls happen (near `assets/app.js:1816`, `renderProcessInspector('composition');`). Add after that line:

```javascript
    $$('[data-solvent-editor]').forEach(editor => updateSolventBuilder(editor));
    renderStackBuilder();
```

- [ ] **Step 3: Run validator**

Run: `python3 tools/validate_poc.py`
Expected: `LabFlow validation OK: 21 root pages, ...` (no failure). If it fails, it must be unrelated to this task (e.g. stale bundle).

- [ ] **Step 4: Smoke-test builders with compatibility-domain.js still present**

Run agent-browser:
1. `open http://localhost:8765/solution.html` → `errors` → expect none.
2. `open http://localhost:8765/stack.html` → `errors` → expect none; `eval` `document.querySelectorAll('.stack-builder-layer').length` → expect `5`.
Expected: both pages render, zero console errors, builders work (they now use the migrated functions — the old ones are shadowed harmlessly).

- [ ] **Step 5: Commit**

```bash
git add assets/app.js
git commit -m "feat(phase-a): migrate solvent and stack builders from compatibility-domain into app.js"
```

---

### Task 2: Delete the legacy HTML pages and drop the compatibility script tag

**Files:**
- Delete: `processes.html`, `pipeline.html`, `experiments.html`, `experiment.html`
- Modify: `solution.html` (remove line with `assets/compatibility-domain.js`), `stack.html` (same)

**Interfaces:**
- Consumes: builders now live in `app.js` (Task 1).
- Produces: a repository where the four legacy pages no longer exist; `solution.html`/`stack.html` load only `exporters.js + pipeline-bundle.js + pipeline-loader.js + app.js`. Validator's `compatibility_routes` still expects `compatibility-domain.js` on `stack.html`/`solution.html` — this task intentionally leaves the validator red; Task 5 fixes it.

- [ ] **Step 1: Delete the four legacy pages**

```bash
git rm processes.html pipeline.html experiments.html experiment.html
```

- [ ] **Step 2: Remove the compatibility script from kept pages**

In `solution.html` delete the line:

```html
  <script defer src="assets/compatibility-domain.js"></script>
```

In `stack.html` delete the same line.

- [ ] **Step 3: Run validator (expected RED on compatibility rules only)**

Run: `python3 tools/validate_poc.py`
Expected: failures mention only `processes.html` / `pipeline.html` / `experiments.html` / `experiment.html` (missing compatibility notice, deleted file) — these are expected until Task 5. No *new* failures elsewhere.

- [ ] **Step 4: Smoke-test kept pages**

Run agent-browser:
1. `open http://localhost:8765/solution.html` → `errors` → expect none; `eval` `document.querySelectorAll('[data-solvent-row]').length` → expect `2`.
2. `open http://localhost:8765/stack.html` → `errors` → expect none; click a layer button, confirm `#stackLayerEditor` still updates.
Expected: solution and stack pages fully functional without `compatibility-domain.js`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phase-a): remove Process/Experiment compatibility pages"
```

---

### Task 3: Re-target experiment cards, KB sources and residual links

**Files:**
- Modify: `assets/app.js` (experimentRows links ~line 468-473; KB-002/KB-008 ~lines 1412-1419; `use-stack` action ~line 1719)
- Modify: `editors.html` (line 26), `solution.html` (line 43), `stack.html` (line 38), `ui-kit.html` (line 102)

**Interfaces:**
- Consumes: the four legacy pages no longer exist (Task 2).
- Produces: no link anywhere in the repo points to `processes.html`, `pipeline.html`, `experiments.html`, `experiment.html`. Experiment cards route to `workspace.html?project=…`.

- [ ] **Step 1: Re-target `experimentRows` action links**

In `assets/app.js`, inside the `experimentRows` array (lines 468-473), change only the two rows that still point at `experiment.html`. The current rows are:

```javascript
  const experimentRows=[
    {id:'PSC-2026-041',name:'Mixed-cation deposition window',status:'running',statusLabel:'Running',progress:92,stack:'n-i-p PSC baseline',date:'Today',actionLink:'<a class="button small primary" href="experiment.html#run">Continue</a>'},
    {id:'EXP-2026-048',name:'Antisolvent timing refinement',status:'running',statusLabel:'Running',progress:68,stack:'n-i-p PSC baseline',date:'28 Jul',actionLink:'<a class="button small primary" href="experiment.html#plan">Continue</a>'},
    {id:'EXP-2026-044',name:'Absorber concentration screening',status:'completed',statusLabel:'Completed',progress:100,stack:'n-i-p PSC baseline',date:'24 Jul',actionLink:'<a class="button small" href="workspace.html#comparisons">View results</a>'},
    {id:'EXP-2026-039',name:'Baseline device reproducibility',status:'completed',statusLabel:'Completed',progress:100,stack:'n-i-p PSC baseline',date:'18 Jul',actionLink:'<a class="button small" href="report.html#export">Export</a>'}
  ];
```

The last two rows already point at `workspace.html`/`report.html` — leave them untouched. Change the first two rows' `actionLink` from `experiment.html#run` / `experiment.html#plan` to:

```javascript
    {id:'PSC-2026-041',name:'Mixed-cation deposition window',status:'running',statusLabel:'Running',progress:92,stack:'n-i-p PSC baseline',date:'Today',actionLink:'<a class="button small primary" href="workspace.html?project=mixed#samples">Continue</a>'},
    {id:'EXP-2026-048',name:'Antisolvent timing refinement',status:'running',statusLabel:'Running',progress:68,stack:'n-i-p PSC baseline',date:'28 Jul',actionLink:'<a class="button small primary" href="workspace.html?project=mixed#samples">Continue</a>'},
```

All other fields (`id`, `name`, `stack`, `date`, `progress`, `status`, `statusLabel`) stay unchanged.

- [ ] **Step 2: Re-target KB sources**

In `assets/app.js` `knowledgeSources`:
- KB-002 (line 1412): change `href:'pipeline.html'` → `href:'project.html'`.
- KB-008 (line 1418): change `href:'experiment.html'` → `href:'workspace.html'`.
- KB-009 (line 1419) stays `href:'report.html'`.

- [ ] **Step 3: Re-target `use-stack` action**

In `assets/app.js` line 1719, replace:

```javascript
    if(action==='use-stack'){const sId=$('#stackId')?.textContent||'STK-001';location.href=`experiment.html?stack=${encodeURIComponent(sId)}`;}
```

with:

```javascript
    if(action==='use-stack'){const sId=$('#stackId')?.textContent||'STK-001';location.href=`workspace.html?project=${encodeURIComponent(currentProject().key)}&stack=${encodeURIComponent(sId)}`;}
```

- [ ] **Step 4: Re-target residual links in kept pages**

In `editors.html` line 26: change `href="experiment.html#analysis"` → `href="workspace.html"`.
In `solution.html` line 43: change `href="experiment.html#solutions"` → `href="workspace.html"`.
In `stack.html` line 38: change `href="pipeline.html"` → `href="project.html"`.
In `ui-kit.html` line 102: change `href="experiment.html#stacks"` → `href="workspace.html"`.

- [ ] **Step 5: Verify no leftover links**

Run: `grep -rn "experiment\.html\|experiments\.html\|pipeline\.html\|processes\.html" --include="*.html" --include="*.js" . | grep -v node_modules`
Expected: no matches (besides possibly `.nojekyll` or git history).

- [ ] **Step 6: Validator (still red on compatibility rules only) + smoke check**

Run: `python3 tools/validate_poc.py` — failures limited to the four deleted pages.
Run agent-browser on `index.html`, `project.html`, `workspace.html`, `stack.html`, `solution.html`, `ui-kit.html`, `editors.html` → `errors` → expect none.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(phase-a): re-target experiment cards, KB sources and residual links"
```

---

### Task 4: Delete the experiment wizard and legacy branches from `app.js`

**Files:**
- Modify: `assets/app.js`

**Interfaces:**
- Consumes: legacy pages removed (Task 2), no links remain (Task 3).
- Produces: `app.js` with no reference to removed pages or the 8-step wizard; shell/search/currentProcess cleaned; global search no longer lists `processSearch`/`experimentSearch`.

- [ ] **Step 1: Remove wizard state and `showWizardStep`**

Delete the block starting at `/* Wizard and ABX3 */` down to the closing brace of `showWizardStep` (currently lines 763-783), and the wizard-related action branches. Concretely remove:
- `let wizardStep = 0;` (line 764)
- the whole `showWizardStep` function (lines 765-783)
- `if(action==='solution-prep-complete'){...showWizardStep(1)...}` (line 1543)
- `if(action==='wizard-next'){...}`, `if(action==='wizard-resources')`, `if(action==='experiment-review')` (lines 1658-1662)
- the `page==='experiment'` hash branch in the `hashchange` listener (line 1809)
- `const hashToStep={...};showWizardStep(...)` boot line (line 1817)

Keep the `/* Wizard and ABX3 */` section's other content (`updateAbxFormula`, `addIon`) — they are still used by the ABX₃ editor on `material.html`/`editors.html`. Move `updateAbxFormula`/`addIon` out of the deleted block only if they are inside it; they are currently separate functions after `showWizardStep`, so they stay untouched.

- [ ] **Step 2: Remove experiment/process create actions**

Remove:
- `if(action==='experiment-wizard'){...location.href='experiment.html';}` (line 1599)
- `if(action==='minimal-experiment-create'){...}` (line 1600)
- `if(action==='process-new'){location.href='processes.html#new';}` (line 1571)
- In `process-select` (line 1570) remove the `if(page==='process')location.href=pipeline.html...` branch, keeping the domain set + reload for the kept-process popover if still present (see Step 4).

- [ ] **Step 3: Simplify `create-complete`**

Replace line 1645 with a version that no longer targets `experiment.html`:

```javascript
    if(action==='create-complete'){const type=button.dataset.createType;const target=type==='project'?'project.html':'catalogs.html';toast(type==='project'?'Project created':'Lab Cabinet resource created','success',type==='project'?'Opening the new project workspace.':'Saved in the shared Lab Cabinet context.');setTimeout(()=>{location.href=target;},260);}
```

- [ ] **Step 4: Remove process popover and simplify currentProcess**

Delete `mountProcessPopover` (lines 194-200) and its call in the mount sequence (`mountUserPopover(); mountProjectPopover(); mountProcessPopover(); ...` at line 167 → remove `mountProcessPopover();`), the `process-toggle` toggle branch (line 1569), and the `process` popover line in the pointerdown outside-click handler (line 1796: remove `process=$('#processPopover')` and the process clause).

In `currentProcess()` (lines 86-89), replace with a minimal fallback that no longer reads the removed pages:

```javascript
  const currentProcess=()=>domain.getCurrentProcess?.(currentUserKey)||{id:'PROC-PSC-NIP',key:'psc-nip',name:'Perovskite solar cell fabrication — n-i-p',shortName:'PSC fabrication · n-i-p',status:'Active',version:'2.0'};
```

- [ ] **Step 5: Clean search references**

Remove `processes:'#processSearch'` and `experiments:'#experimentSearch'` from the `localInput` map (line 391) and remove `'#processSearch','#experimentSearch'` from the `mountUnifiedSearch` selector list (line 401).

- [ ] **Step 6: Remove user popover compatibility block**

The "Compatibility processes" popover is `mountProcessPopover` (lines 194-200), already deleted in Step 4 (it lives outside `mountUserPopover`). Verify after Step 4 that no `Compatibility processes` text or `processes.html` link remains in `app.js` (grep for `processes.html` and `Compatibility processes` — both must be gone).

- [ ] **Step 7: Validator (still red on deleted-pages rules) + smoke check**

Run: `python3 tools/validate_poc.py` — failures limited to the four deleted pages.
Run agent-browser on `index.html`, `project.html`, `catalogs.html`, `editors.html`, `ui-kit.html`, `material.html`, `workspace.html` → `errors` → expect none. Confirm no console error mentions `experiment`, `showWizardStep`, or `compatibility-domain`.

- [ ] **Step 8: Commit**

```bash
git add assets/app.js
git commit -m "feat(phase-a): remove experiment wizard and legacy branches from app.js"
```

---

### Task 5: Update the validator

**Files:**
- Modify: `tools/validate_poc.py`

**Interfaces:**
- Consumes: legacy pages and `compatibility-domain.js` gone; `app.js` clean.
- Produces: a validator that passes again (green), enforcing only the remaining contracts.

- [ ] **Step 1: Remove compatibility-route checks**

Delete from `tools/validate_poc.py`:
- The `compatibility_routes` set and its two `if` branches (lines 75-79).
- The whole block `# 5. Compatibility pages must say what they are.` (lines 238-242).
- The `for legacy in (...)` legacy-nav loop inside the `buildNavigation` check (lines 87-95) — keep the `nav_match` extraction so the later duplicate-destination check (lines 231-236) still works.

- [ ] **Step 2: Run validator**

Run: `python3 tools/validate_poc.py`
Expected: `LabFlow validation OK: 17 root pages, 14 CSS files, 2 pipelines checked.` (page count drops from 21 to 17).

- [ ] **Step 3: Smoke-check the AGENTS.md matrix**

Run agent-browser on `index.html`, `project.html`, `project.html?step=stack`, `project.html?step=data`, `catalogs.html`, `editors.html`, `ui-kit.html` → `errors` → expect none on all.

- [ ] **Step 4: Commit**

```bash
git add tools/validate_poc.py
git commit -m "feat(phase-a): drop compatibility-route contracts from validator"
```

---

### Task 6: Update documentation

**Files:**
- Modify: `README.md`, `docs/ARCHITECTURE.md`

**Interfaces:**
- Consumes: all code changes complete and validator green.
- Produces: docs that describe the primary workflow without Process/Experiment compatibility pages.

- [ ] **Step 1: Update README**

- Remove the paragraph "Older Process/Experiment pages remain only as compatibility/detail views..." (around line 40).
- Replace the "## Compatibility pages" section (lines ~214-221) with a note that execution/run records live in Project data (`workspace.html`); remove `processes.html`, `pipeline.html`, `experiments.html`, `experiment.html` from the list and keep `stack.html`, `solution.html` as Lab Cabinet detail views.
- Remove the `compatibility-domain.js` line from the repository tree (line ~257).

- [ ] **Step 2: Update ARCHITECTURE.md**

Remove Process/Experiment compatibility mentions; note that concrete execution records (runs, samples, measurements, results) live in Project data surfaced by `workspace.html`, and the shared Lab Cabinet detail views `stack.html`/`solution.html` hold the solvent/stack builders.

- [ ] **Step 3: Final verification**

Run: `python3 tools/validate_poc.py` → expect green.
Run agent-browser on the full AGENTS.md matrix (`index.html`, `project.html`, `project.html?step=stack`, `project.html?step=data`, `catalogs.html`, `editors.html`, `ui-kit.html`) plus `solution.html`, `stack.html`, `workspace.html`, `material.html` → `errors` → expect none anywhere.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/ARCHITECTURE.md
git commit -m "docs(phase-a): drop Process/Experiment compatibility pages from README and architecture"
```

---

## Self-Review

**Spec coverage:**
- §1 (remove 4 pages + compatibility-domain.js): Task 2.
- §2.1/§2.2 (solvent/stack builders → app.js): Task 1.
- §2.3 (experiment cards → workspace.html): Task 3 Step 1.
- §2.4 (wizard deletion): Task 4.
- §2.5 (KB re-target): Task 3 Step 2.
- §2.6 (residual links): Task 3 Step 4.
- §2.6a (`use-stack` re-target): Task 3 Step 3.
- §3 (popover, currentProcess, search refs): Task 4 Steps 4-6.
- §4 (validator): Task 5.
- §5 (README + ARCHITECTURE): Task 6.
- §6 order: Tasks 1→2→3→4→5→6 matches spec order.

**Placeholder scan:** No TBD/TODO placeholders; every step has concrete code or commands. `experimentRows` original values flagged as "may differ — read first" because exact row content at app.js:468-473 is demo data the implementer must preserve; that instruction is explicit, not a placeholder.

**Type consistency:** Builder function names (`updateSolventBuilder`, `addSolventRow`, `renderStackBuilder`, `modifySelectedLayer`, `stackBuilder`) match between Task 1 (definition) and their callers in Task 1's handlers and kept pages. `currentProject()` is used by `use-stack` in Task 3 and is already defined in `app.js`. Validator marker strings (`compatibility_routes`, `compatibility-notice`) match the current `tools/validate_poc.py` line references.
