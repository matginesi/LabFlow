---
title: Lab Cabinet
section: Researcher guide
order: 36
summary: Reusable laboratory resources for Design without inventory or LIMS semantics.
---
# Lab Cabinet

Lab Cabinet is a browser-persistent workspace library of reusable scientific resources for **Design Experiment**. It is deliberately not stock management, inventory, ERP or LIMS.

## Resource types

- Materials and chemicals
- Solutions / formulations
- Substrates
- Ordered device stacks
- Fabrication protocols
- Instruments / devices

## Page layout

The Cabinet page uses one compact scientific shelf/editor surface. The responsive shelf sits above a full-width editor rather than in a permanent left rail:

1. Search and create a resource from the single top command bar.
2. Filter by resource kind using the same tab treatment used elsewhere in LabFlow.
3. Select a compact resource tile from the locally scrollable shelf.
4. Edit the selected resource in the full-width editor below.
5. The shelf reflows from three columns to two and then one; command bar, form fields and actions stack before typography shrinks.
6. Backup/restore stays behind progressive disclosure.

The page uses the same canvas panels, tabs, fields, buttons, badges, notices and density tokens as the rest of LabFlow. There is no grey table-header slab and no unstyled native-looking filter row. Resource kind color is only a restrained recognition accent.

## Design integration

Design exposes **From Cabinet**, direct editing and **Save to Cabinet**. Using a Cabinet resource copies a snapshot into the current experiment and records a Cabinet source reference. Later edits to the Cabinet do not rewrite existing experiment data.

Cabinet resources may be supplied to `design.infer` as reusable laboratory context. They are never treated as evidence that an experiment used a specific recipe, stack or protocol.

## Portability

The Cabinet can be exported/imported as JSON from its page. Experiment portability is separate: use **Export → Export ZIP** for a LabFlow save.
