---
title: Recovery-rule authority
section: Scientific data
summary: Where deterministic source-format recovery policy lives and what parser code is allowed to do.
order: 34
---

# Recovery-rule authority

Operational recovery policy lives in `prompts/policies/data-format-repair.md`. Its machine-readable rule block is consumed by deterministic parser/validator code.

JavaScript implements mechanics: archive traversal, text/numeric parsing, configured pattern matching, configured normalization, evidence collection, findings and reviewed patch application. It must not invent new semantic recovery policy independently.

When laboratory structure/naming/fallback/unit/guardrail policy changes, update the policy source and its tests first. RAW bytes remain immutable regardless of recovery strategy.
