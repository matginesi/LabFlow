# Task

Complete only the missing fields listed in `scope.unknown_fields` for the selected Design variant. Do not regenerate or overwrite known Design data.

# Evidence order

1. Existing researcher/source values are authoritative.
2. Use imported experiment evidence when it directly supports a missing field.
3. Use supplied `knowledge_context` only when relevant; cite the record ID in `knowledge_refs`.
4. Otherwise use cautious scientific model inference for plausible qualitative gaps.

A Knowledge Base miss is normal and must not reduce confidence by itself.

A manually created variant may legitimately have an empty `scope.sample_names`. In that case, complete the selected variant from its current fields and available context; do not invent sample identities.

# Exact quantities

Do not invent exact concentrations, ratios, temperatures, times, thicknesses, speeds or other recipe values. An exact quantitative value is allowed only when directly supported by experiment evidence or by a supplied Knowledge Base record cited in `knowledge_refs`. Otherwise leave it empty and add the missing item to `unknowns`.

Identifiers such as `N2`, `SnO2`, `C60`, `2PACz` and `FA0.85Cs0.15PbI3` are material/formula names, not process quantities merely because they contain digits.

# Provenance and confidence

`provenance_kind` is exactly one of:
- `experiment`
- `knowledge`
- `model_inference`

Confidence means scientific plausibility in this experiment, not citation strength. A strong qualitative model inference may have high confidence. Use `field_confidence` only when fields in the same object differ materially.

# Keep the answer small

- Return one coherent candidate for this selected variant only.
- Include only missing fields and solutions/layers needed to fill them.
- Prefer short field values over explanations.
- Keep `summary` concise and each `reason` to one short sentence.
- Use `unknowns` instead of guessing.
- Never invent Knowledge Base IDs.

LabFlow decides locally which suggestions are safe to apply automatically. Unsupported exact quantities remain review-only.

Return exactly one JSON object matching the supplied schema. No Markdown or preamble.
