# Task

Suggest the missing **solution chemistry**, **device stack**, and/or **fabrication process** for the one selected experiment.

The selected experiment identity is already known by LabFlow. Do **not** repeat device IDs, sample IDs, sample names, or internal LabFlow objects.

## What to return

Return exactly these six top-level fields:

- `status`: `suggested` or `insufficient_evidence`
- `summary`: one short sentence
- `solutions`: zero or more qualitative solution suggestions
- `stack`: zero or more ordered device layers
- `process`: qualitative fabrication-process information
- `unknowns`: details that remain unknown

This Action is intentionally small. Do not return `devices`, `variants`, `coverage`, `sample_names`, `solution_names`, wrapper objects, Markdown, or commentary.

## Evidence and inference

1. Existing source/researcher data is authoritative and must never be overwritten.
2. Suggest only fields listed as missing in the Action context.
3. Prefer imported experiment evidence when it directly supports chemistry, stack, or process.
4. The context may include `cabinet` resources. Cabinet entries are reusable workspace resources, **not experiment evidence**. Prefer a compatible Cabinet formulation, stack or protocol when useful, but do not claim that the experiment used it unless experiment evidence says so.
5. If you reuse a Cabinet concept, preserve its qualitative names so LabFlow can deterministically recognize a matching Cabinet item.
6. Otherwise use cautious `model_inference` for a plausible **qualitative** suggestion.
7. Exact unsupported quantities such as thickness, concentration, temperature, time, rpm, pressure or flow must remain blank/unknown.
8. Material identifiers containing digits such as `SnO2`, `C60`, `2PACz`, `N2` or `FA0.85Cs0.15PbI3` are qualitative identifiers, not process quantities.

If the dataset establishes only that these are photovoltaic JV measurements but does not identify the exact architecture, a generic qualitative photovoltaic/perovskite design is acceptable **only as `model_inference` with conservative confidence**. Prefer useful roles/material/process families over an empty answer.

A single known absorber label such as `perovskite` is not a complete answer. When `stack` is missing, return a coherent candidate architecture in physical order: substrate, transparent contact when relevant, electron/hole selective transport layers, absorber, opposite transport layer and top contact. Preserve any known layer by including it unchanged in the proposed sequence. When `solutions` is missing, describe at least the useful chemistry role and plausible qualitative precursor/solvent family; when `process` is missing, describe plausible deposition, annealing and atmosphere families. Do not add exact numeric recipes unless evidence supplies them.

If you genuinely cannot make a responsible qualitative suggestion, return `status: "insufficient_evidence"`, empty `solutions`, empty `stack`, an empty process object, and concrete `unknowns` describing what is missing. This is a valid scientific result, not an Action failure.

## Solution chemistry

A solution item needs only `name`. Add `role`, `solutes`, `solvents`, `concentration`, `additives`, `evidence`, `confidence`, `provenance_kind`, and `reason` when useful. Do not invent exact recipes.

## Device stack

Return the stack in physical order from substrate to top contact. Each layer must contain `role` and `material`. Use `material: "unknown"` only when the layer role itself is useful but the exact material cannot be inferred. Thickness is optional and must stay empty unless supported.

## Fabrication process

`process` may contain:

- `coating`: qualitative deposition/coating method
- `annealing`: qualitative annealing step or family
- `atmosphere`: qualitative environment such as air, inert atmosphere, glovebox
- `notes`: other reproducibility-relevant qualitative process information
- `evidence`, `confidence`, `provenance_kind`, `reason`

Do not invent exact temperatures, durations, speeds or pressures. A qualitative phrase such as `spin coating`, `thermal evaporation`, `inert atmosphere`, or `thermal annealing` is useful when scientifically plausible; unsupported numeric settings are not.

## Output discipline

Return JSON only, matching the supplied schema. Keep it compact.
