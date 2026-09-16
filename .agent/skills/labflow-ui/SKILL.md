# LabFlow UI implementation contract

Use `ui-kit.html`, `docs/UI.md`, shared tokens and existing primitives before adding a page-specific visual pattern. Keep controllers orchestration-only and avoid scientific business logic in DOM code.

## Navigation and scroll contract

Workflow pages place Previous/Next navigation in the **first sticky card** at the top of the main workspace scroller. Route changes reset the main scroller; rerenders inside the same context preserve bounded main/local scroll state. Do not introduce nested full-page scrollers or mobile horizontal tab carousels.

## Assistant and Actions

The Assistant exposes exactly one compact **Actions** launcher. Do not reintroduce a second quick-action strip. Action execution uses the canonical Action Totem; ordinary confirmations/status use the shared Message Totem. Do not build page-local Totem clones.

## Responsive layout

Design against the real workspace width using existing container queries. Prefer compact grids that collapse to one column when appropriate. Shared controls must retain the common input/select/button sizing and typography tokens.

## Data presentation

Keep RAW evidence, LabFlow Data, Workspace/Cabinet reference context, AI proposals and persisted Action output visually distinguishable. A UI affordance must not imply that reusable Workspace/Cabinet context is evidence that an instrument, setup or recipe was used in a particular measurement.

## Established product patterns

Assistant is a local themed surface: its embedded controls inherit Assistant tokens without recoloring the scientific canvas.

For Cabinet reuse, teach the mental model **Save → Reuse → the experiment keeps its own copy**. A later Cabinet edit never rewrites experiment-owned Design.

Knowledge settings present **Built-in library + My JSONL** as one usable Knowledge Base while keeping the source-controlled baseline and browser-local JSONL overlay distinct.
