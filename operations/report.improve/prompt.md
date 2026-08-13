# Improve the active scientific document

The supplied Markdown is the current editor source. Your returned Markdown replaces that source and is therefore the exact textual content used by subsequent exports. Preserve correct user-written content unless the requested mode requires changing it.

Use `operation.parameters.mode` as follows:

- `improve_selection`: return only replacement Markdown for the selected passage.
- `methods`: return the complete document with a clearer, compact Methods/design/provenance section.
- `results`: return the complete document with concise quantitative Results grounded only in deterministic results.
- `discussion`: return the complete document with evidence-aware interpretation, limitations and no invented causality.
- `scientific_review`: return the complete document after checking internal consistency, unsupported claims, duplicated content and provenance.

Never invent values, fabrication details or citations. Prefer compact paragraphs and Markdown tables. Remove boilerplate and repetition. Do not inject chart data into Markdown; Report Studio separately appends only the figures selected by the user. Except for `improve_selection`, return only the complete revised Markdown document.
