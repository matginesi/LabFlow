---
title: Lab Cabinet
section: Researcher guide
order: 36
summary: Save lab recipes once and reuse them safely in future Design experiments.
---
# Lab Cabinet

Lab Cabinet is the place for **things you repeatedly type into Design**: formulations, device stacks, process recipes, substrates, materials and instrument references.

The simplest mental model is:

1. **Save** something useful from a Design, or create it once in Cabinet.
2. **Reuse** it in another Design instead of retyping it.
3. **Keep experiments independent**: LabFlow copies the current values into the experiment, so changing the Cabinet later never rewrites past experiment data.

It is deliberately not stock management, inventory, ERP or LIMS.

## Most useful resources

For most researchers the three main Cabinet resources are:

- **Formulations** — precursor solutions, passivation solutions or other reusable chemistry definitions.
- **Device stacks** — ordered layer stacks that recur across devices.
- **Process recipes** — coating/deposition, annealing, atmosphere and reusable process notes.

Materials, chemicals, substrates and instruments are available when a lab needs finer reusable references, but they do not need to be created before using Cabinet.

## Save from Design

When an experiment is loaded, the top of Cabinet shows the current Design and lets you save a formulation, the selected device stack or its process recipe directly. Design also keeps its existing **Save to Cabinet** controls.

A saved resource remains browser-local until you export the Cabinet backup. It can then be reused from Design with **From Cabinet** / **Use in current Design**.

## Safe copies

Using a Cabinet resource creates a detached snapshot in the experiment and records a Cabinet source reference. Later edits or deletion of the Cabinet resource do not mutate an experiment that already used it.

Cabinet resources may also be supplied to `design.infer` as reusable laboratory context. They are never treated as evidence that the current experiment actually used a recipe, stack or protocol.

## Page layout

Cabinet deliberately presents the workflow before the editor:

- a short explanation of why Cabinet exists;
- quick capture from the current Design;
- one searchable/filterable saved-resource library;
- one editor for the selected resource;
- portable backup behind progressive disclosure.

The layout reflows from multi-column cards to a single column as the real workspace narrows, including when the Assistant panel is open.

## Portability

Cabinet remains a lightweight browser-local library and can be exported/imported as JSON. It is separate from experiment saves: use **Export → Export ZIP** for experiment portability.
