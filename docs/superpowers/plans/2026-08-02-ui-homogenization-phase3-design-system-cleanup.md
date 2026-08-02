# LabFlow UI Homogenization — Phase 3 (Design-System Cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the design-system gaps in the layered `assets/app.css`: define the missing tokens (`--info`/`--info-soft`, `--panel`, `--radius-md`, `--stack-contact`), remove three conflicting duplicate selectors (`.eyebrow`, `#experimentStackList`, `.report-cover`), and replace the design-spec-listed hardcoded hexes with semantic tokens. Ownership (§3.4) and page anatomy (§3.5) are verification-only.

**Architecture:** Four coordinated edits, all in `assets/styles/`. (1) `tokens.css`: add the four token families. (2) Delete the overridden duplicates in `feature-workflows.css` (`.eyebrow`, `.report-cover` mobile) and `feature-reports-ai.css` (`#experimentStackList` base). (3) Convert `#39485a`, `#c79b42`, `rgba(37,99,168,…)` to tokens in `feature-reports-ai.css`, `feature-scientific-workbench.css`, `feature-workflows.css`. (4) Final verification via validator + browser matrix.

**Tech Stack:** Vanilla HTML/CSS/JS, static POC, no build step, no bundle regeneration needed (step HTML untouched). Verification via `python3 tools/validate_poc.py` plus manual browser checks.

## Global Constraints

- Static POC: no frameworks, no backend, no fetch(), no new stylesheets, no structural inline styles.
- `assets/pipeline-bundle.js` and `assets/docs-bundle.js` untouched (no step HTML edits).
- Only `assets/styles/*.css` files change; layer order and import order stay as-is.
- The three selector deletions target rules that are already overridden at runtime — each removal must be confirmed as value-neutral by browser check.
- Before finishing any change run `python3 tools/validate_poc.py` and confirm no browser-console errors on the AGENTS.md routes.

---

### Task 1: Define missing tokens in `tokens.css`

**Files:**
- Modify: `assets/styles/tokens.css` (`:root` signal + geometry blocks, dark block)
- Test: validator + browser check on `project.html?step=materials` (solvent mixture bars) and `report.html` (AI future strip)

**Interfaces:**
- Consumes: nothing.
- Produces: `--info`/`--info-soft`, `--panel`, `--radius-md`, `--stack-contact` available to the consumers listed in §3.1.

- [ ] **Step 1: Signal-info tokens in `:root`**

Add after the Signal colours block (`tokens.css` ends at line 40 with `--on-accent: #ffffff;`):

```css
  /* Information signal (used for alternating data bars, info strips) */
  --info: #2b69aa;
  --info-soft: #e8f1fb;
```

- [ ] **Step 2: Signal-info tokens in dark block**

Add to `html[data-theme="dark"]` after the `--violet-soft` line (`:149`):

```css
  --info: #8cb4dd;
  --info-soft: #20395c;
```

- [ ] **Step 3: `--panel` and `--radius-md` aliases**

Add to the `:root` "Shared geometry" block near `--radius-3` (`:58`) or the Effects block:

```css
  --panel: var(--surface);
  --radius-md: var(--radius-3);
```

- [ ] **Step 4: Scientific stack token**

Add to the `:root` block (after Effects, before the Compatibility aliases comment at `:105`):

```css
  /* Scientific stack layers */
  --stack-contact: #c79b42;
```

- [ ] **Step 5: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 6: Browser check**

Open `project.html?step=materials`: the solvent mixture bars alternate accent-soft / info-soft.
Open `report.html`: the AI future strip cards now render with `--panel` background and `--radius-md` corners. No console errors.

- [ ] **Step 7: Commit**

```bash
git add assets/styles/tokens.css
git commit -m "tokens: define info/panel/radius-md/stack-contact families"
```

---

### Task 2: Remove overridden duplicate selectors

**Files:**
- Modify: `assets/styles/feature-workflows.css:23`, `:526`; `assets/styles/feature-reports-ai.css:277`
- Test: validator + browser check (eyebrows render muted; experiment stack grid gap; report cover gradient)

**Interfaces:**
- Consumes: none of the new tokens.
- Produces: single canonical `.eyebrow` (components), single canonical `#experimentStackList` base (scientific-workbench), single `.report-cover` base + responsive pair (feature-foundations).

- [ ] **Step 1: Delete `.eyebrow` accent default from `feature-workflows.css:23`**

Remove the entire line:

```css
.eyebrow {color:var(--accent);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
```

(It is a `patterns`-layer duplicate already overridden by `components.css:180`.)

- [ ] **Step 2: Delete `#experimentStackList` base from `feature-reports-ai.css:277`**

Remove the rule:

```css
#experimentStackList {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;}
```

(Overridden by `feature-scientific-workbench.css:42` gap:10px; the media overrides at `:49` and `:454` stay.)

- [ ] **Step 3: Delete `.report-cover` mobile gradient from `feature-workflows.css:526`**

Remove the rule (inside `@media (max-width:720px)`):

```css
.report-cover {background:linear-gradient(160deg,#1a2c42 0 26%,#fff 26% 100%)}
```

(After removal, mobile `.report-cover` resolves to `feature-foundations.css:384` `#fff`; desktop keeps `:248` gradient.)

- [ ] **Step 4: Confirm no duplicate base selectors remain**

Run:

```bash
grep -n "\.eyebrow" assets/styles/feature-workflows.css
grep -n "#experimentStackList" assets/styles/feature-reports-ai.css
grep -n "\.report-cover" assets/styles/feature-workflows.css
```

Expected: no output (the media rows for `#experimentStackList` at `:454` intentionally remain — the grep will still show that line; confirm it is only the media row).

- [ ] **Step 5: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 6: Browser check**

Open `project.html` (page eyebrow + `pipeline-stage-header .eyebrow` still render correctly), `project.html?step=stack` (experiment stack grid unchanged), `report.html` (cover sheet). No console errors.

- [ ] **Step 7: Commit**

```bash
git add assets/styles/feature-workflows.css assets/styles/feature-reports-ai.css
git commit -m "css: drop overridden duplicate selectors (eyebrow, stack list, report-cover)"
```

---

### Task 3: Replace hardcoded hex with tokens

**Files:**
- Modify: `assets/styles/feature-reports-ai.css:52`, `assets/styles/feature-scientific-workbench.css:42`, `:44`, `assets/styles/feature-workflows.css:205`, `:245`
- Test: validator + browser check (report text, stack contact layer, solution vessel/beaker)

**Interfaces:**
- Consumes: `--info`? No — `--muted`, `--stack-contact`, `--accent` (all defined before/independent).
- Produces: no hardcoded `#39485a`, `#c79b42`, or `rgba(37,99,168,…)` in the `patterns` layer.

- [ ] **Step 1: `feature-reports-ai.css:52`**

Edit from:

```css
color:#39485a;
```

to:

```css
color:var(--muted);
```

- [ ] **Step 2: `feature-scientific-workbench.css` contact layer (2 occurrences)**

Edit from `#c79b42` (lines 42 and 44, in the `.stack-specimen .contact` / `.stack-specimen-detail .contact` rules):

```css
color-mix(in srgb,#c79b42 24%,var(--surface))
color-mix(in srgb,#c79b42 18%,var(--surface))
```

to:

```css
color-mix(in srgb,var(--stack-contact) 24%,var(--surface))
color-mix(in srgb,var(--stack-contact) 18%,var(--surface))
```

- [ ] **Step 3: `feature-workflows.css:205`**

Edit from:

```css
background:linear-gradient(to top,rgba(37,99,168,.28) 0 72%,transparent 72%);
```

to:

```css
background:linear-gradient(to top,color-mix(in srgb,var(--accent) 28%,transparent) 0 72%,transparent 72%);
```

- [ ] **Step 4: `feature-workflows.css:245`**

Edit from:

```css
background:rgba(37,99,168,.26)
```

to:

```css
background:color-mix(in srgb,var(--accent) 26%,transparent)
```

- [ ] **Step 5: Confirm no listed hex remains**

Run:

```bash
grep -rn "#39485a\|#c79b42\|rgba(37,99,168" assets/styles/*.css
```

Expected: no matches.

- [ ] **Step 6: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 7: Browser check**

Open `project.html?step=stack` (contact layer gold), `project.html?step=materials` (solution vessel liquid, beaker fill), `report.html` (report sheet secondary text). No console errors.

- [ ] **Step 8: Commit**

```bash
git add assets/styles/feature-reports-ai.css assets/styles/feature-scientific-workbench.css assets/styles/feature-workflows.css
git commit -m "css: replace hardcoded hex with semantic tokens"
```

---

### Task 4: Final Phase 3 verification

**Files:** none modified.
**Test:** validator + full browser matrix + spec coverage.

- [ ] **Step 1: Run the validator**

Run: `python3 tools/validate_poc.py`
Expected: PASS.

- [ ] **Step 2: Browser matrix**

Open and confirm no console errors on:
- `index.html`
- `project.html`
- `project.html?step=stack`
- `project.html?step=data`
- `catalogs.html`
- `editors.html`
- `ui-kit.html`

Spot-check: page eyebrows render muted; `.pipeline-stage-header .eyebrow` keeps the Project accent; experiment stack grid gap is 10px; report cover is unchanged; solvent bars alternate.

- [ ] **Step 3: Confirm spec coverage**

- §3.1 missing tokens → Task 1.
- §3.2 duplicate selectors → Task 2.
- §3.3 hardcoded hex → Task 3.
- §3.4 ownership → verified via validator (Task 4, step 1) — no changes needed.
- §3.5 page anatomy → verified by reading the pages (documented in spec) — no changes needed.
- §3.6 completion criteria → Task 4 steps 1–2.

- [ ] **Step 4: Final commit of spec + plan (if not already)**

If `docs/superpowers/specs/2026-08-02-ui-homogenization-phase3-design-system-cleanup.md` and this plan are not yet committed:

```bash
git add docs/superpowers/specs/2026-08-02-ui-homogenization-phase3-design-system-cleanup.md docs/superpowers/plans/2026-08-02-ui-homogenization-phase3-design-system-cleanup.md
git commit -m "docs: phase 3 design-system cleanup spec and plan"
```

---

## Self-Review Notes

- **Placeholder scan:** no TBD/TODO; every step shows exact before/after text and expected output.
- **Value-neutrality:** the three selector deletions and all hex→token replacements are confirmed value-neutral in the spec (each target was already overridden or is a color-preserving substitution), so no layout regression is expected.
- **No bundles:** step HTML is untouched, so neither `pipeline-bundle.js` nor `docs-bundle.js` is regenerated.
- **Scope discipline:** layer-palette hexes for `.layer-band`, `.stack-mini`, `.mini-stack`, report surfaces, `#2b69aa`, `#e8f1fb` (now tokenized as `--info`/`--info-soft`) are intentionally not swept beyond the design-spec list.
