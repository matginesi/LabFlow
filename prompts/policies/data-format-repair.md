---
id: policy.data-format-repair
title: Data format, validation and repair policy
group: Policies
kind: policy
output: text
---
# LabFlow data format, validation and repair policy

## Purpose

This file is the **source of truth for validation and repair decisions**. The ZIP/file format itself is defined separately by the Data Contract (`policy.data-ground-truth`). This policy is both:

1. a prompt/context document for AI Actions; and
2. a machine-readable source of deterministic repair guardrails used by the browser code.

Do not move semantic repair rules into JavaScript when they belong here. JavaScript may implement the mechanics of reading a ZIP, parsing tables, applying patches and calculating metrics, but the policy for interpreting broken or irregular data must remain explicit in Markdown.

## Non-destructive rule

RAW input is immutable. Never rename, delete, rewrite or normalize the source archive in place. Corrections are represented as working-state patches with provenance.

## Evidence order

When LabFlow must interpret an identifier or missing field, prefer evidence in this order:

1. explicit value inside the measurement file;
2. matching FW/RV summary rows;
3. measurement filename;
4. parent sample directory;
5. related Parameters or Tracking file with matching timestamp/device;
6. repeated naming pattern elsewhere in the same experiment;
7. bundled LabFlow documentation;
8. AI inference.

If two high-priority sources disagree materially, do not silently choose one. Create a finding and require review.

## Filename and sample-name policy

- Preserve the original filename verbatim in provenance.
- Leading/trailing whitespace may be normalized in the working interpretation.
- Repeated internal whitespace may be collapsed when the meaning is otherwise unchanged.
- Once device/sample identity is established, canonical laboratory naming is deterministic: use the patterns declared by the Data Contract (for the current dataset family, e.g. `N1 3 -1A` → `N1_3_1A`).
- Known `Stability (...)` filenames keep their acquisition prefix/family marker and canonicalize only the trailing device/sample token.
- RAW filename/path remains verbatim provenance; canonical naming affects only the Working Copy representation.
- A purely cosmetic canonical rename is never an AI ambiguity and never needs human semantic review.
- `REF` is a semantic reference marker when it appears as a standalone token or clear sample prefix.
- Do not infer a new sample identity solely from cosmetic normalization.
- If multiple plausible sample/group interpretations remain after canonical formatting, propose alternatives with evidence and confidence.

## Missing-data policy

- A missing FW or RV summary does not make the experiment unreadable.
- Individual `Stability (JV)` files are the preferred fallback for missing summary metrics and curve data.
- Parameters and Tracking files may provide metadata/evidence but must not be used to invent absent JV values.
- A field that cannot be recovered is represented as missing/unknown, never fabricated.
- A partial measurement may remain usable for views that do not require the missing direction.

## Format and conversion decisions

Apply these rules when reviewing a RAW file-to-canonical conversion:

1. Identify the file family from an explicit basename/marker and archive position defined by the Data Contract. Content similarity alone is insufficient to silently reclassify an unknown file.
2. Report the observed physical format: extension, delimiter, encoding evidence, section markers, header row, column count, direction layout and explicit units.
3. Map only evidenced fields to canonical names. Record the RAW header/value and canonical field separately.
4. Treat trimming, stable header aliases, `FW`/`RV` key mapping, finite-number parsing and the documented decimal-comma fallback as mechanical conversions.
5. Treat unit changes, scale factors, sample/group/reference reclassification and conflict resolution as semantic conversions requiring a proposal and human review.
6. Preserve missing values as unknown. Never convert blank, invalid or absent input to `0`, an empty scientific string or an AI-estimated number.
7. Keep Parameters and Tracking rows as auxiliary evidence. Never convert them into missing JV curves or silently use them to replace conflicting dedicated JV values.
8. For every ambiguity, state the candidates, supporting RAW paths and why automatic conversion is unsafe.

Each proposed conversion must identify `source_format`, `source_field`, `source_unit`, `canonical_field`, `canonical_unit`, `mechanical_transform`, evidence and review requirement. If no transformation is required, use `mechanical_transform: "identity"`.

## Corrupt or suspicious values

- Never replace suspicious scientific values with AI-generated numbers.
- If the RAW curve contains enough points, deterministic calculations may be used to recompute a derived metric; provenance must state that it was recalculated from RAW curve points.
- If a likely scale/unit/area mismatch is detected, create a proposed patch with evidence and estimated factor. Do not auto-apply it when the interpretation changes scientific meaning.
- Invalid/non-finite values must not enter ranking statistics.
- Values outside configured danger guardrails receive a **safety stop**: they remain visible in tables but are excluded from best-value rankings and aggregate performance charts until reviewed and corrected or explicitly restored.
- Ranking eligibility requires a finite efficiency, no active danger-level flag and no manual exclusion. Warning-level findings remain visible and do not by themselves create a safety stop, although a measurement with missing/non-finite efficiency is still ineligible.
- For this perovskite POC, the bundled FF plausibility guardrail is intentionally conservative: values above 90% are treated as suspicious and receive a safety stop by default. This is a configurable laboratory policy, **not a claimed universal physical limit**; edit `metric_ranges.ff.max` in Settings when the laboratory establishes a different validated convention.

## Fix categories

Allowed working-state patch types:

- `sample_mapping`
- `group_mapping`
- `reference_classification`
- `field_mapping`
- `unit_mapping`
- `scale_factor`
- `exclude_measurement`
- `restore_measurement`
- `derived_metric_recovery`
- `metadata_value`

Every patch must contain target, before/after value when relevant, source (`deterministic`, `ai`, or `user`), reason/evidence, timestamp, and review status.

## Human-review boundary

Require human review when a proposed change:

- changes sample identity or group membership;
- changes reference/non-reference classification;
- changes a physical unit;
- applies a scale factor;
- excludes data from scientific analysis;
- fills experimental-design facts not explicitly present in source data;
- resolves conflicting high-priority evidence.

## Deterministic guardrails

The following fenced JSON block contains **repair/analysis guardrails only**. ZIP/file structure is defined exclusively in the Data Contract (`policy.data-ground-truth`). Keep this block valid JSON.

```json labflow-rules
{
  "naming_checks": {
    "odd_spacing_regex": "\\s+[_-]|[_-]\\s+|\\s{2,}"
  },
  "metric_ranges": {
    "voc": {
      "min": 0.0,
      "max": 2.0,
      "severity": "warning"
    },
    "jsc_abs": {
      "max": 50.0,
      "severity": "danger"
    },
    "ff": {
      "min": 0.0,
      "max": 90.0,
      "severity": "danger"
    },
    "efficiency": {
      "min": 0.0,
      "max": 40.0,
      "severity": "danger"
    }
  },
  "pair_checks": {
    "hysteresis_abs_warning": 0.3,
    "jsc_difference_percent_warning": 20.0,
    "efficiency_difference_percent_warning": 15.0
  },
  "ranking": {
    "exclude_danger_findings": true,
    "require_finite_efficiency": true
  },
  "patch_policy": {
    "batch_safe_types": [
      "sample_mapping",
      "group_mapping",
      "metadata_value"
    ],
    "single_apply_types": [
      "sample_mapping",
      "group_mapping",
      "reference_classification",
      "field_mapping",
      "unit_mapping",
      "scale_factor",
      "exclude_measurement",
      "restore_measurement",
      "derived_metric_recovery",
      "metadata_value"
    ],
    "always_human_review_types": [
      "reference_classification",
      "field_mapping",
      "unit_mapping",
      "scale_factor",
      "exclude_measurement",
      "restore_measurement",
      "derived_metric_recovery"
    ]
  }
}
```

## Expected AI behavior

When this policy is supplied to an AI Action, the model must use it as a constraint, not as optional advice. The model may explain or propose patches, but it must not claim that a patch has been applied unless the application confirms it.

## Export and NOMAD readiness

An export package must contain the current reviewed working interpretation and enough provenance to reconstruct how it differs from RAW. Apply these rules to every NOMAD Action and pre-upload review:

- Never export an AI proposal as an applied correction. A correction affects exported canonical data only after the application records an accepted patch with target, before/after values, source, evidence, review status and timestamp.
- Keep the original RAW archive separate from corrected/canonical tables. Never rewrite the RAW ZIP to make it look compliant.
- Preserve unknown or missing scientific values as null/blank with status metadata. Never replace them with `0`, an empty scientific claim or an AI estimate.
- Treat unresolved danger findings, accepted-but-unapplied corrections, stale mapping reviews and missing provenance for a scientific correction as export blockers or explicit review items.
- Export derived values only when their deterministic source and active conversion factor are recorded. Keep AI-inferred Design values labelled `ai_inferred` until human confirmation.
- A NOMAD Action may assess, map or recommend. It must not claim that the ZIP conforms to the target deployment; only deterministic local checks plus processing by the selected NOMAD deployment can establish that.
