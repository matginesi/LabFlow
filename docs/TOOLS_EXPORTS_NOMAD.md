# Tools, exports and NOMAD

## Tools

`editors.html` is the canonical local scientific workbench. A tool keeps visible
context for experiment, stack, file, dataset and measure.

Tool groups cover data mapping/editing, visualisation, conversion, validation,
NOMAD preparation and feasible AI assistance. Labels distinguish ready,
prototype and simulated behaviour.

## Data import

The POC accepts or represents CSV, TSV, Excel, JSON, images, PDF, ZIP,
instrument files, manual tables, single values and series. Data can target the
whole experiment, one or more stacks, an executed action, a measurement or a
result.

The original file and provenance should be retained in a real implementation.

## Export

`report.html` is the canonical Report & Export Center. Supported demonstrations
include CSV, Excel, JSON, JSONL, YAML, SVG, PNG, PDF, ZIP and a complete
experiment archive.

Before generation, show:

- scope and version;
- included stacks, data, results and files;
- excluded or incomplete content;
- validation warnings;
- provenance and manifest.

## NOMAD

NOMAD is the final standard-workflow phase. It must remain separate from normal
export and expose two paths:

1. **Export NOMAD package** — generate and inspect local files.
2. **Send through NOMAD API** — explicit user-confirmed submission.

Readiness checks cover completeness, units, materials, substances, solutions,
stacks, processing, instruments, data, files, identifiers, provenance and
mapping. Issues must be openable, correctable and explainable; AI help remains
reviewable.

API credentials belong to user Settings and must be stored securely by a future
backend. The static POC neither persists nor transmits them.
