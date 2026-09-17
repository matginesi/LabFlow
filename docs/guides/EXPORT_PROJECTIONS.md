# Export: NOMAD-first workflow and on-demand projections

LabFlow 0.0.31 keeps **NOMAD staging/export as the primary Export-page workflow** and makes missing metadata priorities explicit before the detailed projections. NOMAD and Ready-PV remain projections of the same canonical LabFlow data, but their detailed fields are now secondary inspection tools and stay collapsed until the researcher opens them.

`export.prepare` retrieves support deterministically from the missing field IDs. Contact fields receive relevant Workspace contacts; measurement-description fields may receive the bound Process and targeted wording references; instrument/software/format fields may receive matching Process/Cabinet resources. It never receives the generic Experiment Brief, efficiency rankings, result comparisons, anomalies or curves.

```mermaid
flowchart TD
    C[Canonical LabFlow data] --> V[NOMAD local validation]
    V --> P[Prepare metadata Action optional]
    P --> O[Review export-only overrides]
    O --> N[NOMAD staging package / entry YAML]
    C --> D[On-demand data views]
    D --> ND[NOMAD projection]
    D --> RP[Ready-PV profile]
```

## Page hierarchy

The first screen answers three questions:

1. Is the current experiment ready to stage for NOMAD?
2. What blocks or warns the export?
3. What is the next concrete action?

Detailed NOMAD and Ready-PV values are inside closed disclosure panels. Section-level data is also collapsed. This avoids turning Export into a wall of metadata while preserving full inspectability and optional editing.

## Source-of-truth rule

ExperimentData, Workspace, Process and Lab Cabinet remain authoritative. Export views are deterministic projections. Manual edits and accepted AI metadata suggestions create **export-only overrides** and do not rewrite canonical scientific state.

## `export.prepare` Action

`export.prepare` (`/prepare-export`) is a review-only metadata preparation Action. It is available when required or recommended projection fields are missing.

The Action receives a bounded Export context containing:

- current NOMAD validation/mapping state;
- only the currently missing projection fields that may be suggested;
- Workspace and Process context;
- bounded Cabinet resources;
- bounded Knowledge Base references;
- current persisted Action outputs.

The model may suggest only field ids explicitly listed in `allowed_fields`. The runtime validator drops suggestions for populated or unknown fields and calibrates confidence by source nature. Unsupported metadata remains unresolved rather than invented.

Accepted Action output is applied only through the explicit **Apply export overrides** control.

## Source nature and confidence

Each suggestion declares its strongest basis:

- `experiment`;
- `workspace`;
- `process`;
- `cabinet_reference`;
- `knowledge_reference`;
- `model_inference`.

Confidence is the reliability of the proposed export representation given the supplied context. It is not proof that an unobserved scientific fact is true. Runtime source caps prevent model-declared confidence from overstating weak provenance.

## NOMAD projection

The NOMAD data view remains experiment scoped and combines ExperimentData with Workspace/Process context. It can be opened to inspect grouped fields, mapping details and machine-readable JSON/YAML. Local NOMAD validation remains authoritative for blockers.

## Ready-PV projection

Ready-PV remains secondary to NOMAD on this page and follows the questionnaire structure: contacts, quantities, samples/setup, instruments/formats, storage, metadata/linkage and remarks. It preferentially uses Workspace/Process/Cabinet definitions, with deterministic experiment fallbacks where appropriate.

## Readiness

Readiness is a deterministic completeness score over required/recommended fields. It is not an AI confidence score and must not be interpreted as probability that scientific claims are correct.

Validation labels issues as **blocking**, **required**, **recommended**, or **optional**. Blocking means a package cannot be constructed safely (for example, there are no exportable measurements). Missing required/recommended metadata opens the existing confirmation Totem with **Cancel**, **Prepare metadata**, and **Export anyway**. Continuing records the known validation result in the package manifest and logs; it never fills canonical data or invents metadata.

## Assistant behavior

On Export, the Assistant prioritizes NOMAD blockers and the smallest useful next step. When `export.prepare` is available, it may recommend `/prepare-export`. It should not dump the entire projection or fabricate metadata to improve readiness.

## Direct upload

Local NOMAD staging/export is implemented. Direct browser upload remains a separate connector boundary and is still explicitly marked as not implemented. No token or data is sent by the upload stub.


## Metadata needed

The Export page keeps a compact always-visible **Metadata needed** card above the detailed projections. Missing NOMAD required fields are highlighted first; NOMAD recommended and Ready-PV required/recommended fields remain visible as counts and in an expandable list. The primary **Prepare missing metadata with AI** button executes `export.prepare` directly. The detailed NOMAD and Ready-PV field views remain collapsed until inspection or editing is needed.

`export.prepare` treats unresolved metadata as a valid outcome. Unresolved items may include provenance metadata (`source_kind`, `confidence`, `evidence`) in addition to `projection`, `field_id`, and `reason`; LabFlow validates and calibrates those values before storing the proposal.

### Robust structured-output boundary

`export.prepare` uses this order: JSON extraction → deterministic transport/shape normalization → strict JSON Schema validation → semantic allowed-field/current-missing validation → proposal storage. Harmless small-model variants such as `value: null` inside `unresolved`, `fieldId`, `sourceKind`, projection casing, and percentage confidence strings are normalized before validation. A non-null unresolved `value` remains invalid instead of being converted into a suggestion. Only failures that remain after deterministic normalization may consume the single bounded retry, with the exact validation error and a minimal previous-output excerpt.

## Correcting missing or wrong mapped metadata

`Metadata needed` and `Mapping details` expose two distinct remediation paths:

- **Fix source** opens the canonical LabFlow location that owns the value, such as Workspace/Process, Cabinet, or source-data review. Use this when the underlying LabFlow metadata is genuinely missing or wrong.
- **Override export** opens the exact projection field in edit mode. Use this when the source data is intentionally left unchanged and only the NOMAD/Ready-PV representation needs a local export correction.

Mapping details exposes these controls for already-mapped fields as well as missing ones, so an incorrect mapping can be corrected without first deleting the value. Export overrides never rewrite RAW, ExperimentData, Workspace, Process or Cabinet.
