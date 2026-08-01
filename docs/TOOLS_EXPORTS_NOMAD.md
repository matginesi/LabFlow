# Tools, exports and NOMAD

## Tools

`editors.html` is the generic local scientific workbench. A Project-specific
tool must keep the active Project, stack, file, dataset and measure visible;
otherwise it is presented as a generic reusable capability.

Tool groups cover data mapping/editing, visualisation, conversion, validation,
NOMAD preparation and feasible AI assistance. Labels distinguish ready,
prototype and simulated behaviour.

## Data import

The POC accepts multiple local files and recognises CSV, TSV, TXT, DAT, ASC,
JSON, JSONL/NDJSON, XML, YAML, XLS/XLSX/ODS, Parquet, HDF5, NetCDF/CDF,
JCAMP-DX, SPC/SPE, XY, XRDML/RAW, PDF, ZIP/TAR/GZ and common images. Manual
tables, single values and series are also supported. Data can target the whole
Project, a stack/sample, an executed action, a measurement or a result.

Delimited text and JSON-family data can be previewed directly. Other structured,
scientific-array, archive, document and binary formats may be recognised and
mapped while their parser remains simulated. Format labels must never imply
parsing that the browser code does not perform.

Files are read locally and are never uploaded. The POC keeps temporary parsed
rows or descriptive metadata; a real implementation must retain immutable
originals, hashes, parser version, transformations and review decisions.

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

API credentials belong to personal Settings and must be stored securely by a
future backend. The static POC neither persists nor transmits them; the
connection check and send action are simulations.
