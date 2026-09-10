---
title: Scientific Knowledge Base
section: User guides
summary: Manage sourced reference knowledge used by the Assistant and Design inference without turning it into experiment evidence.
order: 32
---

# Scientific Knowledge Base

LabFlow has a deliberately small reference Knowledge Base (KB). It provides sourced scientific background to `assistant.chat` and `design.infer` without adding a backend, vector database, embeddings or a second scientific data model.

## Bundled starter corpus

The default distribution ships with a curated starter corpus focused on perovskite photovoltaics and JV interpretation. It covers materials and selective contacts, n-i-p / p-i-n architectures, formulation and process families, photovoltaic concepts, and common diagnostic patterns.

The bundled corpus intentionally avoids presenting recipe-specific spin speeds, concentrations, annealing temperatures, layer thicknesses or treatment times as universal recommendations. Such values depend strongly on material system, precursor chemistry, substrate, equipment and literature protocol. Entries therefore emphasize reusable relationships, qualitative constraints and cautions, with traceable literature sources.

## What belongs in the KB

Use it for reusable reference knowledge such as:

- materials and their qualitative roles;
- device architectures and layer-order conventions;
- formulation families and qualitative chemistry;
- fabrication process families;
- diagnostic relationships (for example plausible causes of a low fill factor);
- scientific concepts, terminology and cautions.

Do **not** use the KB to record what a particular experiment actually used or measured. Those facts belong to ExperimentData/source evidence or, for reusable laboratory resources, the Lab Cabinet.

## Provenance boundary

The priority is:

1. current ExperimentData / source evidence;
2. researcher-confirmed Design;
3. compatible Lab Cabinet resources;
4. sourced KB reference knowledge;
5. general model inference.

A KB entry never proves that the current experiment used a material, process or architecture. `design.infer` marks KB-supported proposals as `knowledge_reference`; they remain review-only until the researcher explicitly accepts them.

## Persistence

Custom KB entries are stored directly as JSON Lines (JSONL) in browser `localStorage` under the LabFlow origin: one normalized knowledge entry per line. They survive reloads and normal workspace resets, but clearing browser site data removes them. Use **Settings → Knowledge Base → Export custom JSONL** for backup/transfer.

The source-controlled `knowledge/kb.jsonl` also uses one knowledge object per line and is compiled to `assets/js/knowledge/kb-bundle.js` so LabFlow continues to work when opened directly from `file://`. During that build, a small allowlist of canonical user guides under `docs/guides/` is projected into read-only `guide.*` entries. Markdown remains the source of truth: rebuilding refreshes those entries, so app-help answers and their citations stay connected to the Documentation route. Bundled entries are read-only at runtime; copy one to create an editable custom entry.

### JSONL format

The baseline file, browser-local custom store and Settings backup all use the same record shape: **one complete knowledge entry per line**. There is no outer `entries` array or metadata wrapper. Blank lines are ignored; malformed lines fail with their line number instead of partially importing ambiguous data.

```json
{"id":"material.sno2","kind":"material","title":"SnO2","status":"active","summary":"…","sources":[{"title":"…","doi":"10.…"}]}
```

`localStorage` contains custom entries only; bundled records continue to come from the source-controlled JSONL/bundle. The current contract is JSONL only: wrapper objects and alternate schema versions are rejected instead of migrated implicitly.

## Safe activation

Entries may be saved as `draft` without a source. Drafts are never sent to AI.

An `active` entry must have:

- a title;
- a summary or at least one fact;
- at least one source with a title and a traceable citation, DOI or `http(s)` URL.

URLs are normalized to `http(s)` only. Text lengths and collection sizes are bounded before persistence and before AI context construction.

## Assistant citations

When the Assistant uses a KB entry, its prompt requires an exact marker such as:

```text
[KB:material.sno2]
```

LabFlow resolves only IDs that actually exist in the current KB and renders the stored source metadata beneath the answer. Unknown or invented markers do not resolve to source cards.

## Retrieval

Retrieval is deterministic lexical ranking over title, aliases, tags, summary, facts and cautions. Only validated active entries are eligible. The context builder sends a small bounded set of relevant entries to AI; the full KB is never injected into every request.

## Adding source-controlled entries

Edit `knowledge/kb.jsonl`, keep stable IDs, then run:

```bash
python tools/build_knowledge_bundle.py
```

For ordinary researcher-managed entries, use the Settings page instead.
