# LabFlow Restructure — Design Spec

## Objective

Transform LabFlow from a scattered POC into a **simple, intuitive interface** for researchers to manage experiments and workflow between the lab and NOMAD. The researcher must be able to:

1. Open their workspace with various **EXPERIMENTS**
2. For an experiment, create and manage **STACKS** (perovskite material stacks), defining/creating/using:
   - Solutions, solutes, materials, conditions, pipelines, actions
3. Import data (common formats and/or manually), edit, and export
4. Generate reports, graphs, PDFs, images, Excel files
5. Export to NOMAD via API key (and import from NOMAD)

## Scope

- Frontend-only POC (no backend)
- Keep existing pages and features (AI, editors, flow, documentation, UI kit)
- Do not destroy the CSS theme / design system
- Add new pages for stack management and NOMAD import
- Restructure navigation for clarity

## Navigation Structure

5 sections in the sidebar:

| Section | Icon | Pages |
|---------|------|-------|
| **Dashboard** | `home` | `index.html` |
| **Progetti** | `folder` | `projects.html`, `project.html` |
| **Catalogo** | `grid` | `catalogs.html`, `pipeline.html`, `stack.html`, `solution.html`, `material.html` |
| **Report / Export** | `download` | Unified page merging `report.html` + `exports.html` |
| **Altro** | `plus` | Click-to-expand: `editors.html`, `ai-assistant.html`, `flow.html`, `documentation.html`, `users.html`, `ui-kit.html` |

The `navigation` array in `assets/app.js` is updated. The "Altro" section has an expandable sub-list.

## Page-by-Page Design

### 1. Dashboard (`index.html`)

- **Header**: "Buongiorno, [Nome]" with workspace name and date
- **Metric row**: 3-4 metric cards (Active experiments, Stacks in use, Pending exports, Last NOMAD sync)
- **Continue card**: current experiment with progress, last action, mini-stack visual
- **Recent projects grid**: 3-4 cards with name, experiment count, last activity
- **Quick actions**: New experiment, New stack, Import data, Export to NOMAD
- **Value strip**: keep existing

### 2. Projects (`projects.html`, `project.html`)

**Projects list** (`projects.html`):
- Keep existing project grid
- Add stack count and last NOMAD export date to each card
- Project wizard already exists — keep as-is

**Project detail** (`project.html`):
- Add tabs: **Experiments** (default), **Overview**
- Overview tab: global progress, stacks used, metrics
- Keep focus card with mini-stack visual for current experiment
- Keep research path graph
- Keep experiments list (enhanced with stack info)

### 3. Experiment Wizard (`experiment.html`)

Keep 4-step wizard with enhancements:

**Step 1 — Choose**:
- Add "Create from existing stack" option linking to catalog
- Keep standard templates

**Step 2 — Plan**:
- Add **Material Stack** section inside the plan panel:
  - Define which stack(s) this experiment uses
  - Pick from catalog or create on-the-fly
  - Show layer stack visual
- Add **Conditions** sub-section:
  - Spin speed, annealing temp/time, atmosphere
  - Visual condition cards (already exists)
- Add **Pipeline & Actions** sub-section:
  - Define process steps
  - Assign actions per step
- Keep existing comparison/variable definition

**Step 3 — Work**: keep as-is (run checklist, progress, file parsing)

**Step 4 — Finish**: keep as-is (review, compare results, report, NOMAD)

### 4. Stack Management (NEW: `stack.html`, `solution.html`, `material.html`)

#### `stack.html` — Stack Detail/Editor

- Header: stack name, composition summary, date created
- Layer stack visual (existing CSS: `.layer-stack` / `.layer-band`)
- Tabs:
  - **Solutions**: list of solutions in this stack (precursor, solvent, concentration)
  - **Materials**: materials used (lotto, supplier, purity)
  - **Conditions**: processing conditions (spin-coating, annealing, atmosphere, time)
  - **Pipeline**: process sequence (deposition → spin → anneal → measure)
  - **Actions**: operator checklist per step
- Editable inline or via form panels
- Save to localStorage, reusable in catalog

#### `solution.html` — Solution Editor

- Precursors (solutes) selector/creator
- Solvent, concentration, molar ratios, volume
- Visual preview: solution diagram (existing CSS: `.solution-diagram`)

#### `material.html` — Material Card

- Name, formula, supplier, lot number, purity, storage conditions
- Linked from stack and catalog

### 5. Catalog (`catalogs.html`)

- Add **Stack** tab to Library Browser tabs
- Add **"New stack"** button in reusable objects grid
- 3-step wizard for stack creation: Choose template → Define layers → Set conditions
- Keep existing setup templates and resource browsing

### 6. Report & Export (unified page)

Merge `report.html` and `exports.html` into a single page at `report.html` with tabs:

- **Tab "Report"**: existing report editor
- **Tab "Export locale"**: existing export (JSON, CSV, Excel, YAML)
- **Tab "NOMAD"**: 
  - **Export section**: existing NOMAD package builder
  - **Import section (NEW)**: 
    - NOMAD repository URL field
    - API key input (password field)
    - "Browse experiments" button
    - List of available experiments from NOMAD
    - "Import selected" with data mapping
    - Simulated response (POC — no actual API call)

### 7. UI Kit (`ui-kit.html`)

- Add new components: stack editor, solution editor, condition cards, pipeline builder, action checklist
- Add new patterns: stack detail page, NOMAD import panel
- Keep existing content, append new sections

### 8. Data Flow

- All data persisted in `localStorage` (as before)
- New data models for Stack, Solution, Material, Condition, Pipeline, Action
- Existing experiment and project models extended with stack references
- NOMAD import simulated (POC) with structured mock data
- All new objects follow same pattern as existing entity model

### 9. CSS/Theme Changes

- No new theme tokens — use existing CSS custom properties
- New page layouts reuse existing `.panel`, `.tabs`, `.grid-*`, `.split` patterns
- Component additions to `ui-kit.html` only

### 10. Non-Goals

- No backend / real API integration
- No real NOMAD API calls (simulated)
- No user authentication system
- No build tooling (static HTML/CSS/JS remains)
