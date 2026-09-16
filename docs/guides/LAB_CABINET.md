---
title: Lab Cabinet
section: Researcher guide
summary: Reusable laboratory references that can be copied safely into experiment Design.
order: 36
---

# Lab Cabinet

Lab Cabinet is a browser-local library for reusable laboratory definitions: formulations, device stacks, fabrication recipes, substrates, materials/chemicals, instruments, acquisition software, setups and output file formats.

It is intentionally **not** inventory management, stock control, ERP or a LIMS.

## Mental model

```mermaid
flowchart TD
    C[Create / save once in Cabinet] --> R[Reuse intentionally in a Design]
    R --> D[Detached copy becomes experiment-owned]
```

Changing or deleting the Cabinet item later does not rewrite an experiment that already used it.

## What belongs in Cabinet

The highest-value reusable resources are usually:

- formulation/solution definitions;
- complete device stacks;
- fabrication/process recipes.

Materials and substrates support finer Design references. Instruments, acquisition software, setups and file-format profiles form the reusable data-infrastructure catalog referenced by scientific Workspace Processes.

## Design integration

Cabinet never assigns Design fields directly. Application goes through `DesignModel`, which validates/normalizes the copied value and records the Cabinet source reference.

Only Cabinet kinds declaring an applicable Design capability are offered for reuse. The page reads fields, labels, summaries, grouping and capabilities from the Cabinet registry rather than maintaining a second UI-specific schema.

## Validity and AI context

Incomplete resources can remain in Cabinet while being edited. Only resources satisfying the Cabinet validator are eligible for application or bounded AI context.

`design.infer` may receive relevant Cabinet context as “available/reusable lab reference”. It must not treat that context as proof that the current experiment used the item.

## Storage and portability

Cabinet is stored independently from an experiment workspace and can be exported/imported as JSON. Experiment portability remains the responsibility of the normal LabFlow export.

## Data-infrastructure resources

The infrastructure kinds are not copied into Design. They describe reusable components of a data-generating Process:

- `instrument`: instrument type, manufacturer/model, serial/firmware, location and acquisition-software references;
- `software`: acquisition software/vendor/version and supported instruments/formats;
- `setup`: a composed station referencing instruments/software/formats and optional parallel capacity;
- `file_format`: extensions/MIME types, producing software, format documentation, parser support and typical output size/count.

A Workspace Process references these items by stable Cabinet ID. The Process definition is context; a concrete Measurement may additionally record the actual instrument/software/setup references as provenance.
