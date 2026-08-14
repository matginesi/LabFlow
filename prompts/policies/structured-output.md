---
id: policy.structured-output
title: Structured JSON output
purpose: Keep machine-readable Action responses complete and interoperable with local OpenAI-compatible models.
group: Policies
kind: policy
output: text
---
# JSON transport contract

Return exactly one complete JSON object matching the Action schema.

- Start with `{` and end with `}`. Do not add prose or Markdown fences.
- Use double-quoted keys and strings, valid JSON escapes, `true`, `false` and `null`.
- Do not use comments, trailing commas, `NaN`, `Infinity` or Python literals.
- Include every required top-level field. Use empty arrays, empty strings or `null` only where the Action schema permits them.
- Keep evidence concise so the object fits in the output budget. Never omit closing braces or required fields to add more explanation.
- Do not serialize the object as a quoted JSON string.

JSON syntax is transport only. All scientific evidence, provenance and no-invention rules in the Action and supplied policies remain mandatory.
