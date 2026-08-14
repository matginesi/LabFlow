# Upload-first landing + UI homogeneity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app always start on the Upload ZIP screen (manual resume from the immutable source receipt) and make the UI homogeneous by removing legacy/dead CSS, aligning ui-kit.html, the labflow-ui skill and the docs with the current app.

**Architecture:** Three small, independent changes: (1) route/restore logic in `state.js`/`app.js` so every load lands on `experiment-import` and the now-dead `ui.lastExperimentRoute` is removed; (2) `ui-kit.html` is rewritten section-by-section to match the current Compare/Design/Report/UPLOAD patterns (single CSS source); (3) `app.css` dead rules are removed, grep-gated per block, followed by docs/skill sync and the full verification battery.

**Tech Stack:** Vanilla JS (state router + page renderers), CSS (app.css/ui.css/tokens.css), HTML (index.html, ui-kit.html), Python validators, Node unit tests.

## Global Constraints

- `ui-kit.html` is the visual ground truth; `docs/WORKFLOW.md` is the workflow ground truth (AGENTS.md §14, skill §Documentation discipline).
- Upload ZIP must remain the single experiment entry point; the flow is `Upload ZIP → Review → Results → Design → Report → NOMAD` (AGENTS.md §1).
- No change to save/export semantics; `raw/source.zip` must stay byte-identical after Working Copy mutation (AGENTS.md §2/§16).
- No change to the public OPERATION catalog (AGENTS.md §5).
- Deterministic-first: route/CSS changes are pure determinism, no AI involvement.
- Density/composition stay as documented in ui-kit "Density and composition"; no structural page-layout changes.
- Every CSS class used by a ui-kit example must exist in `assets/css/app.css` or `assets/css/ui.css` (single source; no example-only CSS).
- The user is AFK; the recommended options were approved. Reply in Italian only if asked; keep commits only when the user explicitly asks.

---

### Task 1: Always start on Upload ZIP (route + restore + state)

**Files:**
- Modify: `assets/js/state.js:39-40`, `assets/js/state.js:120`, `assets/js/state.js:122`, `assets/js/state.js:236`
- Modify: `assets/js/app.js:448`
- Modify: `tests/unit/state-shape-test.js:122-133`

**Interfaces:**
- Consumes: `LF.State.setRoute(route)`, `LF.State.setExperiment(exp)`, `LF.State.resetSession()` (all already exported).
- Produces: route semantics — `'experiment-home'` always resolves to `'experiment-import'`; workspace restore always lands on `'experiment-import'`; `state.ui.lastExperimentRoute` no longer exists.

- [ ] **Step 1: Update `state.js` default shape — remove `lastExperimentRoute`**

Current (`assets/js/state.js:38-44`):
```js
    ui: {
      route: 'experiment-import',
      lastExperimentRoute: 'experiment-import',
      assistantOpen: true,
```
Replace with:
```js
    ui: {
      route: 'experiment-import',
      assistantOpen: true,
```

- [ ] **Step 2: Update `setRoute` — `experiment-home` always lands on Upload**

Current (`assets/js/state.js:120-122`):
```js
    if (route === 'experiment-home') route = state.experiment && state.experiment.id ? (state.ui.lastExperimentRoute || 'experiment-understand') : 'experiment-import';
    state.ui.route = route;
    if (/^experiment-/.test(route)) state.ui.lastExperimentRoute = route;
```
Replace with:
```js
    if (route === 'experiment-home') route = 'experiment-import';
    state.ui.route = route;
```

- [ ] **Step 3: Update `resetSession` — drop `lastExperimentRoute` write**

Current (`assets/js/state.js:236`):
```js
    state.experiment=emptyExperiment(); state.operationRun=null; state.ui.route='experiment-import'; state.ui.lastExperimentRoute='experiment-import'; state.ui.resultsTab='overview';
```
Replace with:
```js
    state.experiment=emptyExperiment(); state.operationRun=null; state.ui.route='experiment-import'; state.ui.resultsTab='overview';
```

- [ ] **Step 4: Update workspace restore in `app.js` — always Upload**

Current (`assets/js/app.js:448`), the tail of the restore branch:
```js
S.state.route=/^experiment-/.test(ui.route||'')?ui.route:'experiment-understand';S.state.ui.route=S.state.route;S.state.ui.lastExperimentRoute=S.state.route;Log.info('workspace.restored',{experimentId:S.state.experiment.id,route:S.state.route});
```
Replace with:
```js
S.state.route='experiment-import';S.state.ui.route=S.state.route;Log.info('workspace.restored',{experimentId:S.state.experiment.id,route:S.state.route});
```
(`const ui=saved.ui||{};` stays — `resultsTab`, `selectedMeasurementId`, `selectedDesignDeviceId` are still read from it.)

- [ ] **Step 5: Update `state-shape-test.js` — drop old assertion, add route tests**

In the test `'values routed to designed nest, surface methods intact'` (`tests/unit/state-shape-test.js:122-133`) remove line 127:
```js
    assert(S.state.ui.lastExperimentRoute, 'experiment-import', 'last experiment route preserved');
```

Add two new tests after that test:
```js
  t['experiment-home always lands on upload, with an experiment'] = function () {
    const exp = LF.DataModel.create({ sourceName: 'home.zip' });
    S.setExperiment(exp);
    S.setRoute('experiment-home');
    assert(S.state.ui.route, 'experiment-import', 'experiment-home resolves to upload with experiment');
  };

  t['experiment-home always lands on upload, without an experiment'] = function () {
    S.resetSession();
    S.setRoute('experiment-home');
    assert(S.state.ui.route, 'experiment-import', 'experiment-home resolves to upload without experiment');
  };
```

- [ ] **Step 6: Run the unit tests and node --check**

Run:
```bash
node tests/unit/run.js tests/unit/state-shape-test.js
node --check assets/js/state.js && node --check assets/js/app.js && node --check tests/unit/state-shape-test.js
```
Expected: `state-shape-test` passes (all tests, including the two new ones); `node --check` clean.

- [ ] **Step 7: Commit**

```bash
git add assets/js/state.js assets/js/app.js tests/unit/state-shape-test.js
git commit -m "feat: always start on Upload ZIP; drop lastExperimentRoute"
```

---

### Task 2: Update ui-kit.html to current patterns

**Files:**
- Modify: `ui-kit.html` (sections `#steps`, `#import-receipt`, `#boxplot`, `#design`, `#report`, and any `h3 class="h2"` panel heads)

**Interfaces:**
- Consumes: current rendered markup/classes from `results-page.js` (compare), `design-page.js` (chip bar + tables), `report-page.js` (doc tabs + Write/Preview + Improve selection), `shared.js` (`experimentStepper`), `import-page.js` (upload/start + receipt).
- Produces: a ui-kit that matches the live app; no example references classes that do not exist in `app.css`/`ui.css`.

- [ ] **Step 1: Fix heading hierarchy in existing examples**

Grep and replace every `<h3 class="h2">` in `ui-kit.html` with `<h2 class="h2">` (page title stays `h1.h1`). The app pages already use `h2.h2` in panel heads (verified zero `h3 class="h2"` across `assets/js/pages/*.js`).

- [ ] **Step 2: Replace the "Interactive BoxPlot workbench" section with the current Compare pattern**

Replace the `<section ... id="boxplot">...</section>` block (currently `ui-kit.html:195-201`) with a section whose markup mirrors the live `compareView` output (`results-page.js:86-91`). It must use these classes (all exist in app.css):

- `.compare-workbench`, `.compare-control-panel` (with `.panel-head` + `eyebrow` + `h2.h2` "Groups & metric" + badge count)
- `.compare-control-grid` with `Metric` select (PCE / Voc / Jsc / FF), `Scan` select (FW + RV / FW / RV)
- `.checkbox-row.compare-eligible` ("ranking eligible only")
- `.row-wrap.compare-actions` with `#boxSelectAll` All / `#boxSelectRef` REF / `#boxClearGroups` Clear buttons (`.button compact` / `.button ghost compact`)
- `.compare-group-list` with `.compare-group-row` checkbox rows (`<strong>` group + `<small>` n measurements)
- `.compare-chart-panel.compact-chart` with a PNG export button and `.compare-summary-compact` strip (Selected / Values / Median range / Highest median)
- `.compare-chart-shell` (class `is-fluid`), `.chart-scroll` containing a `.results-svg.compare-svg` placeholder with an aria-label, and the 6-column stats table `Group | n | FW median±IQR | FW min–max | RV median±IQR | RV min–max` using `.data-table.dense-table.table-plain`
- A `.help` line noting: per-scan FW/RV boxes, deterministic, bundle reuse (`groupStatisticsOf`), raw values shown up to 150 points.

Remove the old `.compare-layout`, `.compare-canvas`, `.box-stats-panel`, `.box-group-list` example markup.

- [ ] **Step 3: Replace the "Single-experiment Design" section with the chip-bar + tables pattern**

Replace `<section ... id="design">...</section>` (currently `ui-kit.html:203-219`) with markup mirroring the live `render` of `design-page.js`:

- `.design-experiment-bar` containing `.design-chip-list` with `.design-chip` buttons (`<strong>` name + `<span>` sample count; one `.active`)
- `.design-completion` (`<strong>%</strong>` + `<small>N missing</small>`)
- Buttons: `AI fill gaps` (`.button.primary.compact`, `data-action="design.infer" data-action-device="…"`), `Apply experiment` (`.button.primary.compact`), `Refresh evidence` (`.button.ghost.compact`)
- `.design-proposal` panel (progressive disclosure) with `.badge.ai` proposal pills and per-device rows
- Three `.design-table-section` panels with `.panel-head` (`eyebrow` + `h2.h2` + `meta`): Solutions & solvents (`.data-table` with name/role/linked evidence), Fabrication (process steps), Device stack (layer order). Use `.badge info/success/ai` for status.
- Keep the three `.notice` contract lines at the bottom (Single-experiment Design / AI reconstruction / Live dependency), updated wording only if it contradicts the chip pattern.

Remove the old `.design-variant-rail`, `.design-variant`, `.design-blueprint`, `.design-canvas`, `.design-workbench` example markup.

- [ ] **Step 4: Update the "Report Studio" section**

Replace `<section ... id="report">...</section>` (currently `ui-kit.html:240-244`) with markup mirroring `report-page.js`:

- `.report-document-switcher` with `.report-document-tabs` and two `.report-document-choice` buttons (`role="tab"`, `aria-selected`, `.active`, icon via `data-icon`, `<strong>` + `<small>` with word count, `<em>` Editing now / Open)
- `.report-toolbar`: `.segmented.report-mobile-mode-toggle` with Write / Preview (`.button.compact` + `.primary` on active) — **no Split**
- `.markdown-tools` with ghost compact buttons (Heading / Bold / Italic / Evidence note / Table)
- `#reportImproveSelection` button (`.button.ghost.compact`, disabled, `data-action="report.improve"`) labelled "Improve selection"
- The report-figure selector and export strip as currently rendered
- A `.notice` line: editor is the single text source; lab/paper switch never merges text; derived exports do not mark saved.

- [ ] **Step 5: Add the Upload entry pattern and update the navigation contract**

- In the `#steps` section add a sentence under the stepper: "The app always opens on Upload ZIP. With a restored workspace the immutable source receipt is shown and the flow is resumed manually via the stepper or Open Review."
- Update the `#import-receipt` `.notice info` line ("Navigation contract.") to: "The app always starts on Upload ZIP. A successful import opens Review immediately; Upload remains available as the immutable source receipt and ZIP replacement point. Reloading the page returns to Upload ZIP."
- Add a compact `#upload-entry` section (before `#import-receipt`) showing the start/empty state: `.upload-panel`, a `.button.primary` "Upload ZIP", `.help` "The ZIP is the only experiment entry point", and the `.import-path`/`.import-family-grid` receipt components when an experiment is loaded.

- [ ] **Step 6: Single-source check**

Run:
```bash
node --check ui-kit.html 2>/dev/null; grep -oE 'class="[^"]+"' ui-kit.html | tr ' ' '\n' | sed 's/class="//;s/"//' | tr ',' '\n' | sed 's/^ *//' | sort -u > /tmp/kit-classes.txt
python3 - <<'EOF'
import re
css = open('assets/css/app.css').read() + open('assets/css/ui.css').read()
missing = [c for c in open('/tmp/kit-classes.txt').read().split('\n') if c and ('.'+c) not in css]
print('classes missing from app/ui css:', missing or 'NONE')
EOF
```
Expected: `NONE` (or the few classes you added to `app.css` in this task). Note: `aria-*`, `data-*`, generic words like `active`, `meta`, `help`, `stack`, `two-col`, `mt-2` are permitted if defined in `ui.css`.

- [ ] **Step 7: Commit**

```bash
git add ui-kit.html
git commit -m "docs(ui-kit): sync Compare, Design, Report, Upload entry with the app"
```

---

### Task 3: Remove confirmed-dead CSS from app.css

**Files:**
- Modify: `assets/css/app.css` (specific dead blocks; see ranges)

**Interfaces:**
- Consumes: Task 2 (ui-kit no longer references the orphan classes). Grep gates per block against `assets/js`, `tests`, `index.html`, `ui-kit.html`.
- Produces: a leaner `app.css` with no rules for classes that nothing renders.

- [ ] **Step 1: Confirm the dead-class gate**

For every class listed below, run the gate and confirm **zero** references:
```bash
for c in advanced-panel dossier-fix-table dossier-fixes dossier-panel-body dossier-reason dossier-status-badge dossier-summary-row dossier-table-head dossier-table-wrap dossier-target fit-chart responsive-table span-2 thinking-markdown thinking-panel; do echo "== $c"; grep -rn "\b$c\b" assets/js tests index.html ui-kit.html || echo "  DEAD"; done
```
All must print `DEAD` before removal. If any prints a hit, that class must be kept (note it in the commit message).

- [ ] **Step 2: Remove the confirmed-dead rules**

Remove exactly these rule blocks from `assets/css/app.css`:

- `:162-163` `.advanced-panel > summary` (both rules)
- `:262-264` `.thinking-panel` and `.thinking-markdown`
- `:1344-1345` `.chart-scroll.fit-chart` (both rules)
- `:1426-1458` the `dossier-*` region: `.dossier-panel-body`, `.dossier-summary-row` (+ child rules), `.dossier-fixes`, `.dossier-table-head`, `.dossier-table-wrap`, `.dossier-fix-table` (+ `:nth-child`/`td` rules), `.dossier-status-badge`, `.dossier-reason`, `.dossier-target`. **Verify with `sed -n '1410,1465p'` that no live selector sits inside these lines before deleting the whole span; if a live rule shares the span, delete only the dossier selector lines.**
- `.span-2` occurrences at `:1675` and `:1712` (remove the `.span-2{...}` / `.design-editor-grid .span-2{...}` declarations only — keep the surrounding `design-editor-grid` rules)
- `.responsive-table` at `:1708` (inside the media-query block: remove the `.review-step table,.review-step .responsive-table{...}` rule, keeping the plain `.review-step table` rule intact)

After each removal, re-run the gate from Step 1; all must still be `DEAD`.

- [ ] **Step 3: Remove the ui-kit-orphan design/curve/compare rules**

These classes are referenced only by the old ui-kit examples removed in Task 2 (the app pages use `design-chip`, `curve-list-panel`, `compare-workbench` instead). Confirm with the gate, then remove:

- `:386-415` `.curve-gallery-head`, `.curve-gallery`, `.curve-card` (+ `:hover`, `:focus-visible`, `.curve-card-head`, `.curve-card-meta`, `.curve-card-actions`)
- `:817-829` `.design-workbench`, `.design-variant-rail` (+ `.panel-body`), `.design-variant` (+ all child selectors), `.design-variant-number`, `.design-canvas`
- `:839-849` `.design-blueprint` (+ `.design-blueprint-flow`, `-stage`, `-arrow`, `-arrow::before/::after`)
- `:1170-1172` `.curve-gallery`, `.curve-card`, `.curve-card .svg-chart-wrap` (note: `.svg-chart-wrap` itself at other lines is used by `curveSvg` — do **not** remove it)
- `:1173-1175` `.compare-layout`, `.compare-controls`, `.box-group-list` (keep `.chart-scroll`, `.compare-svg`, `.box-whisker` below them)
- `:1584-1587` the `/* Experiment Design */` comment block with `.design-layout-v2`, `.design-variant-rail`, `.design-main-v2`, `.design-focus-v2`, `.design-edit-sections`, `.experiment-map`, `.design-map` — **only if the gate shows all dead**
- `:1664-1668` the `/* Experiment Design v3 */` block: `.design-workbench-v3`, `.design-variant-rail-v3`, `.design-variant` (v3 redefinition), `.design-variant-number`, `.design-variant-copy`, `.design-canvas-v3`, `.design-selected-head`
- Also remove `:1708`/`:1712` media-query rules whose selectors reference `review-ai-workbench`/`design-*-v3`/`design-flow-*`/`design-editor-grid .span-2` **only if every selector in that rule is dead** (keep rules that mix live selectors — e.g. `.design-selected-head` appears both live and dead; check each).

Gate every candidate class before deleting. When in doubt, keep the rule and add a `/* legacy: verify */` comment instead.

- [ ] **Step 4: Re-run the audit script and verify the app still renders**

Run:
```bash
python3 - <<'EOF'
import re, glob
css = open('assets/css/app.css').read()
classes = set()
for b in re.findall(r'([^{}]+)\{', css):
    for m in re.findall(r'\.([a-zA-Z0-9_-]+)', b):
        classes.add(m)
needles = ''
for p in glob.glob('assets/js/**/*.js', recursive=True) + glob.glob('tests/**/*.js', recursive=True):
    needles += open(p).read()
needles += open('index.html').read() + open('ui-kit.html').read()
dead = []
for c in sorted(classes):
    if c in needles: continue
    parts = c.split('-'); dyn = any('-'.join(parts[:i])+'-' in needles for i in range(1, len(parts)))
    if dyn: continue
    dead.append(c)
print('\n'.join(dead) or 'NONE')
EOF
node --check assets/css/app.css 2>/dev/null; echo "css has no node check; run validators instead"
python3 tools/validate_ui_contract.py
python3 tools/validate_state_contract.py
```
Expected: audit reports `NONE` or only classes you consciously kept; both validators OK.

- [ ] **Step 5: Commit**

```bash
git add assets/css/app.css
git commit -m "style: remove legacy dead CSS from app.css"
```

---

### Task 4: UI homogeneity sweep (tabs, tables, panels, empty states)

**Files:**
- Verify: `assets/js/pages/{results,design,report,changes,nomad,settings,understand,import}-page.js`
- Modify (only if an inconsistency is found): the offending page file and/or `assets/css/app.css`

**Interfaces:**
- Consumes: the current page renders; the ui.css base (`.tabs`/`.tab`, `.data-table`, `.panel`, `.empty`, `.notice`, `.badge`, `.button`).
- Produces: a verified statement that all pages use the shared base classes; any found inconsistencies fixed.

- [ ] **Step 1: Verify tabs consistency**

Grep all `data-settings-section`, `data-result-tab`, `data-changes-tab`, `role="tablist"` renderers. Confirm each uses `<nav class="tabs ..."><button class="tab ...">` from ui.css and only per-page classes `results-tabs`/`changes-tabs`/`settings-tabs` as extra overrides. Fix any page that re-implements tab styling.

- [ ] **Step 2: Verify tables and empty rows**

For each `.data-table` render, confirm it lives in a `.table-wrap`, uses `th.num`/`td.num` for numeric cells and `td.mono` for identifiers, and that its `emptyRow(n,...)` `n` equals the number of `<th>` columns. Known current counts: results measurement table 12, top/rankings 6, curves list 8, compare stats 6. Fix mismatches.

- [ ] **Step 3: Verify panels, empty states, notices, badges, buttons**

Scan `assets/js/pages/*.js` for ad-hoc class names that duplicate `.empty`, `.notice`, `.help`, `.meta`, `.eyebrow`, `.badge`, `.button` (e.g. a page inventing its own empty-state or button class). Replace with the shared classes. Confirm `.panel-head` titles are `h2.h2` everywhere (page title remains `h1.h1`).

- [ ] **Step 4: Run the app smoke check + tests**

Run:
```bash
python3 tools/validate_ui_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
```
Expected: validator OK; all unit tests green. If any page render test asserts a now-changed empty-state class, update the test in the same commit.

- [ ] **Step 5: Commit**

```bash
git add assets/js/pages assets/css/app.css
git commit -m "style: unify tabs, tables, panels and empty states across pages"
```
(If no file changed, skip the commit and note "no inconsistencies found".)

---

### Task 5: Update the labflow-ui project skill

**Files:**
- Modify: `.agent/skills/labflow-ui/SKILL.md`

**Interfaces:**
- Consumes: Task 1 (entry point), Task 2 (ui-kit patterns).
- Produces: a skill consistent with the current app and `docs/WORKFLOW.md`.

- [ ] **Step 1: Update the "Product workflow" entry-point paragraph**

Current (`SKILL.md:24`): `Upload is always the experiment entry point.` Replace with:
```markdown
Upload is always the experiment entry point. The app always opens on the Upload
ZIP screen, even when a workspace was previously saved: the immutable source
receipt is shown and the researcher resumes the flow manually via the stepper or
Open Review. Do not resume a previous experiment route on reload.
```

- [ ] **Step 2: Update the "Results" Compare line**

After the existing "Compare must prioritize readability…" paragraph (`SKILL.md:193`) add:
```markdown
Compare uses per-scan Forward/Reverse box pairs with a 6-column stats table
(Group | n | FW median±IQR | FW min–max | RV median±IQR | RV min–max) and reuses
the deterministic analysis bundle (groupStatisticsOf) for both the page and
exports.
```

- [ ] **Step 3: Update the "Single-experiment Design" pattern**

Replace the "experiment/device rail" bullet (`SKILL.md:218`) with:
```markdown
- experiment/device chip selector with completion % and missing count;
```

- [ ] **Step 4: Update the "Report Studio" section**

After `SKILL.md:240` (the figure-selection sentence) add:
```markdown
Report Studio has two independent documents (Laboratory report / Scientific
paper) switched by explicit tabs; the editor mode is Write or Preview (no
Split). "Improve selection" runs report.improve on the current selection and is
disabled when nothing is selected.
```

- [ ] **Step 5: Verify no other paragraph contradicts the app**

Re-read the full file; in particular confirm the Tabs section, the "Sidebar and typography" section and the Workshop section still match. Fix any drift found.

- [ ] **Step 6: Commit**

```bash
git add .agent/skills/labflow-ui/SKILL.md
git commit -m "docs(skill): sync labflow-ui with upload-first entry and current patterns"
```

---

### Task 6: Update docs/WORKFLOW.md

**Files:**
- Modify: `docs/WORKFLOW.md` (§2 Import lifecycle, around line 136)

**Interfaces:**
- Consumes: Task 1 behaviour.
- Produces: a workflow doc stating the app always opens on Upload ZIP and resume is manual.

- [ ] **Step 1: Strengthen the entry-point paragraph**

Current (`docs/WORKFLOW.md:136`): `Import is the only experiment entry point.` Add right after it:
```markdown
The app always opens on the Upload ZIP screen. With a previously saved
workspace, the immutable source receipt is shown and the researcher resumes the
flow manually via the stepper or "Open Review"; no previous experiment route is
auto-resumed on reload.
```

- [ ] **Step 2: Check for contradictions**

Grep `docs/WORKFLOW.md` (and `docs/ARCHITECTURE.md`, `docs/specs/OPERATIONS.md`) for any phrase that still describes auto-resuming the last route or a home screen that jumps mid-flow. If found, reword to match. If none, no further change.

- [ ] **Step 3: Commit**

```bash
git add docs/WORKFLOW.md
git commit -m "docs: upload-first entry and manual flow resume"
```
(If docs/ARCHITECTURE.md or OPERATIONS.md was touched, add them to the same commit.)

---

### Task 7: Full verification battery

**Files:** none (verification only)

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Run the full battery (AGENTS.md §16)**

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
Expected: all validators OK; all unit tests green; `node --check` clean on every JS file.

- [ ] **Step 2: Byte-identity regression check**

Run the export byte-identity regression (if present in the repo, e.g. `tests/regression/` or the export test) to confirm `raw/source.zip` remains byte-identical after Working Copy mutation:
```bash
grep -rln "byte-identical\|source.zip" tests/ | head
```
If a dedicated test exists, run it. Otherwise confirm the existing `export-test.js` (6 checks) still passes within the unit run above.

- [ ] **Step 3: Manual landing smoke check**

Boot the app locally (the repo's dev server) and confirm: fresh load → Upload ZIP; after creating + saving a workspace, reload → Upload ZIP with the receipt visible and "Open Review" present; clicking the sidebar "Experiment / RAW to NOMAD" → Upload ZIP. Confirm the ui-kit page renders without missing styles.

- [ ] **Step 4: Report results**

Summarize: battery results, the dead-CSS audit outcome, and any classes kept with a `/* legacy: verify */` note.