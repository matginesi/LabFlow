# Visual language

Use `ui-kit.html` as the canonical visual reference: compact scientific workspace, restrained typography, stable spacing, small badges, clear tables, progressive disclosure and responsive layouts.

Documentation uses the same scientific workbench grammar: compact topic catalog, readable Markdown document, optional page outline and explicit source provenance. Mermaid diagrams clarify workflows and ownership relationships; they remain bounded, horizontally scrollable on small screens, and expose their Markdown source through progressive disclosure.

Tabs use a bordered track, not a faint underline-only treatment. The active tab has a filled surface, stronger border and accent edge. Long tab sets scroll horizontally while labels remain intact.

AI is explicit. The Action totem shows Action checkpoint and work-unit progress, truthful provider telemetry, an explicit Cancel action button while running, a separate Close button when terminal, bounded automatic retry only when declared by the Action, and Retry checkpoint only after final failure. Esc follows the same lifecycle: cancel while running, close when terminal. Provider output stays collapsed until requested. JSON/Markdown follow the selected LabFlow theme; streaming removes redundant blank lines. Never fabricate model progress or hidden reasoning.

On phones, Totem commands never become a horizontally scrolling strip. The running command spans the available width; terminal commands use two equal columns, while the primary retry command occupies its own full-width row. Very narrow screens stack all commands. Touch targets remain at least 36 px high.

Results emphasize measurements and reliable plots rather than decorative cards. Tables have explicit responsive overflow and readable warning/status columns. Compare uses stable box/whisker/raw-value rendering with a statistics table rather than fragile canvas pan/zoom state. Design emphasizes a simple visual scientific model: solution chemistry as solute/solvent chips and device stack as ordered material layers; provenance stays secondary. Reports remain readable/editable Markdown. NOMAD separates validation, mapping and package Actions clearly.


Structured JSON is a scientific data surface, not a terminal surface. It follows the active theme everywhere; in the fully light theme JSON backgrounds, borders and token colors remain light-theme native. Sidebar navigation uses the same 11 px / 10 px small-type rhythm as the rest of the application rather than micro typography.

## Actions

Use a compact workshop metaphor: grouped researcher goals at left, detailed selected goal at right, visible Automatic / Action / AI-assist responsibility and finite flow. Actions contains every executable Action, including `assistant.chat`; implementation services stay hidden. It is the single Settings catalog for deterministic, hybrid and AI-backed definitions, never a duplicate prompt store. On narrow screens stack catalog above inspector.

## Compact status and comparison surfaces

Badges/pills are atomic labels: do not wrap them over two lines. On narrow screens prefer truncation, horizontal flow, or moving the label to the next row. Results Compare uses responsive SVG: up to six groups fit the available width; larger sets use fixed readable slots with horizontal scrolling rather than shrinking labels and distributions until unreadable.


Research Context Packs are visualized as bounded evidence/context, not as giant JSON payloads. Display mathematics is compact and proportional to body text; formulas must never become poster-sized blocks in Report/Paper preview or exports. When context detail is shown, prefer counts, referenced entities/evidence and progressive disclosure.

## Upload & Review

Upload and Review are one first-step workbench. Before a ZIP exists, the page is an upload gate; after import, the same page keeps a compact source receipt above the review controls. Do not add a second Review workflow step. The source receipt is collapsible and the original ZIP remains the immutable entry point.

## Report, Paper and figures

Laboratory Report and Paper are separate document surfaces. Figure inclusion is selected independently for each document and the preview/export must reflect the active document's selection exactly. Keep figure controls compact and adjacent to the editor/preview workflow rather than hiding them in global settings.

## Provenance

Provenance remains internal to the Working Copy and export/audit data; it is not a standalone workflow page. Manual writing and AI writing remain distinguishable, and editing a document becomes visible to the Assistant/context immediately without requiring blur, save or an AI Action.

## Assistant response surface

Assistant messages use flat, compact scientific-workspace rows with modest radii rather than oversized chat bubbles. Do not expose transport bookkeeping such as chunk/event/byte counters during streaming. Show only meaningful state (waiting, thinking, writing), keep model reasoning in a separate bounded disclosure, and attach useful response telemetry such as provider/model, full-turn request count, latency, time-to-first-token, aggregate token counts, throughput and finish reason when the provider supplies it. A compact response-details disclosure exposes read Tools, payload totals, request ID and log correlation without crowding the answer. Missing telemetry is omitted rather than invented.
