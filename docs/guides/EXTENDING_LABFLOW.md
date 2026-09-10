---
title: Extending LabFlow
section: Developer guides
summary: Practical contribution rules for adding records, pipeline stages, projections, Actions, pages and exports without creating parallel state.
order: 5
---

# Extending LabFlow

Use this guide before adding a new cross-cutting feature.

## 1. Decide which layer owns the feature

Ask in this order:

1. **New scientific/source data shape?** → `DomainSchema` + `ExperimentData`.
2. **Deterministic lifecycle calculation/repair?** → service + maybe `DataPipeline` stage.
3. **Recomputable cache/view?** → owning projection + `DerivedState` dependency.
4. **Explicit researcher decision/proposal/interpretation?** → Action.
5. **Presentation only?** → page consuming existing APIs.
6. **External deterministic representation?** → export projection/service.

Do not solve layer ambiguity by creating another state tree.

## 2. Add a record kind

Register one record factory/normalizer in `DomainSchema`:

```js
registerRecord('my_record', {
  defaults() { return {...}; },
  normalize(record) { ... },
  required: [...],
  relations: { parentId: 'sample' }
})
```

If it is a top-level aggregate collection, register one root with owner/layer/persistence/`recordKind`. Then `ExperimentData.addRecord('my_record', seed)` can use it generically.

Extend `DataContracts` only for invariants that cannot be expressed by required fields/relations.

## 3. Add a deterministic pipeline stage

```js
DataPipeline.register({
  id: 'my-stage',
  phase: 'derive',
  after: ['analyze'],
  reads: ['analysis'],
  writes: ['myProjection'],
  description: '...',
  run(exp, ctx) { ... }
})
```

Rules:
- deterministic only;
- one clear responsibility;
- no downstream stage calls;
- return `{restartFrom:'...'}` if upstream state changed;
- idempotent for unchanged input;
- add a test for plan/dependencies and repeated refresh.

## 4. Add a derived projection

Own the cache in one module and register invalidation:

```js
DerivedState.register('my-projection', {
  dependsOn: ['dataset', 'analysis'],
  paths: ['myProjection'],
  description: '...'
})
```

If keys cannot be represented safely as dot paths (for example Action IDs containing dots), use an explicit `invalidate(exp)` callback.

Do not teach `State.touch()` the feature path.

## 5. Add an Action

Create:

```text
actions/my.action/
├─ action.json
├─ prompt.md      # AI only
└─ schema.json    # structured result only
```

Manifest must define target/context/result/effect/guards/execution. A public Action also declares `ui.command` and `ui.routes`; declare `ui.bindings` when target/filter parameters come from application state. `ActionCapabilities` resolves those bindings and guards once for every UI surface, so do not add Action-ID switches to Assistant/pages. Use `ActionData` for stored proposals/annotations/status. Scientific apply logic stays deterministic and target-validated.

Guards must read the resolved Action context/parameters rather than DOM or page-specific globals. Routes express recommendation only; they must never determine whether an Action exists.

A bulk UI operation should usually sequence the same single-target Action rather than invent a second batch Action/schema.

## 6. Add a page

Pages may:
- query `ExperimentData` / CanonicalStore / projections;
- invoke Actions/services;
- keep UI-only selection/filter state.

Pages must not:
- own scientific arrays;
- parse source files independently;
- recreate domain defaults;
- mutate ActionData/scientific records with ad-hoc assignment when an owner API exists.

### UI implementation

Read `.agent/skills/labflow-ui/SKILL.md` and reuse the production patterns in `ui-kit.html`. Put tokens in `assets/css/tokens.css`, reusable controls/panels/Totems in `assets/css/ui.css`, and only page composition in `assets/css/app.css`. Use the shared 36 px normal or 32 px compact controls, token spacing and responsive reflow; do not create page-local density systems.

Use the Message Totem for application feedback/confirmation and the Action Totem for foreground execution progress/results. Inline notices are page content, not another Totem. Do not add custom Totem clones, CDN assets, trackers, frameworks or frontend infrastructure. The current runtime is vanilla JavaScript and local CSS; no separate Bootstrap runtime is loaded.

## 7. Add an export

An export reads one validated LabFlow Data and builds a deterministic external representation. It never becomes a second editable data model and never marks itself as source truth.

## 8. Update documentation and generated bundles

When applicable run:

```bash
python tools/build_prompt_bundle.py
python tools/build_knowledge_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py
```

## 9. Required verification

Before merge:

```bash
node tests/unit/run.js
python tools/validate_action_contract.py
python tools/validate_architecture_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
```

Also run JS syntax checks and the real JV fixture regression when core data/pipeline/import behavior changed.

## 10. Review checklist

- Is there still exactly one `ExperimentData`?
- Are new defaults defined once in `DomainSchema`?
- Are relations ID-based?
- Is mutation provenance explicit?
- Is persistent vs runtime state declared?
- Is derived invalidation registered, not hardcoded in State?
- Is pipeline work deterministic and idempotent?
- Does an Action represent a researcher goal rather than an internal function?
- Are Action outputs in `ActionData`?
- Does Action availability come only from `ActionCapabilities` + guards, with page routes affecting recommendation only?
- Are target/filter bindings declared in the Action manifest rather than hardcoded by Action ID?
- Can a new contributor discover the contract from console/docs/tests?
