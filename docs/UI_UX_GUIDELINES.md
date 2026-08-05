# UI and interaction guidelines

## Design direction

LabFlow should feel like calibrated laboratory instrumentation: compact, sober and precise. Small radii, low controls, clear separators, dense tables and restrained accents support scanning. Decoration is secondary to identifiers, state, evidence and next actions.

Surfaces are flat and deliberate. Ordinary panels use neutral borders and solid semantic backgrounds. Decorative gradients, glassmorphism, neon or glow effects, oversized radii and heavy shadows are not part of the product language. Accent color communicates selection, progress, metrics, validation or status; it is not used as decoration.

The dark shell establishes stable navigation around light content by default. Typography uses one local system stack with a deliberate weight hierarchy. Icons use a coherent outline language. Page entry animations are avoided; continuity comes from stable geometry and applying appearance before first paint.

## Information hierarchy

Every operational page should answer: where am I, which project or object is active, what is its state, what evidence supports it, what can I do next and what will that action affect? Project context and stable identifiers precede visual summaries.

Workspace is the research control surface rather than a decorative dashboard. It combines four compact health meters, the current project and pipeline position, direct research commands, a three-column project portfolio and review queues. Project cards expose both current step and next decision. On mobile the active pipeline step is automatically brought into view.

Workspace, Project, Lab Cabinet, Knowledge, Tools and Settings represent distinct jobs. Documentation and UI Kit are curated learning surfaces, not file browsers. Pipeline pages reuse shared components and do not invent isolated visual systems.

## LabFlow Page Shell and Page Composition Standard

Every entry document contains the same checked-in application shell before JavaScript runs: skip link, sidebar, global topbar, main content container and global overlay roots. JavaScript hydrates identity, active context and page-specific content; it never constructs or replaces the complete shell after `DOMContentLoaded`. LabFlow remains a static multipage application: no client router, page fetcher, virtual DOM or mandatory build step is part of the runtime.

The page composition contract is ordered as follows:

```text
Application Shell
├── Sidebar
├── Global Topbar
└── Page Shell
    ├── Page Context / Breadcrumb
    ├── Page Header
    │   ├── Optional eyebrow or object type
    │   ├── Title and optional status
    │   ├── Description
    │   └── Page actions
    ├── Optional Summary Strip
    ├── Optional navigation or tabs
    ├── Optional toolbar
    └── Page Content
        ├── Primary content
        └── Optional secondary content
```

Blocks may be omitted, but present blocks keep this order, shared spacing and shared responsive behavior. The breadcrumb sits inside page content above the header and aligned to the same left edge. Workspace uses a single current-page breadcrumb so every main page begins with the same composition. The global topbar contains only global navigation, search, assistant, appearance and profile controls. It remains fixed at the top of the viewport on desktop, tablet and mobile; page content reserves the same topbar height so no heading or control is hidden underneath it.

The shared page header accepts context, eyebrow, title, description, status and actions. Each page has at most one primary action, a small number of secondary actions and no principal action hidden in an unrelated card. Rare or destructive actions belong in a local More menu when required.

### Page archetypes and widths

LabFlow uses five composition archetypes:

- **Index:** Workspace and Lab Cabinet; header, optional summary, collection toolbar, collection, secondary sections.
- **Detail:** an entity or operational record; entity header, status/actions, compact summary, sections and contextual content.
- **Workflow:** Project and pipeline steps; project header, project summary, standard step navigation, current step and contextual controls.
- **Analysis / workbench:** Knowledge and Tools; header, scope or tool controls, main work area and evidence/inspector rail.
- **Reference:** Settings, Documentation and UI Kit; standard context/header with a reading, configuration or reference surface.

Two page-shell widths are used. Every wrapper is centered, uses `width: 100%` and stays within 1600 px. Width, side padding and topbar distance belong to the page shell, not individual renderers.

| Semantic width | Maximum | Product use |
| --- | ---: | --- |
| `page-width-standard` | 1320 px | Reserved for future intentionally narrow surfaces |
| `page-width-wide` | 1600 px | Workspace, Project, Lab Cabinet, AI & Models, Robotics, Tools, Settings, Documentation and UI Kit |

Documentation is a wide reference page because its document navigator, article and table of contents need the same horizontal rhythm as the rest of LabFlow. Readability is controlled inside the article: ordinary prose remains near 72 characters, while tables, code and diagrams may use the wider article surface with local overflow.

Project and other operational workbenches use the wide wrapper. Builder/Review pairs, tables and report workbenches use the available width and then reflow locally; they must not introduce a second page-level maximum width. At very large viewport sizes the centered wrapper leaves visible margins instead of stretching indefinitely.

### Spacing and density

Page and component layout use the shared 4/8/12/16/24/32 px scale. The default wide page uses 24 px horizontal padding on desktop, 12 px on tablet/mobile and compact vertical rhythm. Values outside the scale are reserved for intrinsic control dimensions, charts or scientific geometry rather than arbitrary whitespace.

A dense interface is not a cramped interface. Labels, identifiers and units remain readable; large blank areas, decorative hero spacing and repeated nested containers are avoided. Tables and workbenches receive local horizontal scrolling instead of shrinking scientific controls until they become ambiguous.

### Summary, cards, tabs and toolbars

`summary-strip` is the single compact pattern for essential metadata, quantities, status and progress. Its cells use neutral dividers and collapse from four or three columns to two and then one. Workspace metrics, project context, Cabinet totals and workbench capability summaries derive from this pattern.

Surface accents have one meaning:

```text
Top accent  → metric or compact numeric summary
Left accent → status, severity, information, suggestion or validation
No accent   → ordinary content
Outline and surface → current selection
```

A toolbar contains view-level search, filters, sort, view controls, count and tightly scoped local actions in that order. Tabs follow the header or summary, keep one active item and scroll locally if their labels cannot fit. Section headings use the shared title, optional description and right-aligned local action/badge structure.

### Stable first paint

The theme controller remains the only synchronous bootstrap and runs before CSS. Entry documents link the shared stylesheets directly and in the same order: tokens/themes, foundations, shell, components, utilities and responsive rules. Optional JavaScript is loaded only on pages that use it and all runtime modules use `defer`.

Do not mask loading with opacity, global fade, page-entry animation or an artificial boot state. Stable geometry comes from checked-in shell markup, shared sidebar/topbar dimensions, semantic page widths, explicit logo dimensions and `scrollbar-gutter: stable`. Dynamic previews and diagrams reserve appropriate local space. Navigation may load a new document, but it must never show an empty application root or rebuild the global shell from JavaScript.

## UI Kit and block contract

The UI Kit is the visual source of truth, not a gallery of speculative components. It must show the current semantic tokens, typography, spacing, actions, badges, navigation, forms, tables, feedback states, workflow blocks, scientific Builder/Review pairs, assistant/evidence patterns, overlays and report identity. Its Shared Block Registry maps each major block to allowed variants and actual application use.

Use this order when changing a page:

1. compose an existing block without changing it;
2. extend an existing documented variant when the interaction contract remains the same;
3. create a new block only for a distinct, recurring contract;
4. update the UI Kit and this guide;
5. remove replaced markup and CSS after checking all references.

Cards and panels are structural surfaces, not synonyms for arbitrary boxes. Toolbars group search, filters, view controls and counts. Notices communicate system state and a next step. Validation issues preserve severity and evidence. Interactive styling is reserved for elements that really navigate or respond.

Theme values flow from global semantic tokens to shared blocks and then to minimal layout adjustments. Page-specific colors, parallel component names, inline static dimensions and selector overrides are not accepted when a shared token or block already covers the need.

## AI & Models workspace

The existing `knowledge.html` entry point is presented as one **AI & Models** workspace with four compact sections: Knowledge Assistant, Datasets, Models and Predictions. This avoids separate technical products for RAG, ML and inference.

- Knowledge keeps conversation, scope and evidence visible together.
- Datasets explains readiness, snapshots, features, targets and warnings.
- Models shows model cards and training runs without implying production deployment.
- Predictions pairs every prediction with observed value, uncertainty, input coverage, model/dataset provenance and human review.

Project Review may show evidence-linked advisory findings, but dataset and model management remain in AI & Models. Do not add isolated AI dashboards inside the pipeline, unexplained readiness scores or predictions styled as measured results.

## Ask LabFlow layout

On wide screens, Ask LabFlow uses three full-height columns: scope and saved views, conversation, and evidence. The outer panels stretch to the height of the conversation rather than ending after their initial content. Below the wide breakpoint, evidence moves beneath the first two columns; on tablet and mobile all panels become a single reading flow.

The conversation labels answer route, sources, confidence and limitations. Relationship answers may include a graph when it clarifies three or more linked records. The graph caption must distinguish provenance from causality.

## Tools layout

Tools groups workspaces by job: Write, Structure, Visualise and Publish. Each tool has a distinct icon, concise purpose, persistent privacy reminder and consistent stage header. Editors keep source and preview visually separate. Diagram Studio presents a line-numbered source editor beside a gridded SVG stage, with templates, syntax help, TD/LR controls, validation, node/relation counts, fit/zoom controls and a local editable-SVG download. These controls extend the shared Tool Stage rather than creating a separate visual language.

Tool state is volatile. Opening a local file never implies upload. Reload returns every editor to its checked-in example.

## Project workflow composition

CHOSE uses one page-level sequence and one contained navigation level:

```text
Project header
→ project summary strip
→ Process / Experiment / Results / Review navigator
→ current-step heading
→ contained section tabs
→ current work surface
→ Back / Save draft / Save and continue
```

The current-step heading is a plain section boundary, not another card or hero banner. It shows step number, expected output, title and concise description without repeating project ID, owner and status already visible in the page header or summary.

Contained tabs are allowed only for the sections inside the active step:

| Step | Contained sections |
| --- | --- |
| Process | Chemistry · Fabrication · Stack Review |
| Experiment | Setup · Execution · Summary |
| Results | Files · Mapping · Quality Review |
| Review | Overview · Compare · Findings · Report & Export |

The project navigator is compact on desktop and scrolls locally on narrow screens. Wide tables scroll inside `table-wrap`; the complete page never develops horizontal overflow.

## Scientific interaction rules

Solution and Stack Builder pair editing with deterministic Review. Solution Review presents volume, concentration and state as labelled facts, with separate composition ratios and a complete quantities table; it does not use a decorative vessel illustration. Stack order, material, thickness, function and process stay synchronized with report output.

## Documentation rendering contract

Documentation is a local reading surface backed by the single checked-in Markdown bundle. Its renderer supports headings with stable anchors, paragraphs, emphasis, ordered and unordered nested lists, blockquotes, inline code, fenced code, local images, Markdown tables and locally rendered Mermaid diagrams. Relative links to another managed Markdown document remain inside Documentation and preserve heading fragments.

| Content | Rendering contract | Width behavior |
| --- | --- | --- |
| Prose and lists | Local reading type with clear heading hierarchy | Controlled to about 72 characters |
| Tables | Semantic header and tabular numerals | Horizontal overflow stays local |
| Code | Local mono stack and preserved indentation | Horizontal overflow stays local |
| Diagrams and images | Local resources with captions or fallback | May use the article width |

> Documentation never depends on a remote parser, font, syntax highlighter or diagram service.

Behavior checkpoints remain grouped by purpose:

- Navigation
  - same-document links move to a stable heading anchor;
  - managed Markdown links open the target inside Documentation.
- Wide content
  - tables and code scroll inside their own region;
  - diagrams and local images never widen the page.

The application shell provides the initial loading state. Missing, empty or malformed selections receive plain-language states; technical detail is limited to safe console diagnostics. The document navigation, previous/next links and table of contents all resolve through the same Documentation experience.

See [Graphs and diagrams](AI_REPORTS_AND_EXPORT.md#graphs-and-diagrams) for the shared local rendering and evidence rules.

Smart Import exposes mappings and unit conversions before confirmation. Validation communicates severity with text, icon and color. AI suggestions, correlations and hypotheses remain distinct from observed data and researcher conclusions.

## Responsive contract

- Desktop supports dense multi-column work and a fixed full-height navigation rail.
- Tablet reduces grids and turns navigation into a drawer.
- Mobile uses a single content column with scoped horizontal scrolling for tables and steppers.
- No page may introduce page-level horizontal overflow.
- Touch targets and control labels remain operable at compact density.
- CHOSE uses one horizontal four-step project navigator: Process, Experiment, Results and Review. Contained tabs organise subsections without adding another navigation hierarchy.
- Project steps are tested at 1600, 1024, 768 and 390 pixels. Builder/Review pairs stack before their scientific controls become compressed.
- The project navigator scrolls horizontally below the desktop layout and centers the active step on entry.
- Wide scientific tables keep their own scroll region; forms, findings and report panels reflow inside the viewport.
- Stack fields retain visible Material, Thickness, Function and Process labels on mobile. Layer thicknesses never wrap into vertical fragments.

## Search and navigation

Global search is local, ephemeral and grouped by domain. It supports pointer input, `Ctrl/Cmd+K`, arrow keys, Enter and Escape. On mobile it becomes a focused topbar overlay. Queries disappear on reload.

Theme, palette and density remain coherent across normal internal navigation, but reload restores checked-in defaults. The pre-style theme controller prevents cross-page flicker.

When a project is open, the primary sidebar adds a contextual project entry directly below Workspace. It shows the project name and stable identifier, retains the current pipeline step in its link and is the active navigation item. The project does not add a second internal sidebar; its pipeline navigator appears once above the current step. Workspace remains the parent destination rather than being marked as the current page. The same hierarchy remains visible in the tablet and mobile navigation drawer.

## Accessibility contract

- Provide skip navigation and visible `:focus-visible` treatment.
- Use semantic controls and accessible names for icon-only buttons.
- Trap focus in modals, restore the invoking focus and support Escape.
- Announce status changes through polite live regions.
- Respect reduced-motion preferences.
- Never encode scientific state or graph meaning by color alone.
- Give diagrams an accessible label and a textual caption when interpretation matters.

## Content voice

Use direct, operational language. Distinguish “generated”, “reviewed”, “approved” and “submitted”. Avoid claims that imply connected services or scientific certainty. Demonstration values and identities should be clearly illustrative; use **Matteo Ginesi** consistently as the example researcher and report author.

## Dense scientific controls

LabFlow uses a slightly denser control scale for laboratory workbenches. Buttons, inputs, selects and text areas remain keyboard accessible and readable, but avoid unnecessary vertical expansion. Comfortable density remains available for users who prefer larger controls.

## Reorderable scientific definitions

Stack layers and solution components support both pointer-based dragging and explicit Move Up / Move Down controls. The accessible controls are mandatory; drag and drop is only a convenience. Reordering immediately updates the technical review so the author can see the canonical order that will be retained by future persistence and export adapters.

## Local icon system

Product icons come from one checked-in, Lucide-inspired local icon set with a consistent 24×24 view box, two-pixel stroke, round caps and round joins. Branding marks remain separate. Do not introduce one-off decorative SVG paths when an icon already exists in the local set, and never load icons from a CDN.


## Tabs, appearance continuity and user management

Tabs use one aligned contained bar with a single active surface and accent marker. Do not reintroduce unrelated underline-only variants. Theme, palette and density must travel through every internal navigation link, including direct-file use, so page changes preserve appearance without cookies or persistent browser storage.

User management is a session-only POC contract: the current profile, workspace directory, role vocabulary, status and project-access scope may be edited in memory, but the interface must never imply that credentials were created or permissions were enforced. Global product attribution uses **© 2026 Matteo Ginesi** where authorship or copyright is expected.

## Lab Cabinet browser contract

Lab Cabinet uses one reusable-object browser rather than a generic grid of unrelated cards. The shared pattern is:

```text
Family filters
→ Search and deterministic sort
→ Visual resource cards
→ Selected resource inspector
→ Explicit snapshot / provenance notice
```

Resource cards may use a small type-specific visual for materials, solvents, solutions, stacks, mappings and analysis recipes, but these visuals are summaries rather than scientific diagrams. The item name, stable identifier, status, metadata and usage remain readable without relying on color. Selection uses the shared selected-card treatment and the inspector remains visible on desktop, then moves below the catalogue on tablet and mobile.

Using a Cabinet definition in a project means copying a traceable snapshot. Editing a reusable definition must never imply that historical experiments are silently updated.

## Runtime page resilience

Each page declares its page-specific JavaScript dependencies and validates them before rendering. Knowledge, Tools, Documentation, Project and UI Kit must render a clear local failure state if a required checked-in module is missing or loaded in the wrong order. Data-backed visualizations normalize optional arrays and records before calling `map`, `filter`, numeric formatting or chart helpers, so a missing demonstration collection cannot blank the complete page.
## Settings pipeline registry pattern

The Settings page uses the wide 1600 px page shell because pipeline inspection, user management and administration contain dense tables and side-by-side evidence. The Pipelines tab uses one canonical summary strip followed by a two-column registry/inspector work surface.

- The registry table owns availability, contract state, step count, default selection and inspection.
- The inspector owns descriptive metadata, step outputs, gate state and links.
- The inspector may be sticky only at wide sizes and stacks below the table before content compresses.
- Availability controls are session-only and must say so explicitly.
- The last enabled pipeline cannot be disabled, and default selection is unavailable for disabled rows.
- New-project creation lists only enabled pipelines and preselects the current default.

Do not create pipeline cards with a separate visual language or duplicate pipeline administration inside the Administration tab.

## AI and model visual contract

AI & Models does not define an alternative dashboard style. It composes the same UI Kit blocks used elsewhere:

- summary strips for scope and counts;
- standard panels and panel headers;
- dense tables for datasets, runs, models, predictions and image queues;
- progress rows for readiness and coverage;
- metadata lists for inspectable facts;
- validation issues and notices for blocking work, limitations and human review;
- ordinary badges for status and explicit “Demonstration data” labels.

Only two specialized visual families are allowed and both are represented in the UI Kit: `ai-training-chart`, a local SVG plot inside a canonical panel with a separate legend; and `ai-vision-review`, a local image/annotation preview paired with canonical metadata, table selection and a human-review notice. Avoid readiness rings, gradient hero panels, decorative model dashboards, glow, oversized metrics and unlabeled model graphics.

