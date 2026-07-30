# Design system

## Scientific object views

LabFlow presents the experiment as connected laboratory objects before showing
their detailed fields. Solution recipes use ingredient cards and proportional
solvent bars; material stacks use ordered selectable layers; processing uses a
vertical timeline; data files show their attached stack or device; reports show
assembly progress. These patterns are canonical and are demonstrated in
`ui-kit.html`. Forms remain available as secondary editors.

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

## Search pattern

The topbar search is the shared cross-product entry point. Its placeholder
adapts to the current area, visible records may be filtered in place and a
compact result panel links to canonical destinations. Documentation and the Lab
Cabinet retain deeper domain-specific search inputs beneath the same visual
language.
