# JavaScript module map

- `core.js` — shared formatting, Markdown and browser helpers.
- `logger.js` — structured local diagnostics.
- `experiment/data-model.js` — Working Copy primitives and patch model.
- `experiment/canonical-store.js` — internal canonical-v2 grouped representation plus stable aliases, relations, evidence, provenance and lookup indexes.
- `tools/registry.js` — typed Tool Registry shared by Actions and the read-only Assistant.
- `data/importer.js`, `data/parser.js` — ZIP import and mechanical parsing.
- `data/analysis.js` — deterministic JV analysis.
- `state.js` — one canonical in-memory scientific Working Copy plus UI/Action state.
- `storage.js` — browser settings only.
- `ai/context.js` — bounded declarative Context Pack builder; Action profile comes from `input.context`.
- `ai/action-steps.js` — deterministic service implementations wrapped by internal Tools.
- `ai/actions.js` — sequential Action runner, current-revision prerequisite gate and bounded read-tool Assistant loop.
- `ai/transport.js`, `ai/structured.js` — provider transport and structured output.
- `pages/*` — route rendering only.
- `report/report.js` — report model and exports.
- `nomad/nomad.js` — deterministic NOMAD staging validation/package logic.
- `export/export.js` — source/working package exports including `canonical.json`.

Business/scientific state must not be duplicated in page modules or AI-specific projections.
