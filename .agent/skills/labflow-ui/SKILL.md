# LabFlow UI contract

Keep LabFlow compact, scientific, and readable. The application canvas stays light; dark styling is local to the Assistant and other intentional chrome. Prefer shared density tokens over page-specific spacing rules.

## Assistant

Assistant is a local themed surface. Components embedded in it must use the Assistant palette and tokens rather than leaking the scientific canvas palette into menus, badges, notices, progress feedback, or Action results.

The Assistant is optional. Deterministic answers should be preferred when the current experiment already contains the answer; provider-backed work is reserved for residual semantic questions. The visible Action catalog is authoritative. Do not invent hidden Actions or imply that an Action ran when it did not.

## Activity Totem

The normal view must be useful at a glance: Overall progress first, then only genuinely useful secondary progress, elapsed time, speed, generated tokens, and tok/s. Keep request payloads, response payloads, token-budget details, TTFT, diagnostics, checklist, and event history inside **Technical data**. Do not expose implementation noise in the primary view.

## Cabinet

Cabinet follows this mental model: **Save → Reuse → the experiment keeps its own copy**. A saved reusable resource is not live-linked into past experiments. The Cabinet should remain one responsive shelf plus one focused editor, with restrained kind accents instead of multiple competing navigation systems.

## Knowledge

Knowledge uses **Built-in library + My JSONL**. The full local record remains traceable, but context views are task-specific:

- Design receives compact source-free reference hints: ids, aliases, tags, and structured design hints. Do not send bibliography, DOI, URL, or citation text to Design inference.
- Assistant may receive compact source-bearing entries and cites them as `[KB:<id>]` when used.

JSONL entries should stay small, structured, deduplicated, and easy to validate. Prefer several focused facts over long prose.

## Results

Results calculations belong to deterministic code. Ranking eligibility, paired FW/RV diagnostics, reproducibility statistics, correlations, comparisons, and interpretation summaries should not require a provider when the underlying data are already available. Label descriptive statistics as descriptive; do not imply causality or statistical significance unless it was actually computed.

## Forms and density

Use existing tokens, controls, table patterns, notices, badges, and panel primitives before inventing a new component. Keep native scientific forms legible and light. Avoid oversized cards, decorative repetition, and page-local CSS that duplicates a shared primitive.

## Actions launcher

Assistant exposes exactly one compact **Actions** launcher. Do not add an always-visible duplicate quick-action strip or a second Action palette on the same surface.

## Navigation and scroll contract

Workflow Previous/Next navigation is the first workflow card and stays sticky at the top of the main scroller. Route changes start at the top; same-context rerenders preserve the main workspace position and bounded local scroll regions preserve their own position. Avoid document-level horizontal scrolling as navigation.
