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

## Design integration

Design exposes **From Cabinet**, direct editing and **Save to Cabinet**. Using a Cabinet resource copies a snapshot into the current experiment and records a Cabinet source reference. Later edits to the Cabinet do not rewrite existing experiment data.

Cabinet resources may be supplied to `design.infer` as reusable laboratory context. They are never treated as evidence that an experiment used a specific recipe, stack or protocol.

## Portability

The Cabinet can be exported/imported as JSON from its page. Experiment portability is separate: use **Export → Export ZIP** for a LabFlow save.
