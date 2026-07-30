# Theme Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract CSS variables into dedicated `theme.css`, eliminate flickering, make ui-kit the visual theme reference, and normalize all pages.

**Architecture:** `theme.css` owns all `:root` + `html[data-theme="dark"]` variable definitions. `app.css` uses only `var(--)` references. Every page loads both CSS files + a synchronous `<script>` in `<head>` for flicker-free theme initialization.

**Tech Stack:** Pure CSS · No build tools · No CDN · No dependencies

## Global Constraints

- Zero dependencies (no build tools, no npm packages)
- All pages must pass `node --check assets/app.js`
- Flicker-fix script must be the FIRST child of `<head>` on every page
- DOCTYPE must be uppercase `<!DOCTYPE html>` on all pages
- No `<html data-theme="...">` hardcoded in any page
- ui-kit.html must remain the visual theme reference (not a technical dependency)
- `app.js` `setTheme()` initialization must be removed from DOMContentLoaded

---

### Task 1: Create `assets/theme.css`

**Files:**
- Create: `assets/theme.css`

- [ ] **Step 1: Read the current `assets/app.css` in full**

Read `assets/app.css` to extract all variable definitions.

- [ ] **Step 2: Write `assets/theme.css`**

Create the new file with the `:root` and `html[data-theme="dark"]` blocks containing all CSS variables. Structure:

```css
:root {
  color-scheme: light;
  --bg: #f4f6f8;
  --surface: #ffffff;
  --surface-2: #f8fafc;
  --surface-3: #eef2f6;
  --ink: #17202b;
  --muted: #657183;
  --muted-2: #8792a2;
  --line: #d9e0e8;
  --line-strong: #c4ced9;
  --nav: #18212d;
  --nav-2: #222d3b;
  --nav-ink: #dbe4ee;
  --accent: #2563a8;
  --accent-strong: #174d86;
  --accent-soft: #e7f0fa;
  --teal: #19766f;
  --teal-soft: #e4f3f1;
  --amber: #a86816;
  --amber-soft: #fff3df;
  --red: #b33b46;
  --red-soft: #fdebed;
  --violet: #6f55a7;
  --violet-soft: #f0ebfb;
  --on-accent: #ffffff;
  --radius-1: 2px;
  --radius-2: 4px;
  --radius-3: 6px;
  --shadow: 0 1px 2px rgba(18, 31, 48, .06);
  --shadow-float: 0 14px 36px rgba(18, 31, 48, .16);
  --sidebar-w: 210px;
  --topbar-h: 50px;
  --control-h: 34px;
  --page-gap: 12px;
  --panel-pad: 12px;
  --chart-bg: #ffffff;
  --chart-ink: #17202b;
  --chart-muted: #657183;
  --chart-grid: #dbe2ea;
  --chart-grid-soft: #edf1f5;
  --chart-1: #2563a8;
  --chart-2: #19766f;
  --chart-3: #a86816;
  --chart-4: #6f55a7;
  --chart-5: #b33b46;
  --editor-bg: #111923;
  --editor-surface: #1b2633;
  --editor-gutter: #151e29;
  --editor-line: #344151;
  --editor-ink: #dce7f2;
  --editor-muted: #7f91a7;
  --checker-a: #eef2f6;
  --checker-b: #ffffff;
}

html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111821;
  --surface: #18212c;
  --surface-2: #1d2733;
  --surface-3: #25313f;
  --ink: #eef3f8;
  --muted: #a6b2c0;
  --muted-2: #7f8b99;
  --line: #334151;
  --line-strong: #445467;
  --accent: #77aee6;
  --accent-strong: #9ec5ee;
  --accent-soft: #203a57;
  --teal: #6fc5bd;
  --teal-soft: #1d403e;
  --amber: #efb45e;
  --amber-soft: #4a351d;
  --red: #ef8d96;
  --red-soft: #4c252b;
  --violet: #b39ce2;
  --violet-soft: #352b4b;
  --shadow: none;
  --shadow-float: 0 18px 44px rgba(0, 0, 0, .42);
  --chart-bg: #18212c;
  --chart-ink: #eef3f8;
  --chart-muted: #a6b2c0;
  --chart-grid: #334151;
  --chart-grid-soft: #25313f;
  --chart-1: #77aee6;
  --chart-2: #6fc5bd;
  --chart-3: #efb45e;
  --chart-4: #b39ce2;
  --chart-5: #ef8d96;
  --editor-bg: #0d141d;
  --editor-surface: #151f2a;
  --editor-gutter: #111923;
  --editor-line: #334151;
  --editor-ink: #e8eef5;
  --editor-muted: #8798aa;
  --checker-a: #25313f;
  --checker-b: #18212c;
}
```

Note: `--nav`, `--nav-2`, `--nav-ink` are NOT overridden in dark (nav stays dark in both themes). `--shadow` is `none` in dark mode.

- [ ] **Step 3: Commit**

```bash
git add -f assets/theme.css
git commit -m "feat: extract theme variables into dedicated theme.css"
```

---

### Task 2: Clean `assets/app.css`

**Files:**
- Modify: `assets/app.css`

- [ ] **Step 1: Remove `:root` and `html[data-theme="dark"]` blocks from app.css**

Read `assets/app.css`, delete all lines from `:root {` through the end of the `:root` block (all variable definitions), and all lines from `html[data-theme="dark"] {` through the end of the dark block. Keep everything else: layout rules, component styles, responsive breakpoints, domain visuals, etc.

The last line of the `:root` block is the `--checker-b` variable followed by `}`.
The last line of the dark block is also `--checker-b` followed by `}`.

Make sure not to delete the `html[data-theme="dark"] .layer-stack` override at the end of app.css — that's a component rule, not a variable definition. Only remove the `:root { ... }` and `html[data-theme="dark"] { ... }` blocks that contain ONLY variable declarations.

- [ ] **Step 2: Verify nothing is broken**

Run: `node --check assets/app.js` — must pass with no output.

- [ ] **Step 3: Commit**

```bash
git add assets/app.css
git commit -m "refactor: remove variable definitions from app.css (now in theme.css)"
```

---

### Task 3: Update `assets/app.js` — remove flickering theme call

**Files:**
- Modify: `assets/app.js`

- [ ] **Step 1: Remove the initialization lines that cause flickering**

In `assets/app.js`, find and remove these two lines at the end of the DOMContentLoaded handler:

```javascript
  let storedTheme = 'light'; try { storedTheme = localStorage.getItem('labflow-theme') || 'light'; } catch (_) {}
  setTheme(storedTheme);
```

Keep the `setTheme()` function itself (it's still used by the theme toggle button).

Also update the topbar moon icon rendering (line 91) to use `icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')` instead of hardcoded `icon('moon')`.

- [ ] **Step 2: Verify syntax**

Run: `node --check assets/app.js` — must pass with no output.

- [ ] **Step 3: Commit**

```bash
git add assets/app.js
git commit -m "fix: remove flicker-causing setTheme from DOMContentLoaded; dynamic moon icon"
```

---

### Task 4: Add color system + layout tokens sections to `ui-kit.html`

**Files:**
- Modify: `ui-kit.html`

- [ ] **Step 1: Read the current ui-kit.html**

- [ ] **Step 2: Add the two new sections at the top**

After the page header block (`.panel-header`) and before the first existing `.panel-section` (which is "Color and geometry"), insert:

**Color System section** — a live swatch grid showing every CSS variable:
```html
<section class="panel-section">
  <h3>Color system</h3>
  <div class="note info" style="margin-bottom:12px">
    <span data-icon="info"></span>
    <div><strong>Source of truth</strong><br>All CSS variables are defined in <code>assets/theme.css</code>. This visual reference is always in sync — it renders live from the same CSS.</div>
  </div>
  <div class="swatch-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">
    <!-- each swatch -->
    <div class="swatch"><div style="background:var(--bg);width:100%;height:40px;border:1px solid var(--line);border-radius:var(--radius-2)"></div><code>--bg</code><span>Page background</span></div>
    <div class="swatch"><div style="background:var(--surface);width:100%;height:40px;border:1px solid var(--line);border-radius:var(--radius-2)"></div><code>--surface</code><span>Card / panel surface</span></div>
    <div class="swatch"><div style="background:var(--surface-2);width:100%;height:40px;border:1px solid var(--line);border-radius:var(--radius-2)"></div><code>--surface-2</code><span>Subtle surface</span></div>
    <div class="swatch"><div style="background:var(--surface-3);width:100%;height:40px;border:1px solid var(--line);border-radius:var(--radius-2)"></div><code>--surface-3</code><span>Hover surface</span></div>
    <div class="swatch"><div style="background:var(--ink);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--ink</code><span>Body text</span></div>
    <div class="swatch"><div style="background:var(--muted);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--muted</code><span>Muted text</span></div>
    <div class="swatch"><div style="background:var(--muted-2);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--muted-2</code><span>Subtle text</span></div>
    <div class="swatch"><div style="background:var(--line);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--line</code><span>Border / divider</span></div>
    <div class="swatch"><div style="background:var(--line-strong);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--line-strong</code><span>Strong border</span></div>
    <div class="swatch"><div style="background:var(--accent);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--accent</code><span>Primary accent</span></div>
    <div class="swatch"><div style="background:var(--accent-strong);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--accent-strong</code><span>Accent hover</span></div>
    <div class="swatch"><div style="background:var(--accent-soft);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--accent-soft</code><span>Accent background</span></div>
    <div class="swatch"><div style="background:var(--teal);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--teal</code><span>Success / teal</span></div>
    <div class="swatch"><div style="background:var(--amber);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--amber</code><span>Warning / amber</span></div>
    <div class="swatch"><div style="background:var(--red);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--red</code><span>Danger / red</span></div>
    <div class="swatch"><div style="background:var(--violet);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--violet</code><span>Info / violet</span></div>
    <div class="swatch"><div style="background:var(--nav);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--nav</code><span>Navigation bg</span></div>
    <div class="swatch"><div style="background:var(--nav-ink);width:100%;height:40px;border-radius:var(--radius-2)"></div><code>--nav-ink</code><span>Navigation text</span></div>
  </div>
</section>
```

**Layout Tokens section** - right below Color System:
```html
<section class="panel-section">
  <h3>Layout tokens</h3>
  <div class="token-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;font:var(--font-mono)">
    <div class="token"><code>--sidebar-w: 210px</code><span>Sidebar width</span></div>
    <div class="token"><code>--topbar-h: 50px</code><span>Topbar height</span></div>
    <div class="token"><code>--control-h: 34px</code><span>Control height</span></div>
    <div class="token"><code>--page-gap: 12px</code><span>Page gutter</span></div>
    <div class="token"><code>--panel-pad: 12px</code><span>Panel padding</span></div>
    <div class="token"><code>--radius-1: 2px</code><span>Small radius</span></div>
    <div class="token"><code>--radius-2: 4px</code><span>Default radius</span></div>
    <div class="token"><code>--radius-3: 6px</code><span>Large radius</span></div>
  </div>
</section>
```

Also remove the old "Color and geometry" section that had the old smaller swatch grid.

- [ ] **Step 3: Commit**

```bash
git add ui-kit.html
git commit -m "feat: add Color System + Layout Tokens sections to ui-kit"
```

---

### Task 5: Update all 18 HTML pages

**Files:**
- Modify: All 18 HTML pages (every `.html` file in the project root)

- [ ] **Step 1: For each HTML page, apply 3 changes:**

1. **Add flicker-fix script** — insert as the very first child of `<head>`:
```html
<script>document.documentElement.dataset.theme=localStorage.getItem('labflow-theme')||'light'</script>
```

2. **Remove `data-theme="light"`** from the `<html>` tag. E.g. `<html data-theme="light"> → `<html>`.

3. **Normalize DOCTYPE** to uppercase `<!DOCTYPE html>` if it's lowercase. Also normalize the blank line after DOCTYPE to exactly `\n` (no double blank lines).

4. **Add `assets/theme.css` link** before `assets/app.css`:
Change:
```html
<link href="assets/app.css" rel="stylesheet">
```
To:
```html
<link href="assets/theme.css" rel="stylesheet">
<link href="assets/app.css" rel="stylesheet">
```

File list:
- index.html, project.html, projects.html, experiment.html, stack.html, solution.html, material.html, workspace.html, catalogs.html, pipeline.html, report.html, exports.html, editors.html, ai-assistant.html, flow.html, documentation.html, users.html, ui-kit.html

- [ ] **Step 2: Verify syntax**

Run: `node --check assets/app.js` — must pass.

- [ ] **Step 3: Verify HTML structure**

Quick grep to ensure no page still has `data-theme="light"`:
```bash
grep -r 'data-theme' *.html | grep -v 'data-theme='\' | grep -v localStorage
```
Should return no results (the only `data-theme` references should be in the flicker-fix script and in app.js toggle logic).

- [ ] **Step 4: Commit**

```bash
git add *.html assets/theme.css assets/app.css assets/app.js ui-kit.html
git commit -m "feat: consolidate theme system — extract theme.css, fix flickering, normalize all pages"
```

---

### Task 6: Final verification

- [ ] **Step 1: Verify JS syntax**

```bash
node --check assets/app.js && echo "JS OK"
```

- [ ] **Step 2: Verify no old theme patterns remain**

```bash
grep -rn 'data-theme="light"' *.html && echo "FOUND — should be 0" || echo "No hardcoded data-theme — OK"
grep -n 'storedTheme\|setTheme(storedTheme)' assets/app.js && echo "FOUND flicker call — should be 0" || echo "No flicker call — OK"
```

- [ ] **Step 3: Verify all pages have the flicker-fix script**

```bash
grep -c "localStorage.getItem.*labflow-theme" *.html | grep ":0$" && echo "Pages missing flicker-fix" || echo "All pages have flicker-fix"
```
