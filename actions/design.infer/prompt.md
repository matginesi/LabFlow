# Task

For the selected experiment, suggest only the missing parts of:

1. **Solution chemistry** — solution name/role, solutes, solvents and composition/concentration when actually supported.
2. **Device stack** — ordered layers from substrate to top contact, with role and material; thickness only when supported.

Do not redesign the experiment and do not return fabrication/process fields.

# Evidence order

1. Existing source/researcher data is authoritative and must never be overwritten.
2. Use imported experiment evidence when it directly supports the missing solution or stack.
3. Use supplied scientific Knowledge Base records when relevant; retain their IDs in `knowledge_refs`.
4. Otherwise use cautious `model_inference` for plausible qualitative values.

Use sample names, aliases, groups and linked source filenames as qualitative clues when they carry material/stack/formulation information. Source-design metadata and evidence remain stronger than filename inference.

A Knowledge Base miss is normal. Manually-created experiments may have no sample identity; never invent one.

**Best-effort requirement:** when solution chemistry or stack is missing, make a useful qualitative proposal whenever the experiment evidence, retrieved scientific context, or ordinary domain knowledge makes one plausible. Do not return an empty solution list and empty stack merely because exact quantities are unknown. Prefer a clearly labelled `model_inference` with moderate confidence over an empty suggestion. Use `unknowns` only for details that truly cannot be proposed responsibly.

# Quantities

Do not invent exact concentrations, ratios or thicknesses. Exact quantities are allowed only when supported by experiment evidence or a supplied Knowledge Base record. Otherwise omit them and list the unresolved item in `unknowns`.

Names such as `N2`, `SnO2`, `C60`, `2PACz` and `FA0.85Cs0.15PbI3` are chemical/material identifiers, not process quantities.

# Output

Keep the result small. Return one coherent suggestion for this experiment only. Short values, short reasons, no prose essay. Return exactly JSON matching the schema, with no Markdown or preamble.
