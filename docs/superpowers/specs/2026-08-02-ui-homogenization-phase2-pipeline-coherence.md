# LabFlow UI Homogenization — Phase 2 (Pipeline Coherence) Operational Spec

Date: 2026-08-02 · Status: derived from approved design `2026-08-02-ui-homogenization-design.md` §2

## Goal

Make the five CHOSE steps visually coherent as a single Pipeline: uniform `.tool-step-head` anatomy,
a single Project accent instead of per-step colours, and reusable step primitives documented in the UI Kit.
No change to the product model (`Workspace → Project → Pipeline → Step`) and no new stylesheets.

## Scope decisions (from the design spec §2)

1. **Uniform header anatomy:** every step header is `eyebrow + h3 + p` in a `<div>`, followed by an actions slot.
2. **Single accent:** remove the per-step `--step-tone` custom-property chain; step headers and their roundel use only `--pipeline-accent` (fallback `var(--accent)`).
3. **Shared primitives:** promote the three per-step patterns to reusable classes and show them in `ui-kit.html`.
4. **Bundle stays generated:** any edit to `pipelines/chose/steps/*/index.html` is followed by `tools/sync_pipeline_bundle.py`; the validator enforces freshness.

---

## 2.1 Uniform `.tool-step-head` anatomy

Target anatomy (all five steps):

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

- `materials/index.html:2` and `stack/index.html:2` already conform — unchanged.
- `data/index.html:2-5`: add `<span class="eyebrow">` above `<h3>` inside the first `<div>`; the actions row stays.
  Eyebrow text: **`Capture · map · evidence`**.
- `analysis/index.html:2`: add `<span class="eyebrow">` above `<h3>` inside the first `<div>`; the `AI suggestions remain simulated` badge stays as the actions slot.
  Eyebrow text: **`Compare · interpret · conclude`**.
- `export/index.html:1`: add `<span class="eyebrow">` above `<h3>` inside the first `<div>`; the five export buttons stay in the actions row.
  Eyebrow text: **`Assemble · export · share`**.

The `.step-flag` (from `.step-session-flag`) on `data`, the `.step-path` (from `.analysis-measurement-path`) on `analysis`, and the `.step-strip` (from `.summary-strip`) on `export` remain as step content below the header.

## 2.2 Remove `--step-tone`; single accent

Edit `assets/styles/feature-scientific-workbench.css`:

- **Line 179:** `border-left:4px solid var(--step-tone,var(--accent))` → `border-left:4px solid var(--pipeline-accent,var(--accent))`.
- **Line 180:** remove the seven per-step `--step-tone` declarations (materials/stack/data/analysis/export+share/plan/record). Rewrite the surviving rules:
  - `.tool-step-head::before` `border-color: var(--step-tone,var(--accent))` → `var(--pipeline-accent,var(--accent))`;
  - `.tool-step-head::before` `background: color-mix(in srgb,var(--step-tone,var(--accent)) 12%,var(--surface))` → `var(--pipeline-accent,var(--accent))`;
  - `.tool-step-head::after` `color: var(--step-tone,var(--accent))` → `var(--pipeline-accent,var(--accent))`.
- **Line 192:** `color-mix(in srgb,var(--step-tone,var(--accent)) 8%,var(--surface))` → `var(--pipeline-accent,var(--accent))`.

Result: the roundel keeps its non-colour shape (per-step `::after` glyphs at lines 160–167 are unchanged); colour comes solely from `--pipeline-accent`. `scientific.css:227` already pins `border-left-color` to `--pipeline-accent` in the winning layer.

## 2.3 Shared primitives

Rename the per-step classes to reusable primitives in `assets/styles/feature-scientific-workbench.css`, update the step HTML (then regenerate the bundle), and document each in `ui-kit.html`.

| Old class | New class | CSS occurrences (feature-scientific-workbench.css) | HTML usage | Note |
| --- | --- | --- | --- | --- |
| `.analysis-measurement-path` | `.step-path` | :107, :109 (media) | `analysis/index.html:3` | descendant `.done`/`.active`/`i` selectors rename too |
| `.step-session-flag` | `.step-flag` | :70 | `data/index.html:6` | |
| `.summary-strip` | `.step-strip` | :144, :145, :146, :171, :174 | `export/index.html:2` | keep the `.summary-value`? No — leave `.summary-value` alone, it is used elsewhere |

`.measurement-step-selector` (:105, :108, :109) is kept as-is; it already lives in `ui-kit.html:322`.

### ui-kit.html additions

Add a "Pipeline step primitives" panel set to `ui-kit.html` in the **Domain visuals** section (near :104–105) or the **Pipeline workbench** section, showing:

- `.step-path` — stepper strip with `Measurement → Comparison → Finding → Researcher conclusion` states;
- `.step-flag` — banner with a `Session only` badge + notice text;
- `.step-strip` — grid of summary cells (count + label) with the accent underline.

Each example is a plain `<div class="…">` matching the real markup so the Kit stays the ground truth.

## 2.4 Phase 2 completion criteria

- `python3 tools/validate_poc.py` PASS (bundle freshness included).
- Browser: `project.html?step=materials|stack|data|analysis|export` share the uniform header, single `--pipeline-accent`, no per-step colours, no console errors.
- `ui-kit.html` shows the three promoted primitives.

## Cross-cutting requirements (inherited)

- Static POC: no frameworks, no backend, no fetch(), no new stylesheets, no structural inline styles.
- `assets/pipeline-bundle.js` must be regenerated after step-HTML edits (never edited by hand).
- `assets/docs-bundle.js` untouched.
- Script order (bundle → loader → app) preserved; validator enforces.
