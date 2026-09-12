---
title: Scientific Knowledge Base
section: User guides
summary: Sourced scientific reference knowledge stored as portable JSONL, without a separate database service.
order: 32
---
# Scientific Knowledge Base

LabFlow's Knowledge Base (KB) provides sourced scientific background to the Assistant and Design inference without adding a backend, vector database, embeddings service or a second scientific data model.

The researcher-facing model is intentionally simple:

- **Built-in library** — curated, read-only scientific references shipped with LabFlow.
- **My JSONL library** — references added or imported by the researcher and stored as plain JSON Lines.

## Bundled scientific library

The default distribution contains a curated starter corpus focused on perovskite photovoltaics and JV interpretation. It covers device architectures, materials and precursor chemistry, formulations, process families, photovoltaic measurements, stability concepts and common diagnostic patterns.

The bundled corpus avoids presenting recipe-specific spin speeds, concentrations, annealing temperatures, layer thicknesses or treatment times as universal recommendations. Such values depend on chemistry, substrate, equipment and literature protocol. Entries emphasize reusable relationships and cautions with traceable literature sources.

## What belongs in the KB

Use it for reusable reference knowledge such as:

- materials and their qualitative roles;
- device architectures and layer-order conventions;
- formulation and solvent families;
- fabrication and measurement process families;
- diagnostic relationships;
- scientific concepts, terminology and cautions.

Do **not** use the KB to record what a particular experiment actually used or measured. Those facts belong to ExperimentData/source evidence or, for reusable laboratory resources, the Lab Cabinet.

## My JSONL library

Custom entries are persisted as JSON Lines (JSONL) under the LabFlow browser origin: **one complete knowledge reference per line**. There is no database server and no outer JSON wrapper.

Settings → Knowledge Base exposes the file workflow directly:

- **Open JSONL** validates the complete file before merging it into the editable library;
- **Save my JSONL** uses the browser's native save-file dialog when available and otherwise downloads the same JSONL;
- **Download full library** exports built-in and custom records together for inspection or archival use.

Import is fail-closed: malformed JSON reports the exact failing line, duplicate IDs in one file are rejected, input size and entry count are bounded, and built-in IDs are ignored instead of being silently duplicated into the custom library.

The source-controlled `knowledge/kb.jsonl` uses exactly the same one-object-per-line format and is compiled to `assets/js/knowledge/kb-bundle.js` so LabFlow also works without a runtime fetch. A selected set of canonical user guides under `docs/guides/` is projected into read-only `guide.*` records during the build.

### JSONL example

```json
{"id":"material.sno2","kind":"material","title":"SnO2","status":"active","summary":"…","sources":[{"title":"…","doi":"10.…"}]}
```

## Safe activation

Entries may be saved as **Draft** without a source. Drafts are never sent to AI.

A **Ready** entry requires:

- a title;
- a summary or at least one fact;
- at least one source with a title and a traceable citation, DOI or `http(s)` URL.

URLs are normalized to `http(s)` only. Text lengths, file size and collection sizes are bounded before persistence and before AI context construction.

## Provenance boundary

The priority is:

1. current ExperimentData / source evidence;
2. researcher-confirmed Design;
3. compatible Lab Cabinet resources;
4. sourced KB reference knowledge;
5. general model inference.

A KB entry never proves that the current experiment used a material, process or architecture. `design.infer` marks KB-supported proposals as reference knowledge; they remain review-only until the researcher explicitly accepts them.

## Assistant citations

When the Assistant uses a KB entry, its prompt requires an exact marker such as:

```text
[KB:material.sno2]
```

LabFlow resolves only IDs that actually exist in the current KB and renders the stored source metadata beneath the answer. Unknown or invented markers do not resolve to source cards.

## Retrieval

Retrieval is deterministic lexical ranking over title, aliases, tags, summary, facts and cautions. Only validated Ready entries are eligible. The context builder sends a small bounded set of relevant entries to AI; the full KB is never injected into every request.

## Adding source-controlled entries

Edit `knowledge/kb.jsonl`, keep stable IDs, then run:

```bash
python tools/build_knowledge_bundle.py
```

For ordinary researcher-managed references, use the Settings page and My JSONL instead.
