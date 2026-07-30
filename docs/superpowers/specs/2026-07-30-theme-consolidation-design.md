# LabFlow Theme Consolidation & Flicker Fix

## Problem

1. **Flickering**: every page hardcodes `<html data-theme="light">`; `setTheme()` runs at `DOMContentLoaded`, swapping all variables post-paint → visible flash when dark theme is active
2. **No single theme source**: CSS variables are embedded in `app.css` alongside component rules; `ui-kit.html` manually documents components but has no variable reference
3. **Minor page inconsistencies**: inline styles, DOCTYPE case, report preview ignores dark mode

## Design

### Extract theme variables into `assets/theme.css`

All `:root` + `html[data-theme="dark"]` variable definitions move from `app.css` to a new `theme.css`. This file defines exactly 60+ CSS custom properties across both themes:

- Surface colors (bg, surface, surface-2, surface-3)
- Text colors (ink, muted, muted-2)
- Border colors (line, line-strong)
- Navigation colors (nav, nav-2, nav-ink) — stay dark in both themes
- Semantic colors (accent, teal, amber, red, violet + -soft variants)
- Layout constants (sidebar-w, topbar-h, control-h, page-gap, panel-pad)
- Shape constants (radius-1/2/3)
- Shadow constants (shadow, shadow-float)
- Chart colors (chart-1..5, chart-bg, chart-ink, chart-muted, chart-grid, chart-grid-soft)
- Editor colors (editor-bg, editor-surface, editor-gutter, editor-line, editor-ink, editor-muted)
- Checkerboard colors (checker-a, checker-b)
- on-accent (white text on colored backgrounds)

### `assets/app.css` becomes pure component CSS

Removes all `:root` and `html[data-theme="dark"]` blocks. Keeps only:
- Layout rules (sidebar, topbar, panels, grids)
- Component styles (buttons, badges, inputs, tables, tabs, modals, drawers, toasts)
- Responsive breakpoints
- Domain visuals (stack visual, solution diagram, process flow, report sheet)

Import strategy: no `@import` — both files are loaded via `<link>` in every page. This avoids the render-blocking behavior of `@import` and gives the flicker-fix script time to set `data-theme` between the two `<link>` tags.

### Flicker fix

Every page gets this synchronous `<script>` as the VERY FIRST child of `<head>`:

```html
<script>document.documentElement.dataset.theme=localStorage.getItem('labflow-theme')||'light'</script>
```

This runs before ANY CSS is fetched/parsed, so the correct `data-theme` is on `<html>` by the time `theme.css` applies. The `setTheme(storedTheme)` call at the end of `DOMContentLoaded` in `app.js` is removed (it served the same purpose but too late).

All 18 pages have their hardcoded `data-theme="light"` removed from the `<html>` tag.

### `ui-kit.html` as the visual reference

The ui-kit page:
1. Links the same `theme.css` + `app.css` as every other page
2. Gains a new **Color System** section at the top with live swatches for every CSS variable (bg, surface, accent, teal, amber, red, violet, nav, ink, muted, line, etc.), showing both light and dark appearance
3. Gains a **Layout Tokens** section documenting sidebar-w, topbar-h, control-h, page-gap, panel-pad
4. All existing component sections remain, updated to reference the variables by name
5. Every component shown is the actual rendered HTML from `app.css` styles — no duplication

### Consistency pass across all pages

- Normalize `<!DOCTYPE html>` to uppercase on all 18 pages
- Remove `data-theme="light"` from all `<html>` tags
- Normalize blank line after DOCTYPE (use `<!DOCTYPE html>\n<html ...>` everywhere)
- Report preview: document `.report-sheet` uses hardcoded white bg (intentional print-like mode); no change needed
- Minor inline styles (progress bar widths, spacing tweaks) left as-is since they are demo data or use `var(--)` — no functional difference

## Files affected

- **New**: `assets/theme.css` (~100 lines, extracted from `assets/app.css`)
- **Modified**: `assets/app.css` (remove `:root` + `html[data-theme="dark"]` blocks, about 80 lines removed)
- **Modified**: `assets/app.js` (remove `let storedTheme = ...; setTheme(storedTheme);` from DOMContentLoaded)
- **Modified**: `ui-kit.html` (add Color System + Layout Tokens sections at top)
- **Modified**: All 18 HTML pages (add flicker-fix script, remove `data-theme="light"`, normalize DOCTYPE)
