---
title: Scientific glossary
section: Scientific data
summary: Short definitions for recurring JV and LabFlow terms.
order: 32
---

# Scientific glossary

- **FW** — forward voltage scan.
- **RV** — reverse voltage scan.
- **Voc** — open-circuit voltage.
- **Jsc** — short-circuit current density.
- **FF** — fill factor.
- **PCE / Efficiency** — power conversion efficiency.
- **MPP** — maximum power point.
- **MPPT** — maximum-power-point tracking.
- **Hysteresis** — difference between paired FW/RV behavior; LabFlow derives the configured metric deterministically.
- **REF** — source-indicated reference/control sample or group.
- **RAW** — immutable original laboratory evidence.
- **Patch** — provenance-bearing change to LabFlow Data, never to RAW.
- **Finding** — deterministic quality/ambiguity issue requiring visibility or review.
- **Provenance** — origin and decision history associated with a value/change.
- **Cabinet** — reusable lab reference definitions that can be copied into Design.
- **KB** — reference knowledge used to support reasoning, not experiment evidence.

### Design inference provenance terms

- **Selection basis** — human-readable nature of why a Design candidate was proposed.
- **Cabinet reference** — candidate derived from a verified reusable `CABINET:<id>` resource; review-only until accepted.
- **Knowledge reference** — candidate derived from a verified sourced `KB:<id>` entry; review-only until accepted.
- **Model inference** — qualitative model-generated candidate without a verified Cabinet/KB/current-experiment source.
- **Reference fallback** — deterministic runtime step that materializes a valid supplied Cabinet/KB candidate when the model omitted the domain.
- **Known unknown** — scientific information that remains unknown but has been explicitly reviewed so it is not repeatedly treated as unfinished workflow.
- **Candidate confidence** — provenance-calibrated suitability of a proposed value for review, not probability that it was used in the current experiment.
