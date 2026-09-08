# LabFlow contributor / coding-agent rules

Read before structural changes:

1. `docs/ARCHITECTURE.md`
2. `docs/specs/DATA_MODEL.md`
3. `docs/specs/PIPELINE.md`
4. `docs/specs/ACTIONS.md`
5. `docs/guides/EXTENDING_LABFLOW.md`
6. `.agent/skills/labflow-ui/SKILL.md` before any UI/layout/chart change
7. the feature-specific docs/tests

## Non-negotiable invariants

- One mutable scientific aggregate only: `LF.State.state.experiment` (`ExperimentData`).
- `DomainSchema` is the only canonical record/root/default definition.
- Source ZIP bytes/paths are immutable provenance.
- Scientific relations use stable IDs when available.
- `samples[]` is the physical sample/cell collection; do not add `entities[]` aliases.
- LabFlow Data corrections use the single `patch` shape with typed target.
- Runtime derived caches are recomputable and excluded from persistent snapshots.
- `CanonicalStore` is a pure read index, not a second model.
- Persisted Action outputs live only in `actionData` via `LF.ActionData`.
- `State.touch()` must not accumulate feature-specific invalidation code; use `DerivedState`.
- The deterministic pipeline never calls AI.
- AI never calculates authoritative JV metrics or silently mutates source/LabFlow Data.

## Researcher-first workflow

```text
Upload ZIP
→ deterministic naming/hierarchy/analysis
→ automatic mechanically-safe cleanup
→ researcher sees only genuine semantic ambiguity
→ Results / Design / Export
```

Do not add clicks for deterministic work LabFlow can safely perform itself.

For UI work, `.agent/skills/labflow-ui/SKILL.md` is the visual/interaction contract. Keep the primary navigation and mental model exactly **Upload & Review → Results → Design → Export**; NOMAD is an export target, not a primary workflow page.

## Pipeline vs Action

Use a pipeline stage for deterministic lifecycle work. Use an Action only for an explicit researcher capability (proposal, interpretation, question). Use a local service/tool for reusable implementation detail.

Current Actions:

- `dataset.resolve-ambiguities`
- `design.infer`
- `results.interpret`
- `results.compare`
- `assistant.chat`

Do not reintroduce analysis/safe-cleanup/report/NOMAD preparation as Actions.

## Mutations

Prefer owner APIs/services. Avoid direct root-array writes from pages. Every scientific mutation must preserve revision/invalidation/provenance rules.

When adding a derived projection, register dependencies with `DerivedState`. When adding a pipeline stage, declare `after`, `reads`, `writes`, `phase`; do not manually invoke downstream stages.

## Persistence

`DomainSchema.snapshot()` defines persistence. Do not add ad-hoc temporary fields and assume they will/should persist. Restore through `DataModel.hydrate()` and rebuild runtime projections.

## Extension

Follow `docs/guides/EXTENDING_LABFLOW.md`. Do not add framework abstraction unless it eliminates a demonstrated duplication/boundary problem.

## Generated artifacts

After relevant changes rebuild:

```bash
python tools/build_prompt_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py
```

Do not edit generated bundles as source-of-truth.

## Verification before delivery/merge

```bash
node tests/unit/run.js
python tools/validate_action_contract.py
python tools/validate_architecture_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py
```

Run JS syntax checks and the real JV fixture regression for import/domain/pipeline changes.

## Repository hygiene

`.gitignore` must keep local ZIP archives and `ORIGINAL_REQUEST/` / `TEST_DATA/` out of Git. Test fixtures may exist locally for validation but are not repository content.
