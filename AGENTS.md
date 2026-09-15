# LabFlow contributor contract

This file is the shortest enforceable guide for humans and coding agents changing the repository. It intentionally duplicates only non-negotiable constraints; detailed rationale lives in `docs/ARCHITECTURE.md`.

Read before structural changes:

1. `docs/ARCHITECTURE.md`
2. `docs/specs/DATA_MODEL.md`
3. `docs/specs/PIPELINE.md`
4. `docs/specs/ACTIONS.md`
5. `docs/guides/EXTENDING_LABFLOW.md`
6. `.agent/skills/labflow-ui/SKILL.md` for UI/layout/chart work
7. the feature-specific tests and documentation

## Non-negotiable invariants

- `LF.State.state.experiment` is the single mutable scientific aggregate.
- `DomainSchema` owns canonical record shapes, root ownership and persistence metadata.
- Uploaded archive bytes and RAW paths are immutable provenance.
- Scientific relations use stable IDs; a file identity is never substituted for a sample identity.
- `CanonicalStore` is a read index, not a second model.
- `DerivedState` owns invalidation registration for recomputable projections; do not grow feature-specific invalidation branches inside `State.touch()`.
- Persisted Action proposals, annotations and statuses live under `actionData` through `LF.ActionData`.
- `ActionCapabilities` is the single Action availability/preflight service. Routes affect recommendation, not existence.
- Public Action commands, routes and state bindings belong in `actions/*/action.json`; do not add Action-ID switches to pages or Assistant code.
- `DataPipeline` is deterministic and may not call an AI provider.
- Design mutations go through `DesignModel`. Reviewed dataset mutations go through `DatasetCorrections`.
- Cabinet resources are reusable references. Applying one copies a detached snapshot and records provenance; later Cabinet edits must not rewrite historical experiments.
- KB entries are reference knowledge, never experiment evidence.
- Required runtime dependencies fail fast. Do not hide architectural load-order errors behind fallback objects or no-op branches.
- External/persisted snapshots cross the strict `DataModel.restore()` trust boundary. `hydrate()` is not a migration layer.

## Ownership before convenience

Before writing data, identify its owner. A page/controller may coordinate a mutation but must call the owner API. Direct assignment is acceptable only inside the owning module or during canonical construction where the contract explicitly permits it.

When a new cross-module structure is introduced, register descriptive metadata in `LF.Structures`; keep defaults, validation and mutation logic in the real owner.

## Pipeline, Action, service, or UI state?

Use a **pipeline stage** when work is deterministic, lifecycle-bound, idempotent and should run without researcher/provider availability.

Use an **Action** when the user is asking for an explicit capability that produces a proposal, annotation, comparison, or answer.

Use a **service/tool** for reusable implementation detail that is neither a lifecycle stage nor a researcher-facing capability.

Use **UI state** only for selection, route, open/closed surfaces, filters, drafts and presentation state.

Do not turn internal functions into Actions merely to make them discoverable.

## Generated artifacts

Never edit these as source of truth:

- `assets/js/ai/action-registry.js`
- `assets/js/ai/prompt-bundle.js`
- `assets/js/knowledge/kb-bundle.js`
- `assets/js/pages/docs-bundle.js`
- `assets/js/pages/ui-kit-inline.js`
- generated Action references

Change manifests/Markdown/JSONL/source HTML and rebuild with the corresponding tool.

## Comments and documentation

Comments explain **why**, invariants, ownership, protocol constraints, or non-obvious failure handling. They do not narrate obvious syntax. Prefer a precise module header plus a small number of local invariant comments over commentary on every branch.

Public contracts, persistence boundaries and extension rules belong in `docs/`; comments should not become a second specification.

## Verification

Before delivery or merge:

```bash
./release_check.sh
```

For core import/domain/pipeline changes, also run the real private JV fixture regression when the fixture is available. For layout changes, run the browser audit when the environment permits local browser navigation.

## Repository hygiene

Local archives, `TEST_DATA/`, `ORIGINAL_REQUEST/`, credentials, workstation-specific model paths and generated scratch output do not belong in Git. Keep runtime defaults portable and reviewer-reproducible.
