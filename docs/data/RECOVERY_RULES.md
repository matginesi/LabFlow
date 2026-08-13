# Recovery Rules

## Ground truth

The operational recovery rules are **not defined in this document**. They live in:

`prompts/policies/data-format-repair.md`

That Markdown file is deliberately both an AI prompt/policy and a machine-readable rules source. Its fenced `json labflow-rules` block is consumed by the deterministic parser/validator.

This separation is mandatory: when laboratory naming, file structure, fallback behavior, unit interpretation, missing-data handling or guardrails change, update the Markdown policy first. Do not hide new semantic rules inside `parser.js`.

## Implementation boundary

JavaScript may implement mechanics such as ZIP traversal, text splitting, numeric parsing, matching configured file patterns, applying configured normalization, generating findings, and applying reviewed patches. It must not independently invent the policy for what a broken format means.

RAW bytes are always preserved.
