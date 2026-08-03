# UI and interaction guidelines

## Design direction

LabFlow should feel like calibrated laboratory instrumentation: compact, sober and precise. Small radii, low controls, clear separators, dense tables and restrained accents support scanning. Decoration is secondary to identifiers, state, evidence and next actions.

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

Blocks may be omitted, but present blocks keep this order, shared spacing and shared responsive behavior. The breadcrumb sits inside page content above the header and aligned to the same left edge. Workspace may omit it. The global topbar contains only global navigation, search, assistant, appearance and profile controls.

The shared page header accepts context, eyebrow, title, description, status and actions. Each page has at most one primary action, a small number of secondary actions and no principal action hidden in an unrelated card. Rare or destructive actions belong in a local More menu when required.

### Page archetypes and widths

LabFlow uses five composition archetypes:

- **Index:** Workspace and Lab Cabinet; header, optional summary, collection toolbar, collection, secondary sections.
- **Detail:** an entity or operational record; entity header, status/actions, compact summary, sections and contextual content.
- **Workflow:** Project and pipeline steps; project header, project summary, standard step navigation, current step and contextual controls.
- **Analysis / workbench:** Knowledge and Tools; header, scope or tool controls, main work area and evidence/inspector rail.
- **Reference:** Settings, Documentation and UI Kit; standard context/header with a reading, configuration or reference surface.

Only three semantic content widths are allowed. `page-width-standard` is used by Workspace, Lab Cabinet and Settings; `page-width-wide` by Project, Knowledge, Tools and UI Kit; `page-width-reading` by Documentation. Width, side padding and topbar distance belong to the page shell, not individual renderers.

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

## Ask LabFlow layout

On wide screens, Ask LabFlow uses three full-height columns: scope and saved views, conversation, and evidence. The outer panels stretch to the height of the conversation rather than ending after their initial content. Below the wide breakpoint, evidence moves beneath the first two columns; on tablet and mobile all panels become a single reading flow.

The conversation labels answer route, sources, confidence and limitations. Relationship answers may include a graph when it clarifies three or more linked records. The graph caption must distinguish provenance from causality.

## Tools layout

Tools groups workspaces by job: Write, Structure, Visualise and Publish. Each tool has a distinct icon, concise purpose, persistent privacy reminder and consistent stage header. Editors keep source and preview visually separate. Diagram Studio presents source beside a gridded SVG stage and provides a local download.

Tool state is volatile. Opening a local file never implies upload. Reload returns every editor to its checked-in example.

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
- Project steps are tested at 1600, 1024, 768 and 390 pixels. Builder/Review pairs stack before their scientific controls become compressed.
- The project stepper scrolls horizontally below the desktop layout and centers the active step on entry.
- Wide scientific tables keep their own scroll region; forms, findings and report panels reflow inside the viewport.
- Stack fields retain visible Material, Thickness, Function and Process labels on mobile. Layer thicknesses never wrap into vertical fragments.

## Search and navigation

Global search is local, ephemeral and grouped by domain. It supports pointer input, `Ctrl/Cmd+K`, arrow keys, Enter and Escape. On mobile it becomes a focused topbar overlay. Queries disappear on reload.

Theme, palette and density remain coherent across normal internal navigation, but reload restores checked-in defaults. The pre-style theme controller prevents cross-page flicker.

When a project is open, the primary sidebar adds a contextual project entry directly below Workspace. It shows the project name and stable identifier, retains the current pipeline step in its link and is the active navigation item. Workspace remains the parent destination rather than being marked as the current page. The same hierarchy remains visible in the tablet and mobile navigation drawer.

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
