#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

printf 'Generating derived assets...\n'
python3 tools/build_prompt_bundle.py >/dev/null
python3 tools/build_action_registry.py >/dev/null
python3 tools/build_knowledge_bundle.py >/dev/null
python3 tools/build_docs_bundle.py >/dev/null
python3 tools/build_ui_kit_inline.py >/dev/null

printf 'Running contracts...\n'
python3 tools/validate_action_contract.py
python3 tools/validate_architecture_contract.py
python3 tools/validate_state_contract.py
python3 tools/validate_ui_contract.py
python3 tools/validate_privacy_contract.py
python3 tools/validate_source_hygiene.py
python3 tools/audit_css_contract.py

if command -v node >/dev/null 2>&1; then
  printf 'Checking JavaScript syntax...\n'
  find assets/js -type f -name '*.js' -print0 | xargs -0 -n1 node --check

  printf 'Building deterministic synthetic fixtures...\n'
  python3 tools/generate_synthetic_test_data.py >/dev/null
  mapfile -t TESTS < <(grep -L '2026_01_22\.zip' tests/unit/*-test.js | sort)
  printf 'Running %s self-contained unit suites...\n' "${#TESTS[@]}"
  node tests/unit/run.js "${TESTS[@]}"
  printf 'Private real-dataset integration suites are intentionally excluded from the distributable check.\n'
  rm -rf TEST_DATA
fi

printf '\nRelease checks completed successfully.\n'
