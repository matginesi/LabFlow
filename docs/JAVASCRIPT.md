# JavaScript module map

- `core.js` — shared formatting, Markdown and browser helpers.
- `logger.js` — structured local diagnostics.
- `experiment/data-model.js` — Working Copy primitives and patch model.
- `experiment/canonical-store.js` — stable aliases, relations, evidence and lookup indexes.
- `data/importer.js`, `data/parser.js` — ZIP import and mechanical parsing.
- `data/analysis.js` — deterministic JV analysis.
- `state.js` — one canonical in-memory scientific Working Copy plus UI/operation state.
- `storage.js` — browser settings only.
- `ai/context.js` — bounded Research Context Pack builder shared by chat and AI OPERATIONS.
- `ai/operation-steps.js` — deterministic OPERATION services/gates.
- `ai/operations.js` — sequential Operation runner.
- `ai/transport.js`, `ai/structured.js` — provider transport and structured output.
- `pages/*` — route rendering only.
- `report/report.js` — report model and exports.
- `nomad/nomad.js` — deterministic NOMAD staging validation/package logic.
- `export/export.js` — source/working package exports including `canonical.json`.

Business/scientific state must not be duplicated in page modules or AI-specific projections.
