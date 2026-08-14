# Validation

Run before packaging:

```bash
python tools/build_prompt_bundle.py
python tools/build_action_registry.py
python tools/validate_action_contract.py
python tools/validate_privacy_contract.py
python tools/validate_state_contract.py
python tools/validate_ui_contract.py
node tests/unit/run.js $(find tests/unit -maxdepth 1 -name '*-test.js' -printf '%p ' | sort)
find assets vendor -name '*.js' -print0 | xargs -0 -n1 node --check
```

The validators enforce the current execution contract:

- only `Action` definitions are active; no ACTION registry/runner/workbench;
- Action types are `DETERMINISTIC`, `AI` or `HYBRID`, matching their declared steps;
- deterministic Actions contain no provider prompts;
- checkpoints advance automatically after success;
- one Action and at most one provider request run at a time;
- the user can stop a running Action and retry exactly the failed checkpoint;
- no automatic provider retry loop or background queue exists;
- provider output is closed by default;
- Markdown and JSON provider results use the common formatted renderer;
- AI request contexts are bounded and report collection coverage when truncated;
- initial route is Upload and RAW archive bytes remain immutable.

## Dataset fixtures

Use `TEST_DATA/01_PRECISO_PERFETTO_COMPLETO.zip` and `02_ROVINATO_SPORCO_TASKS.zip` for primary coverage. `03_MULTI_DEVICE_DUPLICATE_NAMES.zip` and `04_LARGE_DATASET.zip` cover path identity and bounded large-dataset behavior.

## Browser smoke test

Serve the repository with:

```bash
python tools/serve_static.py --port 8765
```

Then run:

```bash
python tools/test_responsive_browser.py
```

Live AI requests are intentionally not part of the default validation suite because they require a user-supplied provider key and consume external quota.
