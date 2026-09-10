# Validation

Run before packaging or merging architectural changes:

```bash
python tools/build_prompt_bundle.py
python tools/build_knowledge_bundle.py
python tools/build_action_registry.py
python tools/build_action_reference.py
python tools/build_docs_bundle.py
python tools/build_ui_kit_inline.py

python tools/validate_architecture_contract.py
python tools/validate_source_hygiene.py
python tools/validate_action_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
python tools/validate_privacy_contract.py

node tests/unit/run.js
node tests/regression/import-page-check.js
find assets vendor -name '*.js' -print0 | xargs -0 -n1 node --check
```

## What the validators protect

- `validate_source_hygiene.py`: owner/mutation boundaries, strict restore usage, no legacy version wrappers or developer-specific runtime defaults, plus readability warnings for overly dense source lines.
- `validate_architecture_contract.py`: one `ExperimentData` aggregate, schema-owned roots, no parallel `entities[]` model, declared pipeline metadata, the single `actionData` boundary, and repository exclusions for ZIP/fixture folders.
- `validate_action_contract.py`: only current researcher-facing Actions, explicit target/context/result/effect/guards/execution contracts, bounded AI steps and valid semantic result steps.
- `validate_state_contract.py`: state ownership and persistence boundaries, including canonical transient UI state under `state.ui` and `ui.*` Action bindings.
- `validate_ui_contract.py`: routes/UI references agree with runtime, UI Kit and the LabFlow UI skill; it also guards workspace-start navigation, retired compatibility selectors and sub-10px literal UI type.
- `validate_privacy_contract.py`: local-first assets/provider transport and no tracker APIs.

The unit suite includes architecture regressions for `DomainSchema`, persistence snapshots, `DerivedState`, `ActionData`, CanonicalStore purity and DataPipeline plan/trace separation. The real JV fixture also verifies the stable hierarchy `5 experiments → 31 samples → 42 runs → 72 measurements` through repeated deterministic refreshes.

## Dataset fixtures

`TEST_DATA/` is local test material and is intentionally ignored by Git. The main real fixture is `TEST_DATA/2026_01_22.zip`; synthetic fixtures cover clean, damaged, duplicate-name and large-dataset behavior.

## Browser smoke test

Serve locally with any ordinary static server, for example:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Live provider checks remain separate because they require user credentials, provider availability and browser/network permission. They call the exact endpoint visible in Settings and never participate in scientific validation. Hosted providers that do not permit browser CORS cannot be made reachable by the static LabFlow frontend.

Then run:

```bash
python tools/test_responsive_browser.py
```

Live AI calls are intentionally excluded from the default validation suite because they require user credentials/provider availability and consume external quota.
