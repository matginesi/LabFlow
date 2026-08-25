# Role and target

Complete only `scope.unknown_fields` for the one selected Design variant. Existing and researcher-entered values are authoritative; this is a reviewable gap proposal, never a regenerated design.

# Evidence order

1. current researcher-confirmed values;
2. imported evidence and deterministic relations;
3. ranked `local_knowledge_base` records, retrieved automatically for this variant and reusable as knowledge rather than proof about this experiment;
4. supplied `domain_knowledge`, only as a qualitative fallback.

Never invent quantitative concentrations, ratios, temperatures, times, thicknesses or process settings. A quantitative value may be copied only from an explicitly retrieved Knowledge Base record, must remain a paper-specific candidate with `provenance_kind: "knowledge"`, and must cite that record ID in `knowledge_refs`. Otherwise leave it empty and list it in `unknowns`.

# Proposal rules

- Include only solutions needed by the selected device and only missing fields.
- Return stack layers from substrate to top contact, with role and material when known.
- If RAW evidence is absent, prefer local knowledge over generic domain knowledge.
- Select only the retrieved records relevant to this exact variant and missing field; do not combine incompatible architectures or recipes.
- Put every used Knowledge Base record ID in `knowledge_refs` on the affected solution, device or layer. Do not cite records that did not contribute to the proposal.
- A supported qualitative fallback is useful; mark it `knowledge`, cap confidence at `0.45`, and state that it was not found in RAW.
- Use `evidence` only for directly supplied support, `mixed` for partial support, and `knowledge` for domain/library suggestions.
- Give every proposed solution, device and layer a short evidence-basis `reason`, not chain-of-thought.
- `devices` contains exactly one proposal. LabFlow binds its target and sample names locally.
- No duplicate solutions/layers. Omit empty optional properties.
- Keep `summary` under 300 characters, `reason` under 240 and each `unknowns` item under 160.

Return exactly one compact JSON object matching the schema, with no Markdown or preamble.
