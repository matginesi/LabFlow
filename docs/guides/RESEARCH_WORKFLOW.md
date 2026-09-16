---
title: Research workflow
section: Researcher guide
summary: How evidence, review, Results, Design, Cabinet, AI and export fit together.
order: 15
---

# Research workflow

## Upload and evidence

The uploaded ZIP is preserved as source evidence. LabFlow reads it into one canonical scientific aggregate without rewriting RAW files.

## Deterministic processing

Naming, hierarchy recovery, validation, JV analysis, indexing and summaries run locally. When a correction is mechanically safe, LabFlow can detect it automatically but still requires explicit acceptance before changing LabFlow Data.

## Review

Review is reserved for decisions. Semantic uncertainty remains visible as an ambiguity/finding rather than being guessed. `dataset.resolve-ambiguities` can propose a resolution, but the proposal is not applied silently.

## Results

Results come from deterministic analysis. AI interpretation/comparison uses these results as evidence and cannot replace them.

## Design and Cabinet

Design records experiment-specific chemistry, stack and process information. Cabinet stores reusable laboratory definitions. Applying a Cabinet item copies its current value into Design, so later Cabinet edits do not rewrite an experiment.

## Knowledge and Assistant

KB supplies reference knowledge; Assistant answers from bounded current context and may recommend available Actions. Neither is an authority over measurements or accepted Design.

## Export

Export packages current validated LabFlow Data and optional payloads deterministically. NOMAD preparation is local; remote upload is not implemented in the current POC.

## Reviewing AI-completed Design

A useful Design suggestion should be read as a set of sourced candidates, not as one opaque AI answer. Inspect the source nature beside each part:

1. **Experiment evidence** — strongest authority for the current experiment.
2. **Lab Cabinet** — researcher-curated reusable candidate; verify it was actually used.
3. **Knowledge Base** — sourced reference/archetype; useful for reconstruction, never proof of use.
4. **Model inference** — qualitative suggestion without a specific supplied reference.
5. **Unresolved** — explicitly preserved scientific gap.

The displayed confidence is calibrated candidate suitability. It is intentionally lower for generic references/inference and capped for unsupported numeric values. Accept only the parts you can justify; LabFlow keeps unresolved information explicit rather than requiring a fabricated completion.
