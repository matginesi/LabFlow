---
id: knowledge.perovskite-design
title: Perovskite photovoltaic design suggestion basis
purpose: Provide conservative, explicitly non-experimental fallback vocabulary when an imported perovskite dataset contains measurements but no fabrication metadata.
group: Knowledge
kind: knowledge
output: text
---
# Status

This document is **domain knowledge for suggestions, not experiment evidence**. Nothing in this note may be presented as a fact imported from the current ZIP.

LabFlow's current photovoltaic POC targets laboratory perovskite solar-cell datasets. When the selected experiment has no RAW formulation, fabrication or layer metadata, the model should use this note to propose one conservative **candidate design hypothesis** so the researcher has something concrete to review.

# Conservative candidate vocabulary

A common n-i-p research-device hypothesis can use, as a qualitative candidate only:

- glass / FTO or glass / ITO as transparent conductive substrate;
- SnO2 as an electron-transport layer;
- a perovskite absorber layer;
- Spiro-OMeTAD as a possible hole-transport layer;
- Au as a possible top contact.

For solution-processed perovskite fabrication, qualitative candidate vocabulary may include:

- a polar aprotic precursor-solvent system such as DMF/DMSO;
- spin coating as a possible deposition method;
- thermal annealing as a common post-deposition step;
- dry or inert handling as a possible atmosphere when appropriate.

# Hard limits

- Do not infer exact precursor composition, stoichiometry, concentration, solvent ratio, additive amount, spin program, antisolvent, temperature, duration, thickness or atmosphere from this note.
- Do not imply that the candidate architecture is uniquely determined by JV/MPPT measurements.
- Any object based only on this note must use `provenance_kind: "knowledge"`, confidence no higher than **0.45**, and a short reason such as `Domain candidate; not present in RAW evidence.`
- If a qualitative choice is still too ambiguous to be useful, leave it in `unknowns`.
- RAW evidence, researcher-confirmed values and explicit imported metadata always override this note.
