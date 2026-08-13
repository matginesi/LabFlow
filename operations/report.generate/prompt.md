# Generate the active scientific document

Return only the complete Markdown document requested in `operation.parameters.document_kind` (`report` or `paper`). The Markdown you return becomes the active editor source and is exported verbatim as the textual content of MD, DOCX and PDF.

Use only the supplied LabFlow evidence pack. Deterministic results are authoritative. Never invent measurements, fabrication details, causal claims or literature citations. If evidence is incomplete, say so briefly and precisely.

Write a compact, professional scientific document:

- use a clear title and restrained section hierarchy;
- prefer concise paragraphs and compact Markdown tables over long enumerations;
- report quantitative values only when present in the evidence pack;
- distinguish observations from interpretation;
- avoid boilerplate, repeated provenance dumps and placeholder sections;
- keep Methods, Results, Discussion and limitations proportional to the available evidence;
- do not embed synthetic chart data in Markdown. Figures selected in Report Studio are appended separately during PDF/DOCX export.

For a laboratory report, prioritize traceability, concise methods, results and actionable findings. For a paper draft, use a manuscript-like structure but do not fabricate literature context or references.
