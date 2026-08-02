# LabFlow UI Homogenization — Phase 3 (Design-System Cleanup + Page Anatomy) Operational Spec

Date: 2026-08-02 · Status: derived from approved design `2026-08-02-ui-homogenization-design.md` §3

## Goal

Close the design-system gaps the POC accumulated while moving from page-by-page CSS to the
layered `assets/app.css`: define the missing tokens, remove conflicting duplicate selectors,
replace the last hardcoded hex values in the `patterns` layer with semantic tokens, and confirm
the uniform `.page-header` anatomy. No product-model change and no new stylesheets.

## Scope decisions (from the design spec §3)

1. **Tokens come first.** Define `--info`/`--info-soft`, `--panel`, `--radius-md` and a
   scientific stack-layer token before touching the consumers that use them.
2. **Canonical default wins.** `.eyebrow` default is `components.css` (muted); contextual colour
   overrides stay as targeted rules where actually used (`.pipeline-stage-header .eyebrow`).
3. **One definition per primitive.** Where two feature files define the same selector in the same
   layer, the currently *losing* (overridden) definition is removed; the winning one stays and is
   treated as canonical.
4. **Hex → token only where the design spec lists it.** `#39485a`, `#c79b42`,
   `rgba(37,99,168,…)`. The many other layer-palette hexes (`.layer-band`, `.stack-mini`,
   `.mini-stack`, report surfaces) are intentionally out of scope this phase.
5. **Ownership and anatomy are verification-only.** The validator already enforces the owner map
   (§3.4) and every primary page already carries `eyebrow + h1 + p + page-actions` plus the
   canonical Workspace back-link (§3.5) — confirmed by reading the five compact pages and
   `project.html`.

---

## 3.1 Missing tokens (`assets/styles/tokens.css`)

Add to `:root` (after the Signal colours block) and mirror the theme-dependent ones in the dark
block:

```css
/* Information signal (used for alternating data bars, info strips) */
--info: #2b69aa;
--info-soft: #e8f1fb;
```

Dark block (values follow the existing dark signal family: `--accent:#77aee6`,
`--accent-soft:#203a57`):

```css
--info: #8cb4dd;
--info-soft: #20395c;
```

Palette blocks (green/red/violet) do **not** redeclare `--info` — `info` is an informational blue
independent of the accent palette, so it keeps the `:root` value (documented decision).

Add to `:root` (Shared geometry / Effects area):

```css
--panel: var(--surface);     /* panel-surface alias, mirrors .panel background */
--radius-md: var(--radius-3); /* medium radius maps to the existing largest token (7px) */
```

Rationale: `--panel` is the background used by `.ai-future-strip article` / `.analysis-ai-roadmap>div`
(`feature-reports-ai.css:715`); `--radius-md` is their corner radius (`:714`) and `--radius-3` is the
card radius `.panel` already uses. No new numeric values are introduced. `--radius-md`/`--panel` are
derivations and need no dark/palette variants.

Add a scientific stack token for the `contact` layer (outlined-gold used by the stack specimen):

```css
/* Scientific stack layers */
--stack-contact: #c79b42;
```

`--stack-contact` is a fixed material colour (same treatment as the existing layer colours), so it
lives in `:root` only.

## 3.2 Conflicting duplicate selectors

### `.eyebrow` — remove the overridden accent default

- `components.css:180` (layer `components`) is the canonical default: `color:var(--muted)`,
  `font:750 10px/1.2 var(--font-utility)`, `letter-spacing:.08em`, `uppercase`.
- `feature-workflows.css:23` (layer `patterns`, imported before `components`) defines an accent
  `.eyebrow`. Because `components` wins the layer order at equal specificity, this accent default is
  already dead. **Action:** delete the `.eyebrow` rule from `feature-workflows.css:23`.
- Contextual overrides that are genuinely used stay untouched: `.pipeline-stage-header .eyebrow`
  (`scientific.css:226`, `feature-scientific-workbench.css:179`) and `body .page .eyebrow`
  (`feature-reports-ai.css:587`, font-size only).

### `#experimentStackList` — remove the overridden base

- `feature-reports-ai.css:277` (gap:9px) is imported before `feature-scientific-workbench.css:42`
  (gap:10px), same layer and specificity → scientific-workbench wins, reports-ai:277 is dead.
  **Action:** delete the `#experimentStackList {…}` rule from `feature-reports-ai.css:277`.
- Responsive overrides stay: `feature-scientific-workbench.css:49` (`@media max-width:900px`,
  `grid-template-columns:1fr`) and the multi-selector row `feature-reports-ai.css:454`
  (`@media max-width:760px`) — they are contextual, not base definitions.

### `.report-cover` — one canonical base + its responsive overrides

- Base (desktop): `feature-foundations.css:248`
  `background:linear-gradient(135deg,#1a2c42 0 38%,#fff 38% 100%)` — the canonical definition and
  owner of the report-sheet family.
- `feature-workflows.css:526` is a second gradient inside `@media(max-width:720px)` that overrides
  the intended mobile `#fff` (`feature-foundations.css:384`, same media, earlier import). It is the
  conflicting duplicate. **Action:** delete `feature-workflows.css:526`.
- After the removal, mobile resolves to `feature-foundations.css:384` (`#fff`) and desktop to
  `:248` (gradient) — a single definition per breakpoint, both owned by `feature-foundations.css`.
- Note: the only runtime use is `report-sheet report-cover report-page-summary`
  (`assets/app.js:1192`), whose background is pinned to `#fff` by
  `feature-reports-ai.css:93` (higher specificity), so this cleanup does not alter any rendered
  output.

## 3.3 Hardcoded hex → tokens (design-spec list only)

1. `feature-reports-ai.css:52` `color:#39485a` (report sheet secondary text) →
   `color:var(--muted)`. Inside `.report-sheet` this resolves to the report-local muted
   (`#536273`, set at `feature-foundations.css:246`) — the semantically correct report-secondary
   colour.
2. `feature-scientific-workbench.css:42` and `:44` `color-mix(in srgb,#c79b42 24%/18%,var(--surface))`
   (stack contact layer) → `color-mix(in srgb,var(--stack-contact) 24%/18%,var(--surface))`.
3. `feature-workflows.css:205` `rgba(37,99,168,.28)` (solution-vessel liquid) and `:245`
   `rgba(37,99,168,.26)` (solution-beaker fill) → `color-mix(in srgb,var(--accent) 28%/26%,transparent)`
   (#2563a8 = rgb(37,99,168) = `--accent`; the `color-mix` pattern is already used for `--focus-ring`).

## 3.4 Component geometry ownership

No action needed. `grep` over `feature-*.css` for direct `.button`/`.input`/`.panel` selectors
returns nothing, and `tools/validate_poc.py:178-194` already fails on any direct core selector
outside its owner. Verified as part of the final check.

## 3.5 Uniform `.page-header` anatomy

No action needed. Confirmed by reading the pages:
- All five compact pages (`ai-assistant.html`, `catalogs.html`, `documentation.html`, `flow.html`,
  `knowledge.html`) plus `editors.html`, `experiment.html`, `report.html` have
  `eyebrow + h1 + p + page-actions`.
- `project.html:14` already has the canonical breadcrumb (`project-breadcrumb` →
  `index.html` Workspace) and a "My Workspace" back-link action, matching `stack.html`/`solution.html`.
- No `compact-header` page lacks `page-actions`, so none qualifies for removal.

## 3.6 Phase 3 completion criteria

- `python3 tools/validate_poc.py` PASS.
- Browser matrix (AGENTS.md routes): `index.html`, `project.html`, `project.html?step=stack`,
  `project.html?step=data`, `catalogs.html`, `editors.html`, `ui-kit.html` — no console errors.
- `ui-kit.html` visual comparison unaffected; the removed CSS rules have no observable effect on
  any rendered page (verified: `.eyebrow` accent default, `#experimentStackList` gap, `.report-cover`
  mobile gradient were all already overridden; the hex→token replacements are value-preserving).

## Cross-cutting requirements (inherited)

- Static POC: no frameworks, no backend, no fetch(), no new stylesheets, no structural inline styles.
- `assets/pipeline-bundle.js` and `assets/docs-bundle.js` untouched in this phase.
- Script order (pipeline-bundle.js → pipeline-loader.js → app.js) preserved; validator enforces.
- Only `assets/styles/*.css` and `docs/superpowers/*` are touched.
