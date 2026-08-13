# NOMAD mapping and export

NOMAD is a deterministic consumer of the current Canonical Working Copy.

## 1. Principle

NOMAD must not reinterpret the original ZIP independently.

The input is:

```text
current Working Copy
      ↓
Canonical Store
      ↓
Canonical → NOMAD mapping
```

## 2. Researcher OPERATION

The only NOMAD Workshop OPERATION is:

```text
nomad.prepare
```

It is deterministic.

Checkpoints:

1. build mapping plan;
2. store the revision-scoped plan;
3. validate required staging/package inputs.

AI never declares readiness.

## 3. Single mapping contract

`LF.Nomad.ensureMapping()` provides one mapping plan that is reused by:

- the NOMAD UI;
- validation;
- entry YAML generation;
- exported mapping metadata.

Never implement a separate mapping in a page or exporter.

## 4. Mapping rows

Each mapping should be inspectable as:

```text
LabFlow source
→ NOMAD field
→ current value
→ required/optional
→ status
```

A mapping can be:

- mapped/ready;
- missing required;
- missing optional/review;
- otherwise locally invalid.

## 5. Readiness

Required missing mappings block staging.

Optional missing mappings remain visible but do not become fabricated values.

The researcher fixes source semantics in Review/Design/Working Copy and then regenerates the mapping.

## 6. Revision invalidation

The mapping belongs to one Working Copy revision. Relevant scientific mutation invalidates the stale mapping plan/validation.

## 7. Package auditability

The NOMAD staging ZIP stores as applicable:

- custom schema/entry files;
- `metadata/canonical.json`;
- `metadata/mapping_plan.json`;
- provenance/patch information;
- required source files.

This makes the transformation auditable.

## 8. Schema reference

The generated entry uses the same-upload raw schema reference for the LabFlow custom schema and points to the appropriate `section_definitions` entry.

## 9. What NOMAD must not do

Do not:

- use AI as readiness gate;
- silently invent missing metadata;
- rebuild a second mapping during export;
- use raw filenames as semantic identity when Canonical Store already resolved the entity;
- mark the Working Copy saved when exporting NOMAD.
