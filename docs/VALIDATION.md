---
title: Validation and release gates
section: Engineering reference
summary: Required checks for logic, generated artifacts, UI, source hygiene and distribution.
order: 40
---

# Validation and release gates

Validation is layered so deterministic scientific behavior is checked independently from optional provider behavior.

## Main commands

```bash
node tests/unit/run.js
./release_check.sh
./release_check.sh --help
```

After source changes that affect generated assets:

```bash
./release_check.sh --fix
./release_check.sh
```

Use the full browser audit when the environment can launch/navigate a local page:

```bash
./release_check.sh --full
```

## Release gate behavior

`release_check.sh` prints an environment banner (mode, commit and dirty state, tool versions, step count), runs numbered steps with per-step timing, stops at the first failure with the failing step named on stderr, and ends with a summary that lists every step, its duration, the total time and what was skipped. The exit status is the gate; `--help` documents the flags.

Step order matters for the asset cache revision: the contract/documentation bundles are regenerated **first**, the revision is then stamped from those regenerated sources, and the UI Kit inline bundle is rebuilt **last** from the stamped `ui-kit.html`. Stamping before regeneration would leave the revision describing a tree that no longer exists, so a `--fix` run followed by a plain check would fail.

The gate also compiles `tools/*.py` and syntax-checks `tools/*.js`, and runs the structured-output parser regression (`tools/test_structured_json.js`) alongside the unit suites. When `node` is unavailable those steps are reported as skipped instead of silently passing.

## Asset cache revision

`assets/js/build-info.js` owns `LABFLOW_VERSION` (human release label), `LABFLOW_BUILD` (human build label) and `LABFLOW_ASSET_REV`. The revision is a deterministic hash of `index.html`, `ui-kit.html`, the CSS and the authored JavaScript, excluding `build-info.js` and the generated `ui-kit-inline.js` (which embeds a hash of `ui-kit.html`). `tools/sync_build_metadata.py` stamps it into every `?v=` query in `index.html`/`ui-kit.html`, so any source change produces a new cache key and browsers fetch fresh CSS/JS once they receive the new HTML.

```bash
python3 tools/sync_build_metadata.py --write   # stamp (also run by ./release_check.sh --fix)
python3 tools/sync_build_metadata.py           # verify
```

`release_check.sh` fails closed when the revision is stale, so a release that changed code but not the stamp is rejected.

## GitHub Pages deployment and cache

There is no GitHub Actions workflow in this repository. `https://matginesi.github.io/LabFlow/` is published from the `main` branch root by GitHub Pages, so every push to `main` deploys automatically after the Pages build. GitHub Pages serves HTML and assets with `Cache-Control: max-age=600`, so a new deployment can take a few minutes to reach a returning visitor even though the deploy itself is immediate.

Settings → About shows Version, Build and the Assets revision, and provides **Reload latest build**, which reloads with a changing query string to bypass the HTML cache and load the newest `?v=` assets.

## What the gate checks

- source/architecture ownership;
- Action manifests, guards and generated registry;
- prompt bundle consistency;
- Knowledge Base schema/bundle consistency;
- documentation and UI Kit generated assets;
- source hygiene/readability;
- tooling syntax (`tools/*.py` compiled, `tools/*.js` syntax-checked);
- deterministic pipeline/import regressions and the structured-output parser regression;
- UI contracts and responsive/browser checks where available;
- distribution structure.

The gate stops at the first failure and names the failing step, so a red run points at one boundary instead of an unattributed exit code.

## Generated files

Do not patch generated artifacts to make a test pass. Change their source, rebuild, then verify. Important generated files include Action registry/prompt bundle, KB bundle, docs bundle, UI Kit inline bundle and Action runtime matrix.

## Provider failure tests

Some unit suites intentionally simulate network/provider/rate-limit/error paths and therefore emit warning/error log lines. A logged simulated error is not a failed test; the suite exit status and assertions are authoritative.

## Test fixtures

`TEST_DATA/` is retained as regression evidence and must not be removed by cleanup. Existing archive fixtures are also retained when packaging a release.
