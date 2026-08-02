# LabFlow UI Homogenization — Phase 2 (Pipeline Coherence) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five CHOSE steps visually coherent as one Pipeline — uniform `.tool-step-head` anatomy, a single Project accent instead of per-step colours, and reusable step primitives documented in the UI Kit.

**Architecture:** Three coordinated edits. (1) Add `.eyebrow` to the three step headers that lack it (`data`, `analysis`, `export`) and regenerate the bundle. (2) Delete the per-step `--step-tone` custom-property chain in `feature-scientific-workbench.css` and point every survivor at `var(--pipeline-accent,var(--accent))`. (3) Rename the three per-step classes to shared primitives (`.step-path`, `.step-flag`, `.step-strip`) across CSS + step HTML, regenerate the bundle, and document them in `ui-kit.html`.

**Tech Stack:** Vanilla HTML/CSS/JS, static POC, no build step. Bundle regeneration via `python3 tools/sync_pipeline_bundle.py`; verification via `python3 tools/validate_poc.py` plus manual browser checks.

## Global Constraints

- Static POC: no frameworks, no backend, no fetch(), no new stylesheets, no structural inline styles.
- `assets/pipeline-bundle.js` is generated from step HTML; never edit by hand; regenerate after step-HTML edits (validator enforces freshness).
- `assets/docs-bundle.js` untouched in this phase.
- Script order (pipeline-bundle.js → pipeline-loader.js → app.js) preserved; validator enforces.
- `scientific.css:227` keeps winning the `border-left-color` for `.tool-step-head`; our CSS edits only remove the per-step chain.
- Before finishing any change run `python3 tools/validate_poc.py` and confirm no browser-console errors on `project.html?step=materials|stack|data|analysis|export`.

---

### Task 1: Add `.eyebrow` to the `data`, `analysis`, `export` step headers

**Files:**
- Modify: `pipelines/chose/steps/data/index.html:2-5`, `pipelines/chose/steps/analysis/index.html:2`, `pipelines/chose/steps/export/index.html:1`
- Regenerate: `assets/pipeline-bundle.js` via `tools/sync_pipeline_bundle.py`
- Test: validator + browser check on the three steps

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: all five CHOSE step headers match the `eyebrow + h3 + p` anatomy; `materials`/`stack` already conform.

- [ ] **Step 1: `data` header**

Edit `pipelines/chose/steps/data/index.html:3` from:

```html
    <div><h3>Add scientific measurements</h3><p>Start from what was measured. File format, mapping and provenance are handled underneath.</p></div>
```

to:

```html
    <div><span class="eyebrow">Capture · map · evidence</span><h3>Add scientific measurements</h3><p>Start from what was measured. File format, mapping and provenance are handled underneath.</p></div>
```

- [ ] **Step 2: `analysis` header**

Edit `pipelines/chose/steps/analysis/index.html:2` from:

```html
  <header class="tool-step-head"><div><h3>Analyse scientific Measurements</h3><p>Work with JV, Dark JV, IPCE, UV/VIS and Stability semantics rather than generic filenames.</p></div><span class="badge">AI suggestions remain simulated</span></header>
```

to:

```html
  <header class="tool-step-head"><div><span class="eyebrow">Compare · interpret · conclude</span><h3>Analyse scientific Measurements</h3><p>Work with JV, Dark JV, IPCE, UV/VIS and Stability semantics rather than generic filenames.</p></div><span class="badge">AI suggestions remain simulated</span></header>
```

- [ ] **Step 3: `export` header**

Edit `pipelines/chose/steps/export/index.html:1` from:

```html
<section class="tool-step" id="exportTool"><header class="tool-step-head"><div><h3>Project report &amp; export</h3><p>This manifest is assembled from the data saved in the preceding steps.</p></div><div class="row wrap"><button class="button" type="button" data-export-xlsx>Excel</button>
```

to:

```html
<section class="tool-step" id="exportTool"><header class="tool-step-head"><div><span class="eyebrow">Assemble · export · share</span><h3>Project report &amp; export</h3><p>This manifest is assembled from the data saved in the preceding steps.</p></div><div class="row wrap"><button class="button" type="button" data-export-xlsx>Excel</button>
```

- [ ] **Step 4: Regenerate the pipeline bundle**

Run: `python3 tools/sync_pipeline_bundle.py`

- [ ] **Step 5: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS (`LabFlow validation OK: …`).

- [ ] **Step 6: Commit**

```bash
git add pipelines/chose/steps/data/index.html pipelines/chose/steps/analysis/index.html pipelines/chose/steps/export/index.html assets/pipeline-bundle.js
git commit -m "pipeline(chose): add step header eyebrows to data/analysis/export"
```

---

### Task 2: Remove `--step-tone`; single `--pipeline-accent`

**Files:**
- Modify: `assets/styles/feature-scientific-workbench.css:179`, `:180`, `:192`
- Test: validator + browser check (roundel still shows, colour is the Project accent)

**Interfaces:**
- Consumes: nothing.
- Produces: no per-step colour anywhere; step header border and roundel use `--pipeline-accent` (fallback `--accent`); the per-step `::after` glyph shapes (lines 160–167) are untouched.

- [ ] **Step 1: Line 179 border**

Edit from:

```css
body .pipeline-fragment[data-pipeline-step] .tool-step-head{margin-bottom:12px;border-left:4px solid var(--step-tone,var(--accent))}
```

to:

```css
body .pipeline-fragment[data-pipeline-step] .tool-step-head{margin-bottom:12px;border-left:4px solid var(--pipeline-accent,var(--accent))}
```

- [ ] **Step 2: Line 180 custom-property chain**

The line begins with seven `--step-tone` declarations. Delete them all, leaving the `::before` / `::after` / `h3` / `p` rules with the variable renamed. Edit the start of line 180 from:

```css
body .pipeline-fragment[data-pipeline-step="materials"]{--step-tone:var(--teal)}body .pipeline-fragment[data-pipeline-step="stack"]{--step-tone:var(--violet)}body .pipeline-fragment[data-pipeline-step="data"]{--step-tone:var(--accent)}body .pipeline-fragment[data-pipeline-step="analysis"]{--step-tone:var(--amber)}body .pipeline-fragment[data-pipeline-step="export"],body .pipeline-fragment[data-pipeline-step="share"]{--step-tone:var(--teal)}body .pipeline-fragment[data-pipeline-step="plan"]{--step-tone:var(--violet)}body .pipeline-fragment[data-pipeline-step="record"]{--step-tone:var(--accent)}body .pipeline-fragment[data-pipeline-step] .tool-step-head::before{border-color:var(--step-tone,var(--accent));background:color-mix(in srgb,var(--step-tone,var(--accent)) 12%,var(--surface))}body .pipeline-fragment[data-pipeline-step] .tool-step-head::after{color:var(--step-tone,var(--accent))}
```

to:

```css
body .pipeline-fragment[data-pipeline-step] .tool-step-head::before{border-color:var(--pipeline-accent,var(--accent));background:color-mix(in srgb,var(--pipeline-accent,var(--accent)) 12%,var(--surface))}body .pipeline-fragment[data-pipeline-step] .tool-step-head::after{color:var(--pipeline-accent,var(--accent))}
```

The `h3`/`p` rules at the end of line 180 are unchanged.

- [ ] **Step 3: Line 192 fragment gradient**

Edit from:

```css
body .pipeline-fragment[data-pipeline-step]::before{height:64px;background:linear-gradient(90deg,color-mix(in srgb,var(--step-tone,var(--accent)) 8%,var(--surface)),transparent 60%);opacity:1}
```

to:

```css
body .pipeline-fragment[data-pipeline-step]::before{height:64px;background:linear-gradient(90deg,color-mix(in srgb,var(--pipeline-accent,var(--accent)) 8%,var(--surface)),transparent 60%);opacity:1}
```

- [ ] **Step 4: Confirm no `--step-tone` remains**

Run: `grep -rn "step-tone" assets/styles/`
Expected: no matches.

- [ ] **Step 5: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 6: Browser check**

Open `project.html?step=materials`, then `?step=analysis`, then `?step=export`. The header border-left and roundel render in the Project accent on every step; the roundel glyph shape still differs per step. No console errors.

- [ ] **Step 7: Commit**

```bash
git add assets/styles/feature-scientific-workbench.css
git commit -m "refactor(css): drop per-step step-tone, single pipeline accent"
```

---

### Task 3: Promote shared step primitives (`.step-path`, `.step-flag`, `.step-strip`)

**Files:**
- Modify: `assets/styles/feature-scientific-workbench.css:70`, `:107`, `:109`, `:144`, `:145`, `:146`, `:171`, `:174`
- Modify: `pipelines/chose/steps/analysis/index.html:3`, `pipelines/chose/steps/data/index.html:6`, `pipelines/chose/steps/export/index.html:2`
- Regenerate: `assets/pipeline-bundle.js`
- Test: validator + browser check

**Interfaces:**
- Consumes: nothing; the renamed classes are not referenced from any `.js` (verified: only HTML + CSS).
- Produces: three reusable primitives available to any future step; `.summary-value` is untouched (used only inside this CSS, not a rename target).

- [ ] **Step 1: CSS rename `.analysis-measurement-path` → `.step-path`**

In `feature-scientific-workbench.css:107` rename every `.analysis-measurement-path` selector (base, `span`, `i`, `.done`, `.active`) to `.step-path`. In `:109` rename `.analysis-measurement-path{overflow-x:auto}` and `.analysis-measurement-path span{min-width:110px}` to `.step-path`.

- [ ] **Step 2: CSS rename `.step-session-flag` → `.step-flag`**

In `feature-scientific-workbench.css:70` rename `.step-session-flag` (base and `p` descendant) to `.step-flag`.

- [ ] **Step 3: CSS rename `.summary-strip` → `.step-strip`**

In `feature-scientific-workbench.css` rename every `.summary-strip` selector to `.step-strip`: `:144` (base, `span`, `strong`), `:145`, `:146`, `:171` (base, `span`, `span::after`), `:174` (`span`).

- [ ] **Step 4: HTML rename**

- `analysis/index.html:3`: `<div class="analysis-measurement-path">` → `<div class="step-path">`
- `data/index.html:6`: `<div class="step-session-flag">` → `<div class="step-flag">`
- `export/index.html:2`: `<div class="summary-strip" data-export-counts>` → `<div class="step-strip" data-export-counts>`

- [ ] **Step 5: Regenerate the pipeline bundle**

Run: `python3 tools/sync_pipeline_bundle.py`

- [ ] **Step 6: Confirm no old class names remain**

Run: `grep -rn "analysis-measurement-path\|step-session-flag" assets/ pipelines/ ui-kit.html`
Expected: no matches outside the generated bundles' git history (the new bundle contains the new names).

- [ ] **Step 7: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add assets/styles/feature-scientific-workbench.css pipelines/chose/steps/analysis/index.html pipelines/chose/steps/data/index.html pipelines/chose/steps/export/index.html assets/pipeline-bundle.js
git commit -m "refactor(pipeline): promote shared step primitives (path, flag, strip)"
```

---

### Task 4: Document the promoted primitives in `ui-kit.html`

**Files:**
- Modify: `ui-kit.html` (insert a panel row after the "Domain visuals" grid at :105)
- Test: validator + visual check of `ui-kit.html`

**Interfaces:**
- Consumes: the renamed classes from Task 3.
- Produces: UI Kit shows real markup for `.step-path`, `.step-flag`, `.step-strip`, keeping the Kit the ground truth.

- [ ] **Step 1: Insert the primitives row**

After the `</section>` closing the "Domain visuals" grid (`ui-kit.html:105`), insert a new `<section class="grid grid-3 mt-12">` with three panels:

1. **Stepper path** (`<strong>Step path</strong>` + `<small>Ordered step states</small>`) containing a `.step-path` demo:
   ```html
   <div class="step-path"><span class="done">Measurement</span><i>→</i><span class="active">Comparison</span><i>→</i><span>Finding</span><i>→</i><span>Researcher conclusion</span></div>
   ```
2. **Session flag** (`<strong>Step flag</strong>` + `<small>Inline step notice</small>`) containing a `.step-flag` demo:
   ```html
   <div class="step-flag"><span class="badge warning">Session only</span><p>Files are read locally; nothing is uploaded by this POC.</p></div>
   ```
3. **Summary strip** (`<strong>Step strip</strong>` + `<small>Count + label cells</small>`) containing a `.step-strip` demo with three `<span><strong>…</strong><small>…</small></span>` cells.

Match the existing panel style (`.panel` + `.panel-header` + `.panel-title` + `.panel-body`) used by the neighboring panels in that section.

- [ ] **Step 2: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 3: Browser check**

Open `ui-kit.html`: the new row renders with the three primitives styled identically to their in-Pipeline appearance. No console errors.

- [ ] **Step 4: Commit**

```bash
git add ui-kit.html
git commit -m "ui-kit: document promoted pipeline step primitives"
```

---

### Task 5: Final Phase 2 verification

**Files:** none modified.
**Test:** validator + full browser matrix.

- [ ] **Step 1: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 2: Browser matrix**

Open and confirm no console errors on:
- `project.html?step=materials`
- `project.html?step=stack`
- `project.html?step=data`
- `project.html?step=analysis`
- `project.html?step=export`

For each: the header shows `eyebrow + h3 + p` and the actions slot; the header border and roundel use the single Project accent (no teal/violet/amber per-step colours); step content below the header is intact.

- [ ] **Step 3: Confirm spec coverage**

- §2.1 uniform anatomy → Task 1.
- §2.2 remove `--step-tone` → Task 2.
- §2.3 primitives + ui-kit docs → Tasks 3–4.
- §2.4 completion criteria → validator + browser matrix in every task and Task 5.

---

## Self-Review Notes

- **Placeholder scan:** no TBD/TODO; every step shows exact before/after text and expected output.
- **Bundle discipline:** every step-HTML edit is followed by `tools/sync_pipeline_bundle.py` in the same task, keeping the validator green at each commit.
- **JS safety:** the renamed classes are referenced only by HTML and CSS (verified by grep before planning); no `querySelector`/`classList` breakage.
- **Scope discipline:** `.summary-value`, `.measurement-step-selector`, `materials`/`stack` headers and the roundel glyph shapes are intentionally untouched in this phase.
