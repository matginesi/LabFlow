# Visual language

Use `ui-kit.html` as the canonical visual reference: compact scientific workspace, restrained typography, stable spacing, small badges, clear tables, progressive disclosure and responsive layouts.

Tabs use a bordered track, not a faint underline-only treatment. The active tab has a filled surface, stronger border and accent edge. Long tab sets scroll horizontally while labels remain intact.

AI is explicit. The operation totem shows OPERATION checkpoint and work-unit progress, truthful provider telemetry, Stop, finite 5 s / 10 s automatic retry when applicable, and Retry checkpoint only after final failure. Provider output stays collapsed until requested. JSON/Markdown follow the selected LabFlow theme; streaming removes redundant blank lines. Never fabricate model progress or hidden reasoning.

Results emphasize measurements and reliable plots rather than decorative cards. Tables have explicit responsive overflow and readable warning/status columns. Compare uses stable box/whisker/raw-value rendering with a statistics table rather than fragile canvas pan/zoom state. Design emphasizes evidence and provenance. Reports remain readable/editable Markdown. NOMAD separates validation, mapping and package operations clearly.


Structured JSON is a scientific data surface, not a terminal surface. It follows the active theme everywhere; in the fully light theme JSON backgrounds, borders and token colors remain light-theme native. Sidebar navigation uses the same 11 px / 10 px small-type rhythm as the rest of the application rather than micro typography.

## Operations Workshop

Use a compact workshop metaphor: grouped researcher goals at left, detailed selected goal at right, visible Automatic / Action / AI-assist responsibility and finite flow. Operations Workshop contains every executable OPERATION, including `assistant.chat`; implementation services stay hidden. AI Helpers is a filtered Settings view of the same AI-backed OPERATION definitions, never a duplicate prompt store. On narrow screens stack catalog above inspector.

## Compact status and comparison surfaces

Badges/pills are atomic labels: do not wrap them over two lines. On narrow screens prefer truncation, horizontal flow, or moving the label to the next row. Results Compare uses responsive SVG: up to six groups fit the available width; larger sets use fixed readable slots with horizontal scrolling rather than shrinking labels and distributions until unreadable.


Research Context Packs are visualized as bounded evidence/context, not as giant JSON payloads. When context detail is shown, prefer counts, referenced entities/evidence and progressive disclosure.
