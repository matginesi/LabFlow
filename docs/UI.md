# UI contract

`ui-kit.html` is the visual ground truth.

The experiment workflow is Upload & Review, Results, Design, Report, Changes, NOMAD. Upload remains mandatory; after import the same first page combines the source receipt with the review workbench. Pages use the shared compact shell, stepper, panels, tables, visible tab tracks and progressive disclosures.

There is one in-memory scientific Working Copy, separate from the byte-for-byte RAW source snapshot. `LF.CanonicalStore` adds aliases/relations/evidence as a deterministic index rather than a second editable data copy. The top bar shows dirty/saved state. Every page load starts a fresh experiment session with no ZIP restored; browser-local provider/API-key/UI preferences remain. All edits operate only on the Working Copy and exports never overwrite RAW.

Action buttons use `button[data-action]`. Successful checkpoints auto-advance. Heavy checkpoints can be split into bounded sequential work units and display checkpoint + unit progress. AI work units can retry at most twice after 5 s and 10 s; after that the totem exposes Retry checkpoint. While running the totem exposes Stop. Provider output is closed by default. Markdown and JSON output are formatted on the active theme surface, not dumped as raw plain text. JSON uses the same theme-aware data surface in totems, Assistant messages, request disclosures and Markdown `json` fences; the fully light theme never falls back to the generic dark code slab.

Review Data exposes deterministic findings/fixes immediately and AI corrections separately as soon as they are ready. Results read canonical measurements/samples directly, never Design. Charts use responsive inline SVG so visibility never depends on a layout-timed redraw; tables have explicit responsive scroll surfaces; Compare remains simple and deterministic.

Assistant chat is inline. Selection, chart interaction, filters, edits, navigation and local validation never invoke AI.


## Sidebar typography

Primary sidebar labels use the shared small UI scale (11 px) and secondary descriptions/section labels use the shared extra-small scale (10 px). The sidebar stays compact, but must not use micro-text for normal navigation. Mobile navigation keeps at least the extra-small scale.

## Upload & Review actions

Upload & Review is deterministic-first after the mandatory ZIP import: **Analyze dataset** automatically refreshes Canonical Store, Results and the compact Analysis Dossier; **Apply safe corrections** performs only provable repairs; **Resolve ambiguities** is enabled only for semantic unknowns on the current revision. AI only proposes; accepted application is a local internal service that mutates the one Working Copy and triggers deterministic refresh.

## Actions

Settings → Actions uses one two-pane catalog/inspector layout on desktop and stacks responsively. It shows deterministic, AI-assisted and hybrid Actions, including the Assistant Action. Each definition has one browser-local override and can be reset to the versioned source.

## Single-experiment Design and live provider output

- Experiment Design is researcher-first and source-first: explicit RAW fabrication notes are projected into formulations, process and stack before AI; manual edits remain available without a provider and survive normal re-rendering.
- The status overview must show source coverage and distinguish `Source design found` from `No recipe in source`; measurement-only archives still show their sample/group structure instead of an empty Design.
- `Complete missing with AI` sends only the currently selected experiment and its exact unresolved fields. It is disabled when the required source-backed Design is already complete.
- A compact variant coverage board is the primary Design navigator: green = complete, amber = complete but AI-assisted, AI accent = proposal awaiting review, warning = missing required fields. `Complete all missing with AI` processes only incomplete variants without an existing proposal, strictly one at a time, and retains one reviewable proposal per variant.
- AI proposal review is secondary progressive disclosure above the editable working tables.
- Provider output in the global totem updates during meaningful streamed text/reasoning chunks; there is no separate Action/provider-note block.
- Status badges are atomic one-line labels on desktop and truncate instead of wrapping on narrow screens.


## Research Context Pack
Assistant and AI-assist surfaces use a bounded Context Pack selected from the Canonical Store. UI copy should make clear that page, query, selection, relevant Results/findings/evidence and bounded chat memory are selected deterministically; full experiment JSON and RAW JV curves are not default context.

## Report export contract

Report Studio has one textual source: the active Markdown editor. Its command palette supports Markdown plus standard inline `$...$` and display `$$...$$` LaTeX; the rendered preview typesets math locally. MD, LaTeX, DOCX and PDF exports synchronize that editor immediately before generation. `.tex` preserves formulas, while DOCX/PDF embed rendered display equations and readable inline math. PDF/DOCX may append only the deterministic figures explicitly selected for the active document. Report and Paper keep independent figure selections.

Review Data exposes corrections at the place they are found: deterministic safe fixes can be applied individually or in bulk, valid AI ambiguity proposals can be applied individually or in bulk, and researcher-confirmed sample identity can be entered through the manual correction disclosure.


## 2026-08-13 compact interaction rules

- Results keeps Overview, All data, Best measurements, Anomalies, Top non-REF, Top REF, **JV Analyzer**, Overlay and Compare as explicit views. JV Analyzer is a single-measurement diagnostic workbench (FW/RV summary deltas, RAW point integrity and scan separation); Overlay owns an independent multi-measurement selection and is only for visual comparison.
- Experiment Design keeps a compact variant coverage board, source-coverage status, optional AI suggestions and three direct editors (Formulation, Fabrication, Device stack) in that order. RAW evidence and missing-source state are explicit; AI suggestions are visible above the editors only when relevant.
- Report and Paper are separate Markdown documents with separate titles. On desktop source and rendered preview are always visible together; Write/Preview switching is a small-screen control only.
- On small screens Action and result totems remain viewport-contained cards with internal scrolling; the Assistant remains a dedicated full-screen surface.


## Changes audit

Changes compares the current Working Copy to a baseline captured immediately after ZIP import. Data, Design, analysis settings and Report/Paper are separate sections with bounded internal scroll areas. Report/Paper text diffs show baseline/current word counts and preserve edit provenance so manual researcher edits and AI writing edits are visibly distinct. The page must never depend on a blur/focusout event to notice editor text.

## Assistant response surface

Assistant messages use compact instrument-style rows rather than large rounded bubbles. The empty composer stays one line; only researcher input expands it. Browser-owned confirm/alert dialogs are not part of the UI contract: confirmations and short application messages use LabFlow totems. Streaming transport counters (chunk/event/byte counts) are implementation diagnostics and are not shown in chat. Thinking/reasoning, when provided by the model, is shown in a separate disclosure from final answer text. Completed AI responses expose useful telemetry such as model/provider, elapsed time, TTFT when known, input/output/total tokens and generation rate when available. Researcher-triggered Actions also publish a compact Assistant-row result: text Actions publish their textual result, while structured/deterministic Actions publish a concise completion summary. Report/Paper **All** sequences aggregate their section results into one chat message rather than flooding the conversation.
