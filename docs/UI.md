# UI contract

`ui-kit.html` is the visual ground truth.

The experiment workflow is Upload, Review, Results, Design, Report, Changes, NOMAD. Pages use the shared compact shell, stepper, panels, tables, visible tab tracks and progressive disclosures.

There is one in-memory scientific Working Copy, separate from the byte-for-byte RAW source snapshot. `LF.CanonicalStore` adds aliases/relations/evidence as a deterministic index rather than a second editable data copy. The top bar shows dirty/saved state. All edits operate only on the Working Copy; explicit Save/normal export/NOMAD export create new files from its current revision and never overwrite RAW.

OPERATION buttons use `button[data-operation]`. Successful checkpoints auto-advance. Heavy checkpoints can be split into bounded sequential work units and display checkpoint + unit progress. AI work units can retry at most twice after 5 s and 10 s; after that the totem exposes Retry checkpoint. While running the totem exposes Stop. Provider output is closed by default. Markdown and JSON output are formatted on the active theme surface, not dumped as raw plain text. JSON uses the same theme-aware data surface in totems, Assistant messages, request disclosures and Markdown `json` fences; the fully light theme never falls back to the generic dark code slab.

Review Data exposes deterministic findings/fixes immediately and AI corrections separately as soon as they are ready. Results read canonical measurements/samples directly, never Design. Charts use responsive inline SVG so visibility never depends on a layout-timed redraw; tables have explicit responsive scroll surfaces; Compare remains simple and deterministic.

Assistant chat is inline. Selection, chart interaction, filters, edits, navigation and local validation never invoke AI.


## Sidebar typography

Primary sidebar labels use the shared small UI scale (11 px) and secondary descriptions/section labels use the shared extra-small scale (10 px). The sidebar stays compact, but must not use micro-text for normal navigation. Mobile navigation keeps at least the extra-small scale.

## Review Data actions

Review Data is deterministic-first: **Analyze dataset** automatically refreshes Canonical Store, Results and the compact Analysis Dossier; **Apply safe corrections** performs only provable repairs; **Resolve ambiguities** is enabled only for semantic unknowns on the current revision. AI only proposes; accepted application is a local internal service that mutates the one Working Copy and triggers deterministic refresh.

## Operations Workshop and AI Helpers

Settings → Operations Workshop uses a two-pane catalog/inspector layout on desktop and stacks responsively. It shows every executable OPERATION, including Assistant; internal helper functions that are not OPERATION definitions remain hidden. Settings → AI Helpers is a filtered view of the same runtime catalog containing only OPERATION definitions with AI checkpoints. It is not a second prompt store. Both views edit the same browser-local runtime override for definition and prompt, used by subsequent executions and resettable to source.

## Single-experiment Design and live provider output

- Experiment Design is researcher-first: deterministic sample/device structure and evidence are ready after ZIP import, and manual edits remain available without AI.
- `Infer selected` sends only the currently selected experiment and its unresolved fields. It never reconstructs all experiments in one provider request.
- AI proposal review is secondary progressive disclosure below the working canvas.
- Provider output in the global totem updates during meaningful streamed text/reasoning chunks; there is no separate OPERATION/provider-note block.
- Status badges are atomic one-line labels on desktop and truncate instead of wrapping on narrow screens.


## Research Context Pack
Assistant and AI-assist surfaces use a bounded Context Pack selected from the Canonical Store. UI copy should make clear that page, query, selection, relevant Results/findings/evidence and bounded chat memory are selected deterministically; full experiment JSON and RAW JV curves are not default context.

## Report export contract

Report Studio has one textual source: the active Markdown editor. MD, LaTeX, DOCX and PDF exports synchronize that editor immediately before generation. PDF/DOCX may append only the deterministic figures explicitly selected in **Figures in export**; figure selection never rewrites the editor text.

Review Data exposes corrections at the place they are found: deterministic safe fixes can be applied individually or in bulk, valid AI ambiguity proposals can be applied individually or in bulk, and researcher-confirmed sample identity can be entered through the manual correction disclosure.


## 2026-08-13 compact interaction rules

- Results mirrors the functional flow of `ORIGINAL_REQUEST/jv_analyzer.html`: Overview, All data, Best measurements, Anomalies, Top non-REF, Top REF, JV curves, Overlay and Compare are explicit views rather than hidden modes.
- Experiment Design keeps the selected experiment, optional AI suggestions and three direct editors (Formulation, Fabrication, Device stack) in that order. AI suggestions are visible above the editors when present.
- Report and Paper are separate Markdown documents with separate titles. On desktop source and rendered preview are always visible together; Write/Preview switching is a small-screen control only.
- On small screens operation and result totems remain viewport-contained cards with internal scrolling; the Assistant remains a dedicated full-screen surface.
