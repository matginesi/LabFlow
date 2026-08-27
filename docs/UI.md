# UI contract

`ui-kit.html` is the visual ground truth. The live **UI Kit** route renders its generated catalog inline in the main LabFlow document instead of an iframe, because Chromium treats framed sibling `file://` documents as opaque origins. Regenerate `assets/js/pages/ui-kit-inline.js` with `python tools/build_ui_kit_inline.py` whenever the standalone UI Kit changes.

The **Documentation** route is a local browser over the canonical `docs/**/*.md` sources, excluding archived implementation plans under `docs/superpowers/`. It provides collection/search navigation, a rendered document, an outline, Markdown source disclosure and locally rendered `mermaid` flowcharts. `assets/js/pages/docs-bundle.js` is generated; rebuild it with `python tools/build_docs_bundle.py` after Markdown changes. The page must remain usable under `file://` and must not load documentation or diagram code from a CDN.

The experiment workflow is Upload & Review, Results, Design, Report, NOMAD. Upload remains mandatory; after import the same first page combines the source receipt with the review workbench. Pages use the shared compact shell, stepper, panels, tables, visible tab tracks and progressive disclosures.

There is one scientific Working Copy, separate from the byte-for-byte RAW source snapshot. `LF.CanonicalStore` adds aliases/relations/evidence as a deterministic index rather than a second editable data copy. The current Working Copy is autosaved locally and restored when LabFlow is reopened; the top bar distinguishes an autosaved draft from an explicit saved checkpoint. **Reset session** is the visible destructive boundary that clears the persisted experiment/RAW snapshot, while browser-local provider/API-key/UI preferences remain. All edits operate only on the Working Copy and exports never overwrite RAW.

Action buttons use `button[data-action]`. Successful checkpoints auto-advance. Heavy checkpoints can be split into bounded sequential work units and display checkpoint + unit progress. AI work units use their declared semantic retry policy (0–2 retries; default delays remain 5 s then 10 s); provider rate limits are never automatically retried. While running the totem exposes an explicit **Cancel action** control; terminal totems expose a separate **Close** control. `Esc` cancels a cancellable running Action and closes a completed/failed totem. Provider output is closed by default. Markdown and JSON output are formatted on the active theme surface, not dumped as raw plain text. JSON uses the same theme-aware data surface in totems, Assistant messages, request disclosures and Markdown `json` fences; the fully light theme never falls back to the generic dark code slab.

Review Data exposes deterministic findings/fixes immediately and AI corrections separately as soon as they are ready. Results read canonical measurements/samples directly, never Design. Charts use responsive inline SVG so visibility never depends on a layout-timed redraw; tables have explicit responsive scroll surfaces; Compare remains simple and deterministic.

Assistant chat is inline. Selection, chart interaction, filters, edits, navigation and local validation never invoke AI.


## Theme, UI Kit and density source of truth

The visual contract has one direction: `assets/css/tokens.css` defines theme values and shared density, `assets/css/ui.css` defines reusable primitives, `assets/css/app.css` composes page/layout patterns, and `ui-kit.html` demonstrates those exact live classes. The project skill `.agent/skills/labflow-ui/SKILL.md` describes how to use the same contract; it must not invent a parallel theme or component vocabulary.

The default `instrument` theme and optional `light` theme differ through tokens, not duplicated page CSS. Shared controls use a slightly roomier workbench rhythm (33 px controls, 29 px compact controls) while preserving information density. Page-specific rules must not drop normal workflow labels into micro typography.

The experiment stepper always has exactly five destinations. Desktop uses five equal, clearly legible cells. Narrow screens keep readable labels and use local horizontal scrolling with snap rather than shrinking the destinations. Settings lives in the sidebar bottom region together with provider status so primary workspace navigation remains stable above it.

## Sidebar typography

Primary sidebar labels use the shared small UI scale (11 px) and secondary descriptions/section labels use the shared extra-small scale (10 px). The sidebar stays compact, but must not use micro-text for normal navigation. Mobile navigation keeps at least the extra-small scale.

## Upload & Review actions

Upload & Review is deterministic-first after the mandatory ZIP import: **Analyze dataset** automatically refreshes Canonical Store, Results and the compact Analysis Dossier; **Apply safe corrections** performs only provable repairs; **Resolve ambiguities** is enabled only for semantic unknowns on the current revision. AI only proposes; accepted application is a local internal service that mutates the one Working Copy and triggers deterministic refresh. Dataset analysis uses `cleanup_required` when every current danger can be resolved by an available deterministic safe correction; `blocked` is reserved for unresolved hard workflow blockers. Severe diagnostics retained on already-excluded measurements remain provenance/review information rather than blockers.

## Actions

Settings → Actions uses one two-pane catalog/inspector layout on desktop and stacks responsively. It shows deterministic, AI-assisted and hybrid Actions, including the Assistant Action. Each definition has one browser-local override and can be reset to the versioned source.

## Simple Design Experiment and live provider output

- Design Experiment is intentionally a POC workbench focused on **solution chemistry** and **device stack** only. Source-backed values are projected when available, but both areas are always directly editable without AI.
- The experiment board is the primary navigator. Each experiment has one simple state: `Ready`, `Needs suggestion`, `Suggested`, `Accepted`, or `Error`; there are no completion percentages or global confidence gauges.
- **Suggest all with AI** processes only experiments that still need solution chemistry and/or stack and do not already have a saved suggestion. Successful suggestions are stored per experiment immediately. The first provider rate-limit pauses the whole run; no subsequent experiment request is sent, and untouched experiments remain pending.
- A genuine per-experiment content/validation failure remains `Error` with a local **Retry** path. Provider throttling does not turn untouched experiments into errors. After a partial run, the board exposes **Continue suggestions** and resumes only missing/error experiments.
- AI suggestions are reviewable previews, not automatic mutations. **Accept experiment** validates one experiment, while **Accept all suggestions** validates all currently saved suggestions. Existing source/researcher values stay protected and accepted values remain directly editable.
- Solution chemistry is shown graphically as solutes + solvents with compact composition metadata. Device stack is shown graphically as ordered material layers from substrate to top contact; both visuals have direct form controls below them.
- Scientific Knowledge Base lookup is optional context for the Action. A lookup miss never blocks Design and is not a separate user workflow.
- Provider output in the global totem updates during meaningful streamed text/reasoning chunks. Live telemetry prioritizes input/output tokens, target/ceiling, TTFT and generation rate; raw SSE event/byte counts stay in diagnostics because they are transport framing, not scientific progress or token usage. Stop cancels active AI work without deleting already stored suggestions.
- Status badges are atomic one-line labels on desktop and truncate instead of wrapping on narrow screens.


## Research Context Pack
Assistant and AI-assist surfaces use a bounded Context Pack selected from the Canonical Store. UI copy should make clear that page, query, selection, relevant Results/findings/evidence and bounded chat memory are selected deterministically; full experiment JSON and RAW JV curves are not default context.

## Report export contract

Report Studio has one textual source: the active Markdown editor. Its command palette supports Markdown plus standard inline `$...$` and display `$$...$$` LaTeX; the rendered preview typesets math locally. MD, LaTeX, DOCX and PDF exports synchronize that editor immediately before generation. `.tex` preserves formulas, while DOCX/PDF embed rendered display equations and readable inline math. Display equations are deliberately scaled below body-width hero graphics: they should read as part of the scientific prose, not dominate an export page. PDF/DOCX may append only the deterministic figures explicitly selected for the active document. Report and Paper keep independent figure selections.

Review Data exposes corrections at the place they are found: deterministic safe fixes can be applied individually or in bulk, valid AI ambiguity proposals can be applied individually or in bulk, and researcher-confirmed sample identity can be entered through the manual correction disclosure.


## 2026-08-13 compact interaction rules

- Results keeps Overview, All data, Best measurements, Anomalies, Top non-REF, Top REF, **JV Analyzer**, Overlay and Compare as explicit views. JV Analyzer is a single-measurement diagnostic workbench (FW/RV summary deltas, RAW point integrity and scan separation); Overlay owns an independent multi-measurement selection and is only for visual comparison.
- Experiment Design uses a compact experiment board plus two direct visual editors: **Solution chemistry** and **Device stack**. AI suggestions appear only when present, stay separate until accepted, and per-experiment errors remain retryable.
- Report and Paper are separate Markdown documents with separate titles. On desktop source and rendered preview are always visible together; Write/Preview switching is a small-screen control only.
- On small screens Action and result totems remain viewport-contained cards with internal scrolling; the Assistant remains a dedicated full-screen surface.


## Provenance

Working Copy patches and Report/Paper edit provenance remain internal metadata available to exports and diagnostics; they do not require a separate workflow page.

## Assistant response surface

Assistant messages use compact instrument-style rows rather than large rounded bubbles. The empty composer stays one line; only researcher input expands it. Browser-owned confirm/alert dialogs are not part of the UI contract: confirmations and short application messages use LabFlow totems. Modal/totem surfaces must always expose an explicit Cancel or Close control as appropriate and support `Esc`. Streaming transport counters (chunk/event/byte counts) are implementation diagnostics and are not shown in chat. Thinking/reasoning, when provided by the model, is shown in a separate disclosure from final answer text. Completed AI responses expose useful telemetry such as model/provider, elapsed time, TTFT when known, input/output/total tokens and generation rate when available. Researcher-triggered Actions also publish a compact Assistant-row result: text Actions publish their textual result, while structured/deterministic Actions publish a concise completion summary. Report/Paper **All** sequences aggregate their section results into one chat message rather than flooding the conversation.


## Long Action progress

The Action Totem uses one monotonic progress bar. Checkpoint and work-unit position establish coarse progress; semantic phases establish reserved bands; streaming events/tokens provide fine movement inside the response band. Sequential Design/Report/Paper helpers must keep a single parent bar rather than resetting for each child Action.

Design exposes compact variant state cards and separate commands for generating missing AI proposals and applying all existing proposals. Report/Paper use a document-scoped figure picker with Apply, Cancel, Close and Escape behavior.
