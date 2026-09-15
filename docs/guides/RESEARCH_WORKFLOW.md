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
