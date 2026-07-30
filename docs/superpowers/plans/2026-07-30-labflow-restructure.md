# LabFlow Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure LabFlow from a scattered POC into a simple, intuitive interface for researchers, with 5-section navigation, redesigned dashboard, stack management pages, unified report/export, and NOMAD import.

**Architecture:** Static HTML/CSS/JS with localStorage. All new pages follow existing patterns (panel layout, tab navigation, data-action handlers in app.js). Navigation rendered dynamically by mountShell().

**Tech Stack:** Pure HTML/CSS/JS, no dependencies. SVG charts, custom DSL for graphs, custom XLSX/ZIP/PDF generation.

## Global Constraints

- Zero external dependencies
- All CSS must use existing theme tokens (CSS custom properties)
- All new pages must use existing layout patterns (`.page`, `.panel`, `.grid-*`, `.tabs`, `.button`, `.badge`)
- Data models extend existing localStorage patterns (userProfiles, demoGraph)
- All modifications must respect existing CSS theme (light/dark)
- Keep all existing HTML pages intact unless explicitly modified
- JavaScript follows same patterns: data-action handlers in click events, mountShell for shell rendering

---
## File Map

### Files to Modify:
- `assets/app.js` — navigation array, mountShell, data models, demo data
- `assets/app.css` — minor additions for new components
- `assets/exporters.js` — add NOMAD import simulation
- `index.html` — dashboard redesign
- `project.html` — add tabs (Overview + Experiments)
- `experiment.html` — enhance Step 2 with stack/conditions/pipeline sections
- `catalogs.html` — add Stack tab to library browser, add "New stack" wizard button
- `report.html` — add Export and NOMAD tabs (unified page)
- `ui-kit.html` — add new component sections

### Files to Create:
- `stack.html` — stack detail/editor with tabs (Solutions, Materials, Conditions, Pipeline, Actions)
- `solution.html` — solution editor with precursors/solvents
- `material.html` — material card with formula/supplier/purity

---
### Task 1: Navigation Restructure

**Files:**
- Modify: `assets/app.js` (navigation array ~line 80-120, mountShell function)

**Interfaces:**
- Consumes: existing `navigation` array format
- Produces: new `navigation` array with 5 sections, "Altro" expandable

- [ ] **Step 1: Read current navigation array**

Read `assets/app.js` to locate the `navigation` array and `mountShell` function.

- [ ] **Step 2: Replace navigation array**

Replace the existing navigation array with the new 5-section structure:

```javascript
const navigation = [
  // --- WORK ---
  { section: true, label: 'WORK' },
  { id: 'dashboard',    href: 'index.html',      icon: 'home',   label: 'Dashboard' },
  { id: 'progetti',     href: 'projects.html',   icon: 'folder', label: 'Progetti' },
  // --- RESOURCES ---
  { section: true, label: 'RESOURCES' },
  { id: 'catalogo',     href: 'catalogs.html',   icon: 'grid',   label: 'Catalogo' },
  // --- OUTPUT ---
  { section: true, label: 'OUTPUT' },
  { id: 'exports',      href: 'report.html',     icon: 'download', label: 'Report / Export' },
  // --- MORE ---
  { section: true, label: 'MORE' },
  { id: 'altro-parent', href: '#', icon: 'plus', label: 'Altro', expandable: true, children: [
    { id: 'editors',    href: 'editors.html',      icon: 'code',     label: 'Editors' },
    { id: 'ai',         href: 'ai-assistant.html',  icon: 'spark',   label: 'AI Assistant' },
    { id: 'flow',       href: 'flow.html',          icon: 'flow',    label: 'Flow & Data' },
    { id: 'docs',       href: 'documentation.html',  icon: 'info',    label: 'Documentation' },
    { id: 'users',      href: 'users.html',          icon: 'user',    label: 'Account' },
    { id: 'ui-kit',     href: 'ui-kit.html',         icon: 'grid',    label: 'UI Kit' },
  ]},
];
```

- [ ] **Step 3: Update mountShell for expandable nav**

Update `mountShell` function to render expandable sub-items for entries with `expandable: true`. Use click-to-toggle with a chevron icon. When a child page is active, the parent shows as active too.

Add CSS for expandable nav in `assets/app.css`:
```css
.nav-expandable .nav-chevron {
  transition: transform .15s;
}
.nav-expandable.open .nav-chevron {
  transform: rotate(90deg);
}
.nav-sub-link {
  padding-left: 32px;
  font-size: 12.5px;
}
```

- [ ] **Step 4: Update page data attributes**

Update `data-page` attributes on `<body>` of pages to match new IDs:
- `index.html` → `data-page="dashboard"`
- `projects.html` → `data-page="progetti"`
- `report.html` → `data-page="exports"`
- `catalogs.html` → `data-page="catalogo"`
- Keep all others as-is (they're in "Altro")

- [ ] **Step 5: Remove "Current project" and "Results" from sidebar**

The navigation array no longer has dynamic "Current project" and "Results" links. These appear contextually on the project detail page.

- [ ] **Step 6: Verify**

Open `index.html` in browser. Sidebar should show 5 sections. "Altro" should be clickable to expand/collapse. All links should work.

- [ ] **Step 7: Commit**

```bash
git add assets/app.js assets/app.css index.html projects.html report.html catalogs.html
git commit -m "feat: restructure navigation to 5-section sidebar"
```

---
### Task 2: Dashboard Redesign

**Files:**
- Modify: `index.html` — redesign content
- Modify: `assets/app.js` — update demo data for dashboard metrics

**Interfaces:**
- Consumes: existing `userProfiles`, `demoGraph`, `mountShell`
- Produces: new dashboard HTML with metric row, recent projects, quick actions

- [ ] **Step 1: Read current index.html**

Read `index.html` to understand the current structure.

- [ ] **Step 2: Rewrite index.html content**

Replace the `<main class="page home-page">` content with the redesigned dashboard:

```html
<main class="page home-page">
  <header class="page-header home-header">
    <div>
      <span class="eyebrow" data-workspace-name>Personal workspace</span>
      <h1>Buongiorno, <span data-user-name>Eleanor Wright</span></h1>
      <p><span data-user-metric="projects">3</span> progetti attivi · <span data-user-metric="experiments">8</span> esperimenti · ultima sincronizzazione NOMAD: <span id="lastNomadSync">oggi</span></p>
    </div>
    <div class="page-actions">
      <button class="button primary" type="button" data-action="experiment-wizard"><span data-icon="flask"></span>Nuovo esperimento</button>
      <button class="button" type="button" data-action="stack-wizard"><span data-icon="model"></span>Nuovo stack</button>
    </div>
  </header>

  <!-- Metric cards -->
  <div class="grid-4" id="dashboardMetrics">
    <div class="metric">
      <span class="metric-label">Esperimenti attivi</span>
      <span class="metric-value" data-user-metric="experiments">8</span>
      <span class="metric-detail">3 in esecuzione</span>
    </div>
    <div class="metric">
      <span class="metric-label">Stack in uso</span>
      <span class="metric-value" id="stackCount">12</span>
      <span class="metric-detail">4 materiali diversi</span>
    </div>
    <div class="metric">
      <span class="metric-label">Export in coda</span>
      <span class="metric-value" id="pendingExportCount">2</span>
      <span class="metric-detail">1 per NOMAD</span>
    </div>
    <div class="metric">
      <span class="metric-label">Ultimo NOMAD</span>
      <span class="metric-value" id="lastNomadLabel">oggi</span>
      <span class="metric-detail">EXP-2026-052</span>
    </div>
  </div>

  <!-- Continue card -->
  <section class="panel home-continue" aria-labelledby="continueTitle">
    <div class="home-continue-main">
      <span class="home-continue-icon" data-icon="flask"></span>
      <div class="min-0">
        <span class="eyebrow">Continua il tuo lavoro</span>
        <h2 id="continueTitle" data-project-name>Mixed-cation perovskite optimisation</h2>
        <p><span class="mono" data-user-recent>EXP-2026-052</span> · Revisione risultati · 6 di 8 step completati</p>
      </div>
    </div>
    <div class="home-continue-progress" aria-label="Experiment progress">
      <div><span style="width:75%"></span></div>
      <strong>75%</strong>
    </div>
    <div class="home-continue-actions">
      <a class="button" href="project.html">Apri progetto</a>
      <a class="button primary" href="experiment.html#results">Continua esperimento</a>
    </div>
  </section>

  <!-- Quick actions strip -->
  <div class="home-value-strip" style="--strip-cols: 4;">
    <button class="quick-action" type="button" data-action="experiment-wizard">
      <span data-icon="flask"></span>
      <div><strong>Nuovo esperimento</strong><small>Wizard guidato</small></div>
    </button>
    <button class="quick-action" type="button" data-action="stack-wizard">
      <span data-icon="model"></span>
      <div><strong>Nuovo stack</strong><small>Definisci materiali e condizioni</small></div>
    </button>
    <button class="quick-action" type="button" data-action="quick-import">
      <span data-icon="upload"></span>
      <div><strong>Importa dati</strong><small>Da file o NOMAD</small></div>
    </button>
    <a class="quick-action" href="report.html#nomad">
      <span data-icon="download"></span>
      <div><strong>Esporta per NOMAD</strong><small>Prepara package</small></div>
    </a>
  </div>

  <!-- Projects section -->
  <div class="section-title home-section-title">
    <div>
      <h2>I tuoi progetti</h2>
      <p>Apri un obiettivo di ricerca, revisiona esperimenti o avvia una nuova corsa.</p>
    </div>
    <a href="projects.html">Vedi tutti</a>
  </div>
  <section class="home-project-grid" id="homeProjectList" aria-label="I tuoi progetti"></section>

  <!-- Lower grid: needs attention + quick start -->
  <section class="home-lower-grid">
    <article class="panel">
      <div class="panel-header">
        <div class="panel-title"><strong>Da fare</strong><small>Azioni che sbloccano il tuo lavoro</small></div>
        <span class="badge warning" id="attentionCount">3</span>
      </div>
      <div class="attention-list" id="homeAttentionList"></div>
    </article>
    <aside class="panel">
      <div class="panel-header">
        <div class="panel-title"><strong>Avvio rapido</strong><small>Riutilizza prima, crea solo se serve</small></div>
      </div>
      <div class="panel-body home-quick-actions">
        <a class="quick-action primary" href="experiment.html">
          <span data-icon="flask"></span>
          <div><strong>Nuovo esperimento</strong><small>Parti da un processo salvato</small></div>
        </a>
        <button class="quick-action" type="button" data-action="quick-create">
          <span data-icon="catalog"></span>
          <div><strong>Crea oggetto riutilizzabile</strong><small>Materiale, soluzione, stack o metodo</small></div>
        </button>
        <a class="quick-action" href="catalogs.html">
          <span data-icon="grid"></span>
          <div><strong>Sfoglia la libreria</strong><small>Usa qualcosa già preparato</small></div>
        </a>
      </div>
    </aside>
  </section>
</main>
```

- [ ] **Step 3: Add dashboard metric data to app.js**

In `assets/app.js`, update `applyUserScope` to populate dashboard metrics from `userProfiles`:

```javascript
// In applyUserScope or after mountShell
const metricEls = document.querySelectorAll('[data-user-metric]');
if (metricEls.length) {
  const user = getCurrentUser();
  metricEls.forEach(el => {
    const key = el.dataset.userMetric;
    if (key === 'projects' && user) el.textContent = user.projects.length;
    if (key === 'experiments' && user) el.textContent = user.projects.reduce((sum, p) => sum + (p.experiments || 0), 0) || '8';
  });
}
```

- [ ] **Step 4: Add data-action handlers for new buttons**

Add click handlers in the event delegation for these new actions:
- `data-action="experiment-wizard"` → navigate to `experiment.html`
- `data-action="stack-wizard"` → open stack creation wizard (or navigate to `stack.html?new`)
- `data-action="quick-import"` → navigate to `report.html#import`

- [ ] **Step 5: Keep existing `mountShell` and `applyUserScope`**

Ensure the index.html still has `<body data-page="dashboard">` so mountShell applies.

- [ ] **Step 6: Verify**

Open `index.html`. Should show: greeting with user name, 4 metric cards, continue card, 4 quick-action buttons, projects grid, lower grid.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/app.js
git commit -m "feat: redesign dashboard with metrics and quick actions"
```

---
### Task 3: Project Page with Tabs

**Files:**
- Modify: `project.html` — add tabs (Overview, Experiments)
- Modify: `assets/app.js` — ensure project tabs work, add experiment count per project

- [ ] **Step 1: Read current project.html**

Read `project.html` to understand current structure.

- [ ] **Step 2: Add tab navigation to project detail**

Add tabs after the project identity header:

```html
<div class="tabs" data-tabs="project">
  <button class="tab-button active" type="button" data-tab="overview">Panoramica</button>
  <button class="tab-button" type="button" data-tab="experiments">Esperimenti <span class="badge" data-project-experiment-count>4</span></button>
</div>

<!-- Overview tab -->
<div class="tab-panel active" data-tab-panel="overview">
  <!-- existing focus card and research path go here -->
</div>

<!-- Experiments tab -->
<div class="tab-panel" data-tab-panel="experiments">
  <!-- Move existing experiments list here, enhanced with stack info -->
</div>
```

- [ ] **Step 3: Enhance experiment list rows**

Each experiment row now shows:
- Status badge (running, completed, draft)
- Progress bar
- Stack name (linked to stack.html)
- Quick actions: Continue / View results / Export

- [ ] **Step 4: Update app.js project rendering**

Update the `renderProjectExperiments` function (or equivalent) to include stack info and new layout.

- [ ] **Step 5: Verify**

Open `project.html`. Should see two tabs, switching between them works. Experiments tab shows enhanced rows.

- [ ] **Step 6: Commit**

```bash
git add project.html assets/app.js
git commit -m "feat: add project tabs and enhanced experiment list"
```

---
### Task 4: Experiment Wizard Enhancement (Stack, Conditions, Pipeline)

**Files:**
- Modify: `experiment.html` — enhance Step 2 (Plan) with stack/conditions/pipeline sections
- Modify: `assets/app.js` — add stack management UI in wizard

- [ ] **Step 1: Read current experiment.html**

Read `experiment.html`, especially Step 2 (Plan).

- [ ] **Step 2: Add Material Stack section to Step 2**

In the Plan step, after the existing "Variable" section, add:

```html
<section class="panel" id="planStackSection">
  <div class="panel-header">
    <div class="panel-title"><strong>Material Stack</strong><small>Definisci gli stack di materiali per questo esperimento</small></div>
    <button class="button small" type="button" data-action="add-stack-to-experiment"><span data-icon="plus"></span>Aggiungi stack</button>
  </div>
  <div class="panel-body" id="experimentStackList">
    <!-- Stack cards rendered by JS -->
  </div>
</section>
```

- [ ] **Step 3: Add Conditions sub-section**

After stack section, add:

```html
<section class="panel" id="planConditionsSection">
  <div class="panel-header">
    <div class="panel-title"><strong>Condizioni</strong><small>Parametri di processo per questo stack</small></div>
  </div>
  <div class="panel-body">
    <div class="condition-planner" id="conditionPlanner">
      <!-- Existing condition cards enhanced -->
    </div>
  </div>
</section>
```

- [ ] **Step 4: Add Pipeline & Actions sub-section**

```html
<section class="panel" id="planPipelineSection">
  <div class="panel-header">
    <div class="panel-title"><strong>Pipeline & Azioni</strong><small>Sequenza operativa e checklist operatore</small></div>
    <button class="button small" type="button" data-action="add-pipeline-step"><span data-icon="plus"></span>Aggiungi step</button>
  </div>
  <div class="panel-body">
    <div class="pipeline-steps" id="pipelineSteps">
      <!-- Pipeline steps rendered by JS -->
    </div>
  </div>
</section>
```

- [ ] **Step 5: Add data-action handlers**

Add handlers in `assets/app.js`:
- `data-action="add-stack-to-experiment"` → open stack selector/catalog drawer
- `data-action="add-pipeline-step"` → add new pipeline step row
- Stack card rendering: show mini-stack visual, name, conditions badge

- [ ] **Step 6: Add demo stack data**

Add a sample stack to the experiment demo data:

```javascript
const demoStack = {
  id: 'STK-001',
  name: 'FA0.85Cs0.15PbI3',
  layers: [
    { type: 'substrate', label: 'FTO/Glass', thickness: '2.2 mm' },
    { type: 'transport', label: 'TiO2 Compact', thickness: '30 nm' },
    { type: 'transport', label: 'TiO2 Mesoporous', thickness: '150 nm' },
    { type: 'absorber', label: 'FA0.85Cs0.15PbI3', thickness: '500 nm' },
    { type: 'transport', label: 'Spiro-OMeTAD', thickness: '200 nm' },
    { type: 'contact', label: 'Au', thickness: '80 nm' },
  ],
  solutions: ['SOL-001', 'SOL-002'],
  conditions: { spinSpeed: '2000 rpm', annealTemp: '150°C', atmosphere: 'N2' }
};
```

- [ ] **Step 7: Verify**

Open `experiment.html`, navigate to Step 2. Should see the new Material Stack, Conditions, and Pipeline sections. Should be able to add a stack from catalog.

- [ ] **Step 8: Commit**

```bash
git add experiment.html assets/app.js
git commit -m "feat: add stack, conditions, pipeline sections to experiment wizard"
```

---
### Task 5: New Page — stack.html

**Files:**
- Create: `stack.html` — full stack detail/editor page
- Modify: `assets/app.js` — add stack data model and rendering
- Modify: `assets/app.css` — add any new stack-specific styles

- [ ] **Step 1: Create stack.html**

```html
<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Stack detail">
  <title>Stack · LabFlow</title>
  <link rel="stylesheet" href="assets/app.css">
  <script defer src="assets/exporters.js"></script>
  <script defer src="assets/app.js"></script>
</head>
<body data-page="stack-detail">
  <header id="topbar" class="topbar"></header>
  <aside id="sidebar" class="sidebar"></aside>
  <button class="sidebar-overlay" type="button" data-action="close-sidebar" aria-label="Close navigation"></button>

  <div class="app-main">
    <main class="page stack-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Stack <span class="mono" id="stackId">STK-001</span></span>
          <h1 id="stackName">FA0.85Cs0.15PbI3</h1>
          <p id="stackDescription">Stack perovskite a base formamidinio/cesio per cella n-i-p</p>
        </div>
        <div class="page-actions">
          <button class="button" type="button" data-action="edit-stack"><span data-icon="code"></span>Modifica</button>
          <button class="button primary" type="button" data-action="use-stack"><span data-icon="flask"></span>Usa in esperimento</button>
        </div>
      </header>

      <!-- Layer stack visual -->
      <div class="stack-visual" id="stackVisual"></div>

      <!-- Tabs -->
      <div class="tabs" data-tabs="stack">
        <button class="tab-button active" type="button" data-tab="solutions">Soluzioni <span class="badge" id="solutionCount">2</span></button>
        <button class="tab-button" type="button" data-tab="materials">Materiali <span class="badge" id="materialCount">4</span></button>
        <button class="tab-button" type="button" data-tab="conditions">Condizioni</button>
        <button class="tab-button" type="button" data-tab="pipeline">Pipeline</button>
        <button class="tab-button" type="button" data-tab="actions">Azioni</button>
      </div>

      <!-- Solutions tab -->
      <div class="tab-panel active" data-tab-panel="solutions" id="stackSolutions">
        <!-- Rendered by JS -->
      </div>

      <!-- Materials tab -->
      <div class="tab-panel" data-tab-panel="materials" id="stackMaterials">
        <!-- Rendered by JS -->
      </div>

      <!-- Conditions tab -->
      <div class="tab-panel" data-tab-panel="conditions" id="stackConditions">
        <!-- Rendered by JS: key-value grid of conditions -->
      </div>

      <!-- Pipeline tab -->
      <div class="tab-panel" data-tab-panel="pipeline" id="stackPipeline">
        <!-- Rendered by JS: visual pipeline graph -->
      </div>

      <!-- Actions tab -->
      <div class="tab-panel" data-tab-panel="actions" id="stackActions">
        <!-- Rendered by JS: operator checklist -->
      </div>
    </main>
  </div>
  <div id="toastRegion" class="toast-region" aria-live="polite"></div>
</body>
</html>
```

- [ ] **Step 2: Add stack data model in app.js**

Add a stack data structure and demo data:

```javascript
const stackData = {
  'STK-001': {
    id: 'STK-001',
    name: 'FA0.85Cs0.15PbI3',
    description: 'Stack perovskite a base formamidinio/cesio per cella n-i-p',
    dateCreated: '2026-07-15',
    layers: [
      { type: 'substrate', label: 'FTO/Glass', thickness: '2.2 mm' },
      { type: 'transport', label: 'TiO2 Compact', thickness: '30 nm' },
      { type: 'transport', label: 'TiO2 Mesoporous', thickness: '150 nm' },
      { type: 'absorber', label: 'FA0.85Cs0.15PbI3', thickness: '500 nm' },
      { type: 'transport', label: 'Spiro-OMeTAD', thickness: '200 nm' },
      { type: 'contact', label: 'Au', thickness: '80 nm' },
    ],
    solutions: [
      { id: 'SOL-001', name: 'FA0.85Cs0.15PbI3 Precursor', role: 'Absorber precursor', volume: '1.5 mL' },
      { id: 'SOL-002', name: 'Spiro-OMeTAD HTL', role: 'Hole transport', volume: '1.0 mL' },
    ],
    materials: [
      { name: 'FAI', formula: 'CH(NH2)2I', supplier: 'GreatCell Solar', purity: '99.99%', lot: 'FAI-2204' },
      { name: 'CsI', formula: 'CsI', supplier: 'Sigma Aldrich', purity: '99.999%', lot: 'CSI-0312' },
      { name: 'PbI2', formula: 'PbI2', supplier: 'TCI', purity: '99.99%', lot: 'PBI2-1187' },
      { name: 'Spiro-OMeTAD', formula: 'C81H68N4O8', supplier: 'Merck', purity: '99.8%', lot: 'SPI-4056' },
    ],
    conditions: {
      spinSpeed: '2000 rpm',
      spinTime: '30 s',
      annealTemp: '150 °C',
      annealTime: '20 min',
      atmosphere: 'N2 glovebox',
      humidity: '< 0.1 ppm',
    },
    pipeline: [
      { step: 1, name: 'Substrate cleaning', duration: '15 min', operator: 'ricercatore' },
      { step: 2, name: 'TiO2 Compact deposition', duration: '30 min', operator: 'ricercatore' },
      { step: 3, name: 'TiO2 Mesoporous deposition', duration: '45 min', operator: 'ricercatore' },
      { step: 4, name: 'Perovskite spin-coating', duration: '5 min', operator: 'ricercatore' },
      { step: 5, name: 'Perovskite annealing', duration: '30 min', operator: 'ricercatore' },
      { step: 6, name: 'Spiro-OMeTAD deposition', duration: '5 min', operator: 'ricercatore' },
      { step: 7, name: 'Au contact evaporation', duration: '20 min', operator: 'tecnico' },
    ],
    actions: [
      { step: 1, task: 'Pulire substrate con acetone e IPA', done: true },
      { step: 2, task: 'Preparare soluzione TiO2 Compact', done: true },
      { step: 3, task: 'Preparare soluzione TiO2 Mesoporous', done: true },
      { step: 4, task: 'Filtrare soluzione perovskite con filtro 0.45 µm', done: false },
      { step: 5, task: 'Accendere hotplate a 150°C', done: false },
      { step: 6, task: 'Preparare soluzione Spiro-OMeTAD', done: false },
      { step: 7, task: 'Caricare substrate nell\'evaporatore', done: false },
    ],
  }
};
```

- [ ] **Step 3: Add stack rendering functions in app.js**

Add functions:
- `renderStackPage(stackId)` — renders the full stack.html page with all tabs
- `renderStackVisual(stack)` — renders the layer band visual
- `renderStackSolutions(stack)` — renders solutions table
- `renderStackMaterials(stack)` — renders materials table
- `renderStackConditions(stack)` — renders conditions key-value grid
- `renderStackPipeline(stack)` — renders pipeline steps
- `renderStackActions(stack)` — renders action checklist

- [ ] **Step 4: Add page init for stack page**

In the DOMContentLoaded handler, detect `data-page="stack-detail"` and call `renderStackPage()` with the stack ID from URL params.

- [ ] **Step 5: Add handler for "Usa in esperimento" button**

`data-action="use-stack"` → navigate to `experiment.html?stack=STK-001`

- [ ] **Step 6: Verify**

Open `stack.html?stack=STK-001` in browser. Should show full stack detail with layer visual, tabs switching between solutions/materials/conditions/pipeline/actions tabs.

- [ ] **Step 7: Commit**

```bash
git add stack.html assets/app.js assets/app.css
git commit -m "feat: add stack detail page with tabs"
```

---
### Task 6: New Page — solution.html

**Files:**
- Create: `solution.html` — solution editor page

- [ ] **Step 1: Create solution.html**

```html
<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Solution detail">
  <title>Solution · LabFlow</title>
  <link rel="stylesheet" href="assets/app.css">
  <script defer src="assets/exporters.js"></script>
  <script defer src="assets/app.js"></script>
</head>
<body data-page="solution-detail">
  <header id="topbar" class="topbar"></header>
  <aside id="sidebar" class="sidebar"></aside>
  <button class="sidebar-overlay" type="button" data-action="close-sidebar" aria-label="Close navigation"></button>

  <div class="app-main">
    <main class="page solution-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Soluzione <span class="mono" id="solutionId">SOL-001</span></span>
          <h1 id="solutionName">FA0.85Cs0.15PbI3 Precursor</h1>
          <p id="solutionDescription">Soluzione precursore per assorbitore perovskite</p>
        </div>
        <div class="page-actions">
          <button class="button" type="button" data-action="edit-solution"><span data-icon="code"></span>Modifica</button>
        </div>
      </header>

      <!-- Solution diagram visual (existing CSS: .solution-diagram) -->
      <div class="solution-diagram" id="solutionDiagram">
        <div class="solution-inputs" id="solutionInputs">
          <!-- Precursor inputs rendered by JS -->
        </div>
        <div class="solution-beaker" data-icon="flask"></div>
        <div class="solution-output">
          <strong id="solutionOutputLabel">FA0.85Cs0.15PbI3 1.5M</strong>
          <small>in DMF:DMSO 4:1</small>
        </div>
      </div>

      <!-- Details -->
      <div class="split">
        <div class="panel">
          <div class="panel-header"><div class="panel-title"><strong>Precursori</strong></div></div>
          <div class="panel-body">
            <table class="data-table" id="solutionPrecursors">
              <!-- Rendered by JS -->
            </table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div class="panel-title"><strong>Solventi</strong></div></div>
          <div class="panel-body">
            <table class="data-table" id="solutionSolvents">
              <!-- Rendered by JS -->
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div class="panel-title"><strong>Proprietà</strong></div></div>
        <div class="panel-body">
          <div class="grid-3" id="solutionProperties">
            <!-- Rendered by JS: concentration, molar ratio, volume, etc. -->
          </div>
        </div>
      </div>
    </main>
  </div>
  <div id="toastRegion" class="toast-region" aria-live="polite"></div>
</body>
</html>
```

- [ ] **Step 2: Add solution data and rendering in app.js**

Add solution demo data:
```javascript
const solutionData = {
  'SOL-001': {
    id: 'SOL-001',
    name: 'FA0.85Cs0.15PbI3 Precursor',
    description: 'Soluzione precursore per assorbitore perovskite',
    precursors: [
      { name: 'FAI', formula: 'CH(NH2)2I', ratio: '0.85', concentration: '1.275 M' },
      { name: 'CsI', formula: 'CsI', ratio: '0.15', concentration: '0.225 M' },
      { name: 'PbI2', formula: 'PbI2', ratio: '1.0', concentration: '1.5 M' },
    ],
    solvents: [
      { name: 'DMF', ratio: '4', volume: '4 mL' },
      { name: 'DMSO', ratio: '1', volume: '1 mL' },
    ],
    properties: {
      totalConcentration: '1.5 M',
      volume: '5 mL',
      molarRatio: 'FAI:CsI:PbI2 = 0.85:0.15:1.0',
      solventRatio: 'DMF:DMSO 4:1 (v/v)',
    }
  }
};
```

Add rendering function `renderSolutionPage(solutionId)`.

- [ ] **Step 3: Add page init**

In DOMContentLoaded, detect `data-page="solution-detail"` and render.

- [ ] **Step 4: Verify**

Open `solution.html?solution=SOL-001`. Should show solution diagram, precursors table, solvents table, properties grid.

- [ ] **Step 5: Commit**

```bash
git add solution.html assets/app.js
git commit -m "feat: add solution detail page"
```

---
### Task 7: New Page — material.html

**Files:**
- Create: `material.html` — material card page

- [ ] **Step 1: Create material.html**

```html
<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Material detail">
  <title>Material · LabFlow</title>
  <link rel="stylesheet" href="assets/app.css">
  <script defer src="assets/exporters.js"></script>
  <script defer src="assets/app.js"></script>
</head>
<body data-page="material-detail">
  <header id="topbar" class="topbar"></header>
  <aside id="sidebar" class="sidebar"></aside>
  <button class="sidebar-overlay" type="button" data-action="close-sidebar" aria-label="Close navigation"></button>

  <div class="app-main">
    <main class="page material-page">
      <header class="page-header">
        <div>
          <span class="eyebrow">Materiale</span>
          <h1 id="materialName">FAI</h1>
          <p id="materialFormula">CH(NH2)2I · <span class="mono" id="materialLot">FAI-2204</span></p>
        </div>
        <div class="page-actions">
          <button class="button" type="button" data-action="edit-material"><span data-icon="code"></span>Modifica</button>
        </div>
      </header>

      <div class="grid-3">
        <div class="panel">
          <div class="panel-header"><div class="panel-title"><strong>Fornitore</strong></div></div>
          <div class="panel-body">
            <p class="mono" id="materialSupplier">GreatCell Solar</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div class="panel-title"><strong>Purezza</strong></div></div>
          <div class="panel-body">
            <p class="mono" id="materialPurity">99.99%</p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><div class="panel-title"><strong>Storage</strong></div></div>
          <div class="panel-body">
            <p class="mono" id="materialStorage">N2 glovebox, dark, RT</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div class="panel-title"><strong>Usato in</strong></div></div>
        <div class="panel-body" id="materialUsedIn">
          <!-- List of stacks/solutions using this material -->
        </div>
      </div>
    </main>
  </div>
  <div id="toastRegion" class="toast-region" aria-live="polite"></div>
</body>
</html>
```

- [ ] **Step 2: Add material data and rendering in app.js**

Add material demo data and `renderMaterialPage(materialId)` function.

- [ ] **Step 3: Verify**

Open `material.html?material=FAI`. Should show material card with supplier, purity, storage.

- [ ] **Step 4: Commit**

```bash
git add material.html assets/app.js
git commit -m "feat: add material detail page"
```

---
### Task 8: Catalog Updates

**Files:**
- Modify: `catalogs.html` — add Stack tab, "New stack" wizard button
- Modify: `assets/app.js` — add stack library data and rendering

- [ ] **Step 1: Read current catalogs.html**

Read `catalogs.html` to understand current library browser tabs.

- [ ] **Step 2: Add "Stack" button to Create reusable objects grid**

In the "Create reusable objects" grid, add:
```html
<button class="choice-card" type="button" data-action="stack-wizard">
  <span data-icon="model"></span>
  <strong>Stack</strong>
  <small>Definisci un multilayer di materiali perovskiti</small>
</button>
```

- [ ] **Step 3: Add "Stack" tab to Library Browser**

In the library tabs, add:
```html
<button class="tab-button" type="button" data-tab="stacks" data-catalog-tab>Stack</button>
```

Add corresponding panel:
```html
<div class="tab-panel" data-tab-panel="stacks" id="catalogStackList">
  <!-- Rendered by JS -->
</div>
```

- [ ] **Step 4: Add stack list rendering**

In app.js, add function to render stack library cards. Each card shows:
- Stack name
- Mini layer stack visual
- Layer count
- Link to stack.html

- [ ] **Step 5: Add "Nuovo stack" wizard flow**

Add a 3-step wizard for stack creation:
1. **Choose template**: blank or from presets
2. **Define layers**: add/remove layers with type, material, thickness
3. **Set conditions**: spin parameters, annealing, atmosphere

Render the wizard in a modal/overlay (reuse existing `.overlay` + `.modal` pattern).

- [ ] **Step 6: Verify**

Open `catalogs.html`. Should see "Stack" button in create grid, "Stack" tab in library. Stack tab shows available stacks. "Nuovo stack" wizard opens modal.

- [ ] **Step 7: Commit**

```bash
git add catalogs.html assets/app.js
git commit -m "feat: add stack management to catalog"
```

---
### Task 9: Unified Report / Export Page

**Files:**
- Modify: `report.html` — add export and NOMAD tabs
- Modify: `assets/app.js` — add export tab content, NOMAD import UI and simulation
- Modify: `assets/exporters.js` — add NOMAD import simulation

- [ ] **Step 1: Read current report.html and exports.html**

Read both files to understand current structure.

- [ ] **Step 2: Add tabs to report.html**

Add tab navigation at top of the page:
```html
<div class="tabs" data-tabs="report-export">
  <button class="tab-button active" type="button" data-tab="report">Report</button>
  <button class="tab-button" type="button" data-tab="export">Export locale</button>
  <button class="tab-button" type="button" data-tab="nomad">NOMAD</button>
</div>

<div class="tab-panel active" data-tab-panel="report">
  <!-- Existing report editor content -->
</div>

<div class="tab-panel" data-tab-panel="export">
  <!-- Export cards: JSON, CSV, Excel, YAML -->
</div>

<div class="tab-panel" data-tab-panel="nomad">
  <!-- Export section + Import section -->
</div>
```

- [ ] **Step 3: Export tab content**

Copy the export cards from `exports.html` into the export tab panel. Include JSON, CSV, Excel, YAML format buttons with existing data.

- [ ] **Step 4: NOMAD tab — Export section**

Include existing NOMAD export UI: package preview with directory tree, NOMAD URL/token/upload fields, script generation.

- [ ] **Step 5: NOMAD tab — Import section (NEW)**

Add import section:
```html
<section class="panel">
  <div class="panel-header">
    <div class="panel-title"><strong>Importa da NOMAD</strong><small>Scarica esperimenti dal tuo repository NOMAD</small></div>
  </div>
  <div class="panel-body">
    <div class="form-grid">
      <div class="field">
        <label>NOMAD Repository URL</label>
        <input class="input" type="url" id="nomadImportUrl" value="https://nomad-lab.eu/prod/rae/api/" placeholder="https://nomad-lab.eu/prod/rae/api/">
      </div>
      <div class="field">
        <label>API Key</label>
        <input class="input" type="password" id="nomadApiKey" placeholder="Inserisci la tua API key">
      </div>
    </div>
    <button class="button primary" type="button" data-action="nomad-browse"><span data-icon="download"></span>Browse experiments</button>
    <div id="nomadImportResults" style="margin-top: 12px;">
      <!-- Simulated results -->
    </div>
  </div>
</section>
```

- [ ] **Step 6: Add NOMAD import simulation**

In `assets/app.js`, add handler for `data-action="nomad-browse"` that:
1. Shows loading state
2. After 800ms delay, renders simulated NOMAD experiment list
3. Each row has checkbox, experiment ID, title, date, status
4. "Import selected" button maps data to LabFlow format

In `assets/exporters.js`, add a `simulateNomadImport()` function that returns mock NOMAD experiment data.

- [ ] **Step 7: Update navigation link**

Ensure `report.html` is the page linked from "Report / Export" in sidebar. The old `exports.html` still exists but is not linked from nav.

- [ ] **Step 8: Verify**

Open `report.html`. Should show 3 tabs: Report (existing), Export locale (export cards), NOMAD (export + import). NOMAD import browse button shows simulated results.

- [ ] **Step 9: Commit**

```bash
git add report.html assets/app.js assets/exporters.js
git commit -m "feat: unify report, export, and NOMAD import in single page"
```

---
### Task 10: UI Kit Updates

**Files:**
- Modify: `ui-kit.html` — add new component sections

- [ ] **Step 1: Read current ui-kit.html**

Read the UI kit to understand its structure.

- [ ] **Step 2: Add new sections**

Add sections for:
1. **Stack detail page** — show the full stack page layout with layer visual and tabs
2. **Solution preview** — show solution diagram with precursors table
3. **Condition cards** — show processing condition key-value grid
4. **Pipeline steps** — show step-by-step pipeline visual
5. **Action checklist** — show operator action checklist with done/pending states
6. **NOMAD import panel** — show import form and results list

Each section follows the existing pattern:
```html
<section id="kit-stack">
  <span class="eyebrow">Domain visual</span>
  <h2>Stack detail</h2>
  <p>Full stack detail page with layer visual and management tabs.</p>
  <!-- Demo content -->
</section>
```

- [ ] **Step 3: Add to navigation**

Update the UI kit's internal nav to include new sections.

- [ ] **Step 4: Verify**

Open `ui-kit.html`. All new sections should be visible with demo content.

- [ ] **Step 5: Commit**

```bash
git add ui-kit.html
git commit -m "docs: add new component sections to UI kit"
```
