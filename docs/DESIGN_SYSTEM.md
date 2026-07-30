# Design system

## Direction

LabFlow uses compact technical surfaces, restrained navy/blue/teal accents,
low radii and information-bearing borders. It should feel like a scientific
workbench, not a consumer dashboard.

## Core rules

- Show one primary action for the current researcher task.
- Use progressive disclosure for advanced scientific fields.
- Prefer plain laboratory language over data-model terminology.
- Encode state with text and shape, not colour alone.
- Keep definitions and actual execution visually distinct.
- Make provenance, warnings and exclusions inspectable.
- Use compact tables for comparison and cards for bounded decisions.
- Avoid decorative gradients, excessive rounding and oversized empty space.

## Workflow components

- **Workflow rail**: eight phases with completed, current, to-do, optional and
  verify states.
- **Next action**: one sentence and one primary control.
- **Solution preparation**: solvent mixture → solutes → additives →
  concentration → batch → review.
- **Stack view**: ordered layers plus essential usage facts.
- **Processing split**: reusable protocol beside actual run.
- **Evidence cards**: numbered citations, provenance and linked record.
- **Export review**: included and excluded content shown before generation.

## Shared implementation

`assets/theme.css` is the token source. `assets/app.css` contains product
components and responsive rules. `ui-kit.html` is the canonical visual
reference; product pages should reuse its patterns rather than introduce local
themes.

Supported layouts cover 360–1440 px, keyboard focus and reduced motion.
