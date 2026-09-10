---
title: AI assistance
section: Researcher guide
summary: Where AI helps, where it is deliberately absent, and what every AI result means.
order: 30
---

# AI assistance

## AI is never required for import

ZIP parsing, naming normalization, safe-cleanup detection, hierarchy validation and Results are deterministic. Applying a detected safe cleanup is an explicit researcher decision and does not require AI.

## Where AI is useful

### Resolve ambiguities
`dataset.resolve-ambiguities` suggests mappings/classifications only when deterministic rules cannot settle semantic meaning. Suggestions are stored for review, not silently applied.

### Design suggestions
`design.infer` completes missing qualitative solution chemistry, a complete device architecture and/or fabrication process for one incomplete experiment. One absorber layer is still incomplete. One run attempts every missing domain; incomplete model output is retried internally. For multiple experiments, **Complete all missing with AI** runs the same Action sequentially. If bounded retries are exhausted, that experiment becomes a retryable Action error rather than a second “Suggest missing” / “Needs context” state.

### Results interpretation
`results.interpret` produces a structured, evidence-bounded interpretation of deterministic statistics/findings.

### Results comparison
`results.compare` explains differences between two or more selected groups without recalculating anything.

### Assistant
`assistant.chat` answers questions from bounded page/experiment context and cannot mutate scientific data.

## Researcher authority

Model output is either a proposal, a derived annotation, or a read-only answer. Scientific measurements and researcher-confirmed Design values are not overwritten automatically.

## Provider configuration

Cloud and local OpenAI-compatible providers can be selected in Settings. Local model paths are retained internally when needed but shown as basenames in the UI/logs.

See the generated Action runtime matrix for current token/deadline budgets.
