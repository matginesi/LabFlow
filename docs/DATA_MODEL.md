# Minimal data model

LabFlow deliberately keeps the POC data model small. It must be easy to understand in the UI today and straightforward to map to a real backend, NOMAD and future AI later.

## 1. Core ownership and workflow

### User

Represents the researcher using LabFlow.

Minimum fields:

- `id`
- `name`
- `role`
- `preferences`

### Workspace

The user's working space. It owns Projects and shared reusable resources.

Minimum fields:

- `id`
- `user_id`
- `name`

### Project

The primary unit of scientific work.

Minimum fields:

- `id`
- `workspace_id`
- `name`
- `description` or objective
- `status`
- `pipeline_id`
- `current_step`
- timestamps

A Project owns its structured Project Data.

### Pipeline

A workflow definition loaded from YAML.

Minimum fields:

- `id`
- `name`
- `version`
- `description`
- ordered `steps`

### PipelineStep

One focused unit of work inside a Pipeline.

Minimum fields:

- `id`
- `title`
- `description`
- `inputs`
- `outputs`
- HTML/CSS/JS asset paths

### ProjectData

A conceptual container for all structured data created while working on a Project. The POC stores it in session state; a backend may later normalise it into database tables without changing the user model.

## 2. CHOSE chemistry and structure

### Material

Reusable scientific material identity or functional layer material.

### Solvent

A material used as a solvent, with identity and optional grade/supplier metadata.

### Solute

A precursor, additive or dissolved material with quantity/unit metadata.

### Solution

A reusable or Project-specific composition containing solvents, solutes and preparation information.

Useful fields:

- `id`, `name`
- concentration
- total volume and unit
- `solvents[]`
- `solutes[]`
- preparation
- handling/before-use
- storage
- provenance/origin

### Stack

An ordered material/layer structure used by the Project.

Useful fields:

- `id`, `name`
- variant/condition
- `layers[]`
- `processes[]`
- sample/device IDs
- fabrication context
- origin/provenance

## 3. Evidence and outputs

### Measurement

Scientific evidence attached to the Project, Stack, sample/device or another explicit target.

Useful fields:

- `id`
- measurement type
- target reference
- source filename/file metadata
- columns/mapping/units
- rows or series
- instrument/conditions
- provenance
- parse/validation state

### Result

A derived or manually reviewed scientific result.

Useful fields:

- `id`
- source Measurement references
- metric/series name
- value or structured data
- unit
- method/version
- validation/review state

### Report

A human-reviewable Project output assembled from structured evidence.

### AIRecord

Optional future machine-generated output. It must stay distinguishable from raw data, processed data and human conclusions.

Useful fields:

- `id`
- `project_id`
- purpose/model metadata
- input/source references
- output
- timestamp
- review state
- accepted/rejected human decision

## 4. Provenance rule

Always preserve the distinction:

```text
Raw data
→ Processed data
→ Human result / note
↘ AIRecord → Human review
```

AI is never required for core LabFlow operation.

## 5. NOMAD readiness

Stable IDs, explicit units, typed Measurements, provenance and structured materials/stacks are sufficient foundations for later mapping and export. NOMAD must not dictate the researcher-facing navigation or force a second data model into the POC.

## 6. Compatibility concepts

Process/Experiment entities from older prototypes may remain useful later as deeper scientific records. They are not required to understand or navigate the current POC and must not replace the canonical `Workspace → Project → Pipeline → Step` hierarchy.
