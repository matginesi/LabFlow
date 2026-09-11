# LabFlow UI skill

Use this skill for every LabFlow visual, layout, responsive, chart, export-surface or interaction change.

## Read first

Before editing UI, read `docs/guides/RESEARCH_WORKFLOW.md`, `LABFLOW_POC_SPEC.md`, `docs/UI.md`, `ui-kit.html`, and the relevant feature spec. Do not cite or depend on documentation files that are not present in the repository. Inspect the production page and its late CSS overrides before adding selectors: LabFlow has one visual system and later overrides must not silently reintroduce obsolete dimensions.

## One visual source of truth

Use this hierarchy only:

1. `assets/css/tokens.css` — colors, typography, spacing, density, shell dimensions and theme values.
2. `assets/css/ui.css` — reusable controls, fields, panels, tabs, tables, badges and notices.
3. `assets/css/app.css` — shell and page composition plus feature-specific layouts.
4. `ui-kit.html` — executable examples that use production classes.
5. This skill — implementation rules, never an alternate stylesheet/component library.

Do not introduce a page-local design language, duplicated color constants or a second component system. Add a reusable production pattern first, demonstrate it in `ui-kit.html` when useful, then rebuild `assets/js/pages/ui-kit-inline.js`.

## Current product workflow

The primary experiment flow is exactly **Upload & Review → Results → Design → Export**.

- Upload & Review is the mandatory entry point and contains source receipt plus review workbench.
- Results is deterministic analysis and visualization.
- Design holds qualitative experiment architecture, chemistry and process.
- Export is the save/interchange boundary: LabFlow ZIP is the primary portable save; NOMAD artifacts are secondary deterministic exports.
- Cabinet, Documentation and Settings are utilities outside the four-step primary workflow.

Do not restore legacy `Report`, `Paper` or standalone `NOMAD` workflow steps.

## Density and typography

LabFlow is a compact scientific workbench, not an oversized card dashboard and not a micro-font console. Density is shared across the product: use the tokenized page gap, panel head/body padding and task gap before inventing feature-local spacing. A feature may reflow, but should not become visibly looser or tighter than neighboring pages without a scientific reason.

- Normal content should generally use the shared `--font-sm` / `--font-md` scale.
- `--font-xs` is appropriate for labels and compact metadata.
- `--font-micro` is reserved for genuinely secondary technical metadata, never primary actions, Action names, warnings, scientific values or explanatory copy.
- Do not use 7–9 px text for user-facing controls/content.
- Shared controls follow the tokenized normal/compact control heights. Prefer tighter grouping and less decorative padding before shrinking type.
- Normal fields/buttons are `36px`; the single compact variant is `32px`. Use `.button.compact`, `.input.compact`, `.select.compact` or `.textarea.compact` only in dense toolbars and inspectors, and keep controls in one row vertically aligned. Do not add feature-local control heights.
- Form rows use `.field`; supporting copy uses `.help`; validation copy uses `.field-error` next to an `aria-invalid` control. Use `.checkbox-row` for choices and `.switch-row` only for immediate boolean settings.
- A heading, eyebrow and supporting meta line need visible vertical rhythm (roughly 2–4 px between related lines); never concatenate visually into one dense line. Eyebrows use sentence case, normal tracking and restrained weight. Reserve all-caps for scientific abbreviations such as JV, PCE and RAW, not decorative section titles.
- Compact summaries use the shared `fact-strip` / `fact-item` / `fact-label` / `fact-value` rhythm. Labels and values are separate block rows; never rely on adjacent inline text that can render as `Label**Value**`.
- Long names, paths and evidence must wrap or truncate deliberately. Never let text collide with buttons/badges or escape a card.
- Panels stay flat, radii modest, borders meaningful, and whitespace concentrated between scientific tasks rather than inside every tiny element.
- Page/task spacing comes from `--page-gap`, `--task-gap`, `--panel-head-*` and `--panel-body-pad`. Use the existing spacing scale/utilities before adding a margin or padding literal.
- The canonical panel structure is `.panel > .panel-head + .panel-body`; title/meta sit together and actions sit at the opposite edge or wrap below on narrow screens.

## Layout rules

- Every grid/flex child that can contain long scientific content needs `min-width: 0`.
- Keep page-level horizontal scrolling at zero. Wide tables/charts may use an explicit local scroll viewport.
- Put primary action(s) near the title/task they affect; secondary metadata belongs below or alongside, not between label and value.
- Avoid card nesting for decoration. A surface should represent a real task, state or grouping.
- On mobile, reflow before compressing typography. Buttons may stack/full-width; essential labels remain readable.
- On small screens (`<=700px`), shared tab sets reflow into a compact grid. Never turn tabs into a horizontally scrollable single row; labels may wrap inside their grid cell.
- Design experiment selectors follow the same small-screen contract: compact grid, never a horizontal card carousel.
- Responsive decisions follow the actual workspace width, not only the browser viewport. Split workbenches collapse when sidebar/Assistant chrome leaves insufficient content width; do not leave a lone or cramped half-width panel beside empty space.

### Navigation and scroll contract

- Opening a different route starts that page at the top; do not restore the previous route's main-document scroll position.
- Switching a content-defining tab/filter in Results, Documentation or Cabinet keeps the shared tab/filter anchor at the same visible position whenever geometry permits. A Settings rail selection establishes a new utility context at the workspace beginning. Do not move focus or call `scrollIntoView()` merely to reveal new content.
- Preserve scroll only for explicitly bounded local regions within the **same** view context (for example a long selector list), keyed by that view identity. Never reuse local scroll memory across different tabs/documents.
- Do not work around navigation jumps with delayed arbitrary pixel offsets or page-specific scroll hacks.

## Export page pattern

Export is artifact-first, not a settings form.

1. Show a compact current-workspace summary.
2. Present export artifacts as a clear list with **LabFlow ZIP first and primary**.
3. Keep NOMAD entry/staging artifacts visually secondary and disable them when deterministic readiness blocks them.
4. Put package options in a separate compact panel.
5. Keep mapping/readiness in its own panel with blocking issues visible and the detailed field mapping progressively disclosed.
6. Every blocking NOMAD readiness issue must expose a concrete next step in the UI. Never leave the researcher with only an error string.
7. Use existing domain Actions only when the blocker is genuinely semantic (for example unresolved dataset ambiguity). Package/mapping generation remains deterministic; do not create an AI “NOMAD preparation” Action.
8. Package-option blockers should offer a safe local resolution such as disabling optional RAW/derived payloads. Mapping/data blockers should route to the owning workflow page.
9. Keep implemented export local. A remote NOMAD upload surface may exist only as an explicit **Not implemented** stub: it must perform no network request, must not imply that data was transferred, and must route configuration to the dedicated Settings section. Future credentials/settings remain separate from export manifests.

## Upload & Review safe-cleanup contract

- Mechanically provable cleanup is **detected automatically** by deterministic code, but a newly detected correction must remain pending until the researcher explicitly accepts it.
- `Apply safe corrections` must produce an observable LabFlow Data mutation, record patch/provenance, rebuild affected links/samples as needed, and rerun the deterministic pipeline immediately.
- Never present a change as awaiting acceptance if the same mutation has already been silently applied. Canonical parser normalization (for example naming normalization done while parsing) is a separate provenance category and may remain automatic when it does not rewrite RAW.
- Re-running the pipeline is idempotent: an accepted safe correction must not reappear as pending, and repeated refreshes must not accumulate duplicate automatic patches.
- RAW/source bytes remain immutable throughout detection and acceptance.

## Results and chart contract

Results are deterministic first. Charts visualize canonical measurements; they do not recalculate scientific truth.

Results should be optimized for researcher triage before exhaustive inspection. Keep exactly four top-level workspaces: **Overview / Data / JV / Compare**. Put ranking, warnings and subset choices inside Data; put single-scan analysis and overlays inside JV. Do not grow the top-level tab count as features are added.

Overview answers the lazy-researcher questions first: **what is best, which group is strongest, how much data is eligible, what needs attention, and where should I drill down next**. Prefer robust group summaries (median + IQR + min–max) over mean-only bars; mean may be selectable but should not be the sole/default statistic.


Every primary chart should, where the data supports it:

- react to current metric/scan/group filters rather than being a static screenshot;
- provide pointer **and keyboard** inspection for values (tooltip/focus detail);
- allow series visibility toggles when multiple traces are present;
- preserve readable axes, units and group/sample identity;
- remain useful when interaction is unavailable;
- export the visual as **PNG and SVG** and its underlying plotted rows as **CSV**;
- use the self-contained local SVG renderer and canonical LabFlow data; do not add a runtime CDN/chart dependency merely for basic interaction/export;
- keep RAW curve export at plotted-point granularity and aggregate charts export the canonical rows from which the visual was computed;
- use local horizontal scrolling for many groups rather than crushing labels.

Chart colors come from `--chart-*` tokens. Theme accent is for interaction/state, not for making every data series the same accent color.

## Primary workflow simplicity

Optimize the first view for a researcher who wants the answer before the controls. Upload, Results, Design and Export must expose the primary decision/action first and place secondary diagnostics, normalization knobs, provenance tables, complete mappings and already-resolved details behind native progressive disclosure. Do not remove capability; delay it until the researcher asks for it or the data state makes it relevant. A blocker may open or foreground its own resolution, but unrelated advanced sections stay closed. Compact does not mean showing everything simultaneously: density comes from smaller, consistent spacing and progressive disclosure, not from filling every viewport with controls.
For Upload & Review specifically, keep the Experiment Brief as a shallow summary strip (primary fact plus compact counts), and keep Manual/Diagnostics behind one Advanced disclosure. Inside it, manual override and diagnostics are mutually exclusive native disclosures so opening one does not stack both deep panels; long diagnostics use a bounded local vertical scroll rather than extending the whole page.

## Error recovery

Page failures are recovered where they happen. Results, Design and Export offer Retry, a deterministic derived-data rebuild when safe, and Logs. Never use Upload & Review as a generic error destination. Route to source review only when the actual blocker is missing or ambiguous source evidence, and say why. A guard/precondition is `unavailable`, not a failed provider request.

## Actions and Assistant

User-facing capabilities use `button[data-action]` and the Action contracts. The Assistant may launch public Actions and show their bounded outcomes, but it must still run them through `ActionUI`/guards/confirmation semantics rather than bypassing contracts.

The Assistant exposes exactly one compact **Actions** launcher near the composer. Its menu contains the complete public Action catalog, orders page-recommended Actions first, and explains unavailable Actions; do not duplicate that catalog as a persistent recommended-actions strip above the composer. Slash commands such as `/interpret`, `/design`, `/compare` and `/resolve` remain visible inside Action controls/events when useful. The current page changes recommendation order, never catalog membership.

Action results shown in chat should be readable at normal compact UI sizes. Full JSON/provider telemetry stays behind progressive disclosure. The Assistant can receive a bounded `recent_actions` summary for follow-up conversation, but Action events are not silently rewritten into user messages or scientific state.

AI surfaces must state responsibility: deterministic analysis is authoritative; AI suggests, interprets or drafts. Never style an AI enrichment as if it recalculated a metric.

## Canonical Totems

Keep exactly two Totem families, both owned by `assets/css/ui.css` and `assets/js/ui/feedback.js`:

- **Message Totem** (`.message-totem`): application feedback and decisions. Use the single `.message-totem` implementation for both transient info/success/warning/error feedback and confirmations; confirmations only add the shared action row. Inline `.notice` content is part of a page and is not a Totem.
- **Action Totem** (`.activity-totem`): one foreground Action or substantive bounded workflow operation with progress, checkpoints, cancellation, result and technical disclosure. Detect and Save & test are substantive bounded provider workflows and use this same Action Totem from validation through the live LLM probe and final result. Pages never create their own progress Totem markup.

All transient application feedback must go through `LF.UI.message(...)`, which renders the canonical compact Message Totem in the shared `#messageRegion`. Confirmations go through `LF.UI.confirmAction(...)`; Action execution goes through the existing `LF.UI.activity*` surface. Never render a transient success/warning/error/info string directly into a page, and never add a page-owned toast/message/Totem host. Static explanatory `.notice` blocks remain valid page content. The NOMAD direct-upload stub is application feedback and therefore uses a Message Totem.

Do not introduce page-specific Totems, “totem-toast” clones, legacy toast APIs or a generic mode framework. Add a small documented semantic variant to one of these two owners only when neither existing shape fits.

## Implementation discipline

Reuse the production classes demonstrated by `ui-kit.html`, ordinary semantic HTML and the current vanilla-JavaScript/CSS stack. The repository does not currently load a Bootstrap runtime; keep markup Bootstrap-compatible where practical, but do not add Bootstrap, a CDN, trackers, a frontend framework or a component abstraction merely for visual cleanup. Remove a retired selector when migrating its markup.

## Results workspace stability

Results uses one stable researcher workspace: **Overview / Data / JV / Compare**. A route change opens the destination page at its beginning. Changing a main Results tab or subordinate Data/JV mode preserves the visible position of the Results tab strip whenever geometry permits; a shorter view clamps only to the nearest valid scroll position. Never force-focus the new panel, call `scrollIntoView()` or transplant an unrelated document offset. Ordinary rerenders preserve the main workspace position and explicitly bounded local scroll regions. The main Results tabs may be sticky within the page scroll container; on small screens they reflow into the shared compact tab grid and must not create document-level horizontal overflow.

## Design and Cabinet

Design is one selected experiment/variant at a time: solution chemistry, ordered stack and process. Keep the default workbench light: automatically expand domains that are missing or need researcher attention and keep already-complete domains collapsed until requested. One `design.infer` run attempts every currently missing domain and uses its bounded internal retries for incomplete model output; do not introduce a second "Suggest missing" state. Only after those attempts fail should the UI offer `Retry inference`. **Exactly one** Retry inference control may be visible for the selected failed experiment: it lives in the active-experiment strip. Do not duplicate it in the AI proposal panel, error panel, bulk toolbar, or Action activity totem. AI proposals remain visibly separate until accepted. The bulk completion control is only a queue over the same `design.infer` Action: it must run and persist each target independently, retry previously failed incomplete targets, verify that a proposal was stored for the exact experiment before marking it complete, and preserve pending/error states truthfully when stopped or rate-limited. Never add a second batch inference implementation.

Cabinet is a browser-local reusable scientific shelf, not inventory/LIMS. Incomplete resources can be edited but must not be presented as applicable matches. Copying Cabinet content into Design uses snapshots and must preserve chemistry/stack/process content. Cabinet belongs to the scientific canvas, not the dark navigation chrome: controls use the **same shared LabFlow tabs, fields, buttons, badges and notices** as the rest of the application; resource kinds may use restrained chart-token accents only for recognition. Keep exactly one search/create command bar, one resource-kind filter strip, one locally scrollable resource shelf and one detail editor, with backup/restore behind progressive disclosure. The canonical layout is **responsive shelf above, full-width editor below**. The shelf uses compact selectable resource tiles (not a KPI/card dashboard and not a table header with grey slabs): 3 columns on wide canvas, 2 on tablet, 1 on phone. At narrow widths the command bar stacks, scientific fields become one column, editor actions become full-width controls, and page-level horizontal scrolling remains zero. Do not add a second toolbar, a permanent left/right master-detail split, native-looking unstyled filter buttons, or compatibility CSS for retired Cabinet layouts.


## Settings and Scientific Knowledge Base

Settings uses a compact intent-grouped rail and renders exactly one active section: AI contains AI connection, Assistant, AI tools and Knowledge Base; Integrations contains NOMAD; Workspace contains profile/appearance; Advanced contains Diagnostics and UI Kit. At narrow widths the rail reflows into a compact grid. Researcher-facing Settings must not expose internal data-model, pipeline or Action-contract architecture as ordinary workspace content; developer-only details belong in Advanced surfaces or inside an explicitly opened AI-tool detail. Selecting a section establishes a new view context at the workspace beginning.

Connection keeps the AI service, model and required credential prominent; endpoint, reasoning, streaming, timeouts and global caps stay under progressive disclosure. Check and Save & test are explicit, send no experiment data, and use the canonical Action Totem for the entire operation; do not add a parallel Message Totem or a second status workflow. Explicit-save sections visibly distinguish saved and unsaved state; field validation is local. NOMAD settings are browser-local preparation for a future uploader; saving them must not make a network request, and any token must remain separate from exported manifests/options. Service display names must not add `(local)` suffixes. For local-capable services, show a compact human-readable Local/Online connection summary in the main form; detailed endpoint, browser/CORS/bind guidance belongs in progressive disclosure. Do not fill Settings with long permanent explanatory text. `localhost`/`127.0.0.1` is same-device; LAN hostname/mDNS/private-IP endpoints are valid when the remote device can resolve/reach them and the provider/browser security policy permits the request. Thinking off/on are preferences: provider/model-required reasoning wins, and unknown/dynamic router capability stays on provider default rather than forcing an incompatible off flag. Detect must use the exact provider, endpoint and API key currently visible in the form, plus the visible model when already selected. A catalogue-backed provider may start Detect with no model selected only so the live catalogue from that same endpoint can populate one; Detect must then probe the selected returned model. It must fail when a required credential/catalogue/probe is unavailable and must never turn static capability metadata into a connectivity success.

The Knowledge Base management surface uses one search/filter toolbar, one bounded entry catalogue and one detail editor built from the standard panel/field/button/badge/notice primitives. The baseline, browser-local custom store and portable backup format are JSONL (one knowledge object per line). Bundled entries are visibly read-only; custom entries are editable. Draft entries may be incomplete but must be visually distinguished from AI-eligible active entries, and active entries must surface source/provenance readiness. Do not turn the KB into a dashboard, graph browser, RAG console, inventory UI or separate design system. Source citations use normal readable UI sizes and progressive disclosure where needed.

## Sidebar and themes

The primary workflow destinations are visible directly in navigation: **Upload & Review → Results → Design → Export**. Cabinet and Documentation are workspace utilities; Logs and UI Kit are advanced utilities; Settings stays in the bottom utility region.

`Reset session` is a global destructive operation and belongs in the **topbar**, not in the sidebar or a page footer. Keep it visibly distinct from routine actions with the danger token; on phone the icon remains visible even when its text label collapses.

- At desktop widths (`>1100px`) the sidebar is persistent and occupies its own shell column. Do not turn desktop navigation into a drawer.
- At tablet/mobile widths (`<=1100px`) the same sidebar becomes an off-canvas drawer with menu button, backdrop, close control and `Escape` support. Resize transitions must resynchronize `aria-hidden`/drawer state; never leave desktop navigation accessibility state behind after crossing the breakpoint.
- Only **Upload & Review, Results, Design and Export** receive shared in-page **Previous / Next** navigation from `PageShell`. It is the **first workflow card** and remains sticky at the top of the main page scroller while page content moves underneath; utility pages do not show it. The route order is declared once. Make the controls visually obvious without leaving the theme: surface-backed buttons, a stronger accent treatment for **Next**, readable destination labels and approximately 48 px touch height. On phones show the two destinations side by side and hide the nonessential central position pill rather than wrapping it onto a new row.
- Do not duplicate the desktop workflow with a second large stepper; the compact workflow strip is primarily a narrow-screen orientation aid.

### Responsive ownership

Use one shell contract only: desktop `>1100px`, drawer/tablet `<=1100px`, phone `<=700px`. Shared phone selectors such as `.page`, `.panel-head`, `.panel-body`, `.topbar`, `.sidebar` and `.assistant-panel` must have one canonical responsive definition. Feature media queries may reflow their own grids/tables/charts, but must not re-declare global shell spacing as a late "fix". Remove retired selectors when markup changes instead of preserving compatibility CSS.

Theme variants use identical markup and component structure. Theme differences belong in tokens. JSON, Markdown, charts, Assistant, export surfaces and totems inherit active theme variables; do not hard-code light/dark surfaces.

The default instrument theme is intentionally hybrid: dark structural chrome around a light scientific canvas. Never set one global dark native `color-scheme` and let browser form controls leak charcoal backgrounds into the canvas. The main scientific canvas uses light native controls; Sidebar/Topbar/Assistant may opt into dark native chrome locally. The fully light theme keeps all regions light.

Assistant is a local themed surface. Every embedded badge, notice, Markdown blockquote/table, code block, JSON/structured result, Action card and composer control must use Assistant tokens while inside `.assistant-panel`. Never place canvas `--surface*` or light semantic slabs inside a dark Assistant. Conversely, light theme Assistant must not retain dark code/JSON islands.

## Verification

After UI changes:

1. rebuild generated UI/docs/action bundles affected by source changes;
2. run `node --check` across production JS;
3. run `python tools/validate_ui_contract.py` and the architecture/state/privacy/action validators when relevant;
4. run the unit suite;
5. run `python tools/test_responsive_browser.py` when the environment permits it;
6. verify every local `<script src>` / stylesheet path exists;
7. search for stale duplicate selectors, unreferenced runtime classes/helpers and obsolete workflow labels after changing a shared pattern;
8. do not add chronological CSS layers such as "final fix", "polish" or versioned overrides. Consolidate the owning rule instead.

## Hosted provider browser transport

Hosted providers always use the endpoint and credentials visible in Settings and are contacted directly from the browser. LabFlow has no relay/backend fallback, so UI diagnostics must say clearly when browser CORS is the limiting layer. LAN-capable provider requests remain direct browser requests: classify loopback separately from LAN, support single-label hostnames such as `fedora`, `.local` names and private IPs, and declare the browser target address space when supported. Never imply that frontend code can bypass Local Network Access, mixed-content or CORS policy.


## Export recovery and shared state

- Export blockers are resolved in Export whenever the affected data can be inspected there. Never use Upload & Review as a generic error destination.
- `Recheck` operations use the activity totem and rebuild deterministic projections from the current ExperimentData.
- Before route changes, Actions, or Assistant turns, pending drafts must be committed so every surface reads the same revision.
- Previous/Next belongs only to Upload & Review, Results, Design and Export, as the first sticky card at the top of those pages.
- On phones, primary workflow controls become full-width/two-column touch targets without horizontal page overflow.
