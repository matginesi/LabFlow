# UI contract

`ui-kit.html` demonstrates the visual system. Tokens live in `assets/css/tokens.css`, reusable controls in `assets/css/ui.css`, and application/page composition in `assets/css/app.css`. Rebuild `assets/js/pages/ui-kit-inline.js` after changing the UI Kit. The frontend remains semantic HTML, vanilla JavaScript and ordinary local CSS. Its class conventions are Bootstrap-compatible where useful, but this repository currently loads no separate Bootstrap runtime; do not add a framework/CDN dependency merely for UI cleanup.

## Shared typography, controls and spacing

The small type hierarchy is token-owned: page title, panel title, body/control text, label/helper text and technical micro metadata. Do not add arbitrary page-local sizes. Normal controls are 36 px high; the one compact variant is 32 px and uses `.compact` on the shared button/input/select/textarea classes. Use `.field`, `.help`, `.field-error`, `.checkbox-row` and `.switch-row` consistently. Shared page/task gaps and panel padding come from tokens; feature CSS should reflow layout rather than redefine global density.

Panels use `.panel > .panel-head + .panel-body`. Keep title and metadata together, align nearby controls by shared size, and wrap action groups rather than shrinking their type. Tables remain locally scrollable when their scientific columns cannot reflow.

## Canonical Totems

There are exactly two Totem families:

- **Message Totem**: application feedback and decisions. `.message-totem-dialog` is the modal confirmation shape; `.message-totem-compact` is transient info/success/warning/error feedback. Inline `.notice` blocks remain page content.
- **Action Totem**: one explicit foreground Action or substantive bounded workflow operation with progress, checkpoints, cancellation, result and optional technical disclosure. Routine Settings checks remain inline and finish with a Message Totem. Callers use `LF.UI.activity*`; pages do not implement local progress Totems.

Both live in `assets/css/ui.css` and are driven by `assets/js/ui/feedback.js`. Do not introduce page-specific Totems or merge both roles into a generic mode system.

## Workflow and shell

The primary workflow is **Upload & Review → Results → Design → Export**. Cabinet, Documentation and Settings are utility destinations, not extra workflow steps.

- The left navigation is fixed/persistent on desktop widths above 1100 px and becomes an off-canvas drawer at tablet/mobile widths. Menu, close, backdrop, route selection and `Escape` operate the drawer only where appropriate; crossing the breakpoint resynchronizes drawer/ARIA state.
- Only the four primary workflow routes — **Upload & Review, Results, Design and Export** — receive shared in-page **Previous / Next** controls. This navigation card is the first workflow surface and stays sticky at the top of the main page scroller while the researcher scrolls. It uses the one route order declared in `PageShell`, emphasizes **Next** with the accent treatment, and remains roughly 48 px touch targets. Utility pages do not show it. On narrow phones the center position indicator is hidden so Previous and Next stay on one row.
- The Assistant is closed by default and opens only after explicit user action.
- Page content must not create document-level horizontal scrolling. Tables, tabs, diagrams and wide charts may scroll inside a clearly bounded local region.
- Normal workflow content uses readable shared type/control tokens. Micro type is reserved for secondary technical metadata; primary labels/actions must not fall into 7–9 px text.
- Heading, eyebrow and supporting metadata require explicit vertical rhythm and must not visually collide. Eyebrows use sentence case without decorative tracking; all-caps are reserved for scientific abbreviations.
- Compact label/value summaries use the shared fact-strip pattern so labels, values and supporting metadata remain separate readable rows.
- Motion respects `prefers-reduced-motion`.

## Upload & Review

Upload copy, source metadata and actions reflow into one column on narrow screens. Deterministic naming and mechanical transformations happen automatically and remain visible with provenance. Excluding a measurement or resolving semantic ambiguity is suggestion/researcher-controlled: the researcher chooses the mutation.

## Results and charts

Results visualize the canonical deterministic measurement model. Interactive behavior must not become a second calculation path.

The researcher-facing structure is **Overview / Data / JV / Compare**. Overview is a triage surface, not a gallery: surface best sample, best group, eligible coverage, warnings and a robust group-distribution view before detailed tables. Data shows active records by default and owns Active/Best/Warnings/Excluded/Top subsets; Excluded is an explicit provenance-audit view, never an accidental reappearance in active Results. JV and Compare always omit excluded records. JV owns single-scan diagnostics and multi-scan overlay. Compare owns group statistics. Prefer median + IQR + min–max for group summaries, with mean available as an explicit alternative. Route changes start the destination page at its beginning. Switching a main Results tab or subordinate Data/JV mode keeps the tab strip at the same visible position whenever the new view has enough scroll range; shorter views clamp only to the nearest valid position and never call `scrollIntoView()`. Ordinary rerenders preserve the main workspace position; bounded local regions retain only same-context scroll memory.

Primary charts support the interactions appropriate to their data: metric/scan/group controls, hover/focus value inspection, series toggles for overlays and local scrolling for many categories. Chart exports are first-class: PNG and SVG export the visual, while CSV exports the canonical rows underlying the plotted view. The local SVG renderer is preferred so Results remains self-contained offline and in static deployment.

## Design and Cabinet

Design exposes complete experiment architecture rather than treating one layer as a complete stack. It supports solution chemistry, ordered device layers and process information. One `design.infer` execution attempts every missing design domain and retries incomplete model output internally; the UI does not add a second "Suggest missing" step. Only a true exhausted failure exposes **Retry inference**, and the selected experiment shows exactly one such control in its active strip. Proposal panels, error summaries, bulk controls and the Action activity totem do not duplicate it. AI output is a proposal and never overwrites known values silently.

Lab Cabinet is a reusable browser-local scientific shelf, not inventory or LIMS. Its canonical UI is a responsive shelf above a full-width selected-resource editor: one search/create command bar, the shared LabFlow tab treatment for resource-kind filtering, one locally scrollable tile shelf, one editor, and backup/restore behind progressive disclosure. Do not use a table-like grey header slab or a permanent left/right master-detail split. The shelf is 3 columns on wide canvases, 2 on tablet and 1 on phone; the command bar and editor fields reflow before typography shrinks. Resources are copied into Design as snapshots. Incomplete resources may be edited but are not valid matches/apply targets.

## Export

Export is artifact-first. The portable **LabFlow ZIP** is the primary save artifact. NOMAD entry YAML and staging ZIP are deterministic secondary outputs. NOMAD readiness is an actionable repair surface: every blocker exposes a route, safe package-option change, or an existing semantic Action where appropriate. Mapping details remain progressively disclosed. A direct NOMAD upload panel may be shown only as an unmistakable **Not implemented** stub until a real connector exists; it performs no network request and packaging remains deterministic/non-AI.

## Feedback and Totems

LabFlow has exactly two runtime feedback families. Transient application feedback uses the shared compact Message Totem through `LF.UI.message(...)`; confirmations use `LF.UI.confirmAction(...)`. Foreground Action execution uses the single shared Action Totem through `LF.UI.activity*`. Pages do not own toast regions, custom Totem markup or local success/error message components. Static `.notice` elements are explanatory page content only, not transient feedback. The NOMAD upload stub follows this rule and reports its non-networking state through the Message Totem.

## Actions and Assistant

User-facing capabilities use `button[data-action]`. Provider output/telemetry is progressively disclosed. A running Action exposes cancel and all Action execution still passes through guards/contracts.

The Assistant may launch public Actions and displays bounded Action outcomes inline regardless of whether they were launched from a page or from chat, so a follow-up question can reference them. Current persisted proposals/annotations/status enter context only through the bounded `ActionData` owner projection; conversation events remain interaction history, not a second scientific store. It exposes one compact **Actions** launcher/menu, with page-recommended Actions first and unavailable reasons visible; do not duplicate this with a persistent recommended-actions strip. It never mutates scientific state directly through free-form chat and never receives full RAW curves by default.

Global destructive `Reset session` is intentionally visible in the topbar. It uses danger styling and remains reachable as an icon on phone layouts; do not move it back into navigation utilities.


## Settings and Knowledge Base

Settings uses one compact navigation rail and one active section at a time. The rail groups Connection, Assistant, Actions and Knowledge Base under AI; NOMAD under Integrations; and Workspace under Local. On narrow canvases it becomes a readable grid rather than a horizontal scroller. Changing section starts the new Settings context at the workspace beginning. The Data and Action contract is advanced progressive disclosure inside Workspace, not a peer destination.

Connection keeps provider, exact model, endpoint and credential status visible; request timeouts, output caps, streaming and thinking overrides stay under progressive disclosure. Detect and Save & test are explicit, never run on page load, send no experiment data, report progress/result inline and use the Message Totem for completion or error rather than impersonating a LabFlow Action. Explicit-save sections show saved versus unsaved state, validation sits beside the relevant field, and credentials remain masked and browser-local. NOMAD remains configuration-only: saving performs no request and cannot imply upload or publication.

The Scientific Knowledge Base is managed inside **Settings → Knowledge Base** with the standard LabFlow surfaces: one search/filter toolbar, one bounded entry catalogue and one detail editor. Bundled records are read-only; custom records are browser-local and editable. Drafts may be incomplete but are excluded from AI context; active records require a traceable source. Import/export is backup/transfer, not a second scientific datastore. KB statements remain reference knowledge and never acquire ExperimentData/evidence styling.

## Responsive/readability rules

On phone/small-screen layouts, every shared `.tabs` set reflows into a compact grid with readable wrapping labels; tab navigation must never require horizontal scrolling. Design experiment selectors follow the same rule and use a compact grid rather than a horizontal carousel.

Reflow content before shrinking it. The shell has three responsive ownership levels only: desktop `>1100px`, drawer/tablet `<=1100px`, and phone `<=700px`. Global phone rules for page/panel/topbar/sidebar spacing are defined once; feature media queries may reflow only their own surfaces. Flex/grid children with scientific text use `min-width:0`; long paths/names wrap or truncate deliberately. Local scrolling is acceptable for data surfaces but not for the whole document. Buttons remain usable on touch layouts; Previous/Next controls stay at least touch-sized; essential text remains at shared readable sizes. Retired markup loses its CSS instead of keeping compatibility selectors.

## Local documentation and verification

The Documentation route renders canonical Markdown under `docs/` without network requests. `assets/js/pages/docs-bundle.js` is generated by `python tools/build_docs_bundle.py`; generated bundles are not editing sources.

After layout changes, run the responsive browser audit when available, `python tools/validate_ui_contract.py`, syntax checks and the unit suite. Search for late duplicate selectors when a shared pattern changes so stale overrides do not silently restore old spacing, micro-fonts or workflow counts.

## Theme and density consistency

LabFlow uses one density rhythm across workflow and utility pages. Shared page gap, panel header/body padding, form spacing and control sizes come from tokens; individual pages should reflow rather than invent a visibly different density. Compactness is combined with progressive disclosure so the first view is not packed with every available control.

The instrument theme uses dark structural chrome around a light scientific canvas. Native form color-scheme is therefore local: the scientific canvas stays light, while Sidebar/Topbar/Assistant can use dark chrome. The fully light theme keeps every region light. Assistant-contained badges, notices, Markdown, code and structured output must use Assistant tokens. Lab Cabinet belongs to the scientific canvas and reuses the shared LabFlow tabs, fields, buttons, badges, notices and form surfaces. Resource tiles use only restrained kind accents; they never become a separate dashboard/card language or native-looking browser controls.
