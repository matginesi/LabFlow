---
title: Research workflow
section: Researcher guide
summary: How evidence, review, deterministic Results, Design references and export fit together.
order: 20
---

# Research workflow

LabFlow keeps evidence handling separate from optional semantic assistance.

## 1. Upload and review

Import a supported archive. LabFlow parses files, builds canonical experiment/sample/run/measurement relationships, validates them, calculates deterministic analysis and raises findings. Review ambiguities before making strong comparisons.

## 2. Results

Results are calculated from canonical experiment data. Use the overview, data explorer, JV views and group comparison to inspect performance and quality. The deterministic diagnostics add ranking coverage, FW/RV agreement, reproducibility statistics and descriptive correlations.

`Interpret results` and `Compare groups` are Actions for consistent workflow/provenance, but they use deterministic code and no provider.

## 3. Design

Use existing experiment evidence first. LabFlow then searches compatible Cabinet and Knowledge Base references for missing Design domains. Only unresolved residue may be sent to a configured provider. Suggestions remain reviewable and source-labelled.

## 4. Cabinet and Knowledge

Save reusable laboratory resources in Cabinet. Add focused scientific reference entries to My JSONL when needed. Cabinet describes what your lab defines/reuses; the Knowledge Base describes external/reference knowledge. Neither is RAW measurement evidence.

## 5. Export

Review NOMAD readiness and remaining metadata. `Prepare missing metadata` reuses conservative existing LabFlow values where an equivalent field is known; it does not ask a model to invent metadata. Manual overrides remain export-only.

## 6. Assistant

Use the Assistant for questions across the current experiment. Explicit commands are zero-token local operations. Natural-language questions use a tiny language-agnostic router; factual routes are answered from LabFlow state, while interpretive routes may make one additional bounded provider request with targeted reference knowledge.
