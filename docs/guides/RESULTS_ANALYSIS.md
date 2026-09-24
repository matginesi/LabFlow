---
title: Results analysis
section: Researcher guide
summary: Deterministic ranking, quality, reproducibility and descriptive statistics shown in Results.
order: 35
---

# Results analysis

Results is deterministic. Provider configuration does not affect numerical values, ranking or calculated diagnostics.

## Core metrics

LabFlow calculates the supported JV metrics from imported/canonical measurements and keeps FW/RV scans distinct. Ranking uses the existing eligibility rules and excludes records that do not satisfy them without hiding those records from review.

## Deterministic diagnostics

The Results overview may show:

- active and ranking-eligible measurement counts/coverage;
- valid, review and blocked quality counts;
- paired FW/RV measurement count;
- median absolute FW/RV PCE separation;
- hysteresis-related summaries;
- per-group sample size, mean/median, IQR, CV and observed range;
- descriptive Pearson relationships between PCE and Voc/Jsc/FF/absolute hysteresis when enough finite data exist.

## Interpretation limits

These diagnostics are descriptive. Pearson `r` does not establish causality, and LabFlow does not claim statistical significance unless a dedicated statistical test is explicitly implemented and shown.

Small groups and incomplete FW/RV pairs should be treated cautiously. Findings and blocked records remain part of the scientific review context.

## Actions

`results.interpret` creates a concise deterministic annotation from already calculated Results. `results.compare` creates a deterministic description of the currently selected groups/metric/scan direction. Both use zero provider calls and can be safely rerun after the underlying data change.

## Assistant

Explicit Assistant commands can read common Results facts with zero provider calls. Natural-language questions first use the tiny language-agnostic intent router; factual routes are then answered from calculated Results without an answer-generation call. Interpretive routes receive one bounded answer request using calculated Results as evidence rather than recalculating them in model output.
