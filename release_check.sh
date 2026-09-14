#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
MODE="check"
FULL=0
for arg in "$@"; do
  case "$arg" in
    --fix) MODE="fix" ;;
    --full) FULL=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: ./release_check.sh [--fix] [--full]

  --fix   regenerate derived assets and accept the generated result
  --full  additionally run browser regressions against a local HTTP server

Without --fix, stale generated assets fail closed. Without --full, browser
regressions are not run and the check says so explicitly.
EOF
      exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done
TMP="$(mktemp -d)"
SERVER_PID=""
TEST_DATA_EXISTED=0
[[ -d TEST_DATA ]] && TEST_DATA_EXISTED=1
SYNTHETIC_FIXTURES=(
  01_PRECISO_PERFETTO_COMPLETO.zip
  02_ROVINATO_SPORCO_OPERATIONS.zip
  03_MULTI_DEVICE_DUPLICATE_NAMES.zip
  04_LARGE_DATASET.zip
)

backup_synthetic_fixtures(){
  mkdir -p "$TMP/test-data-backup"
  for name in "${SYNTHETIC_FIXTURES[@]}"; do
    if [[ -f "TEST_DATA/$name" ]]; then
      cp -p "TEST_DATA/$name" "$TMP/test-data-backup/$name"
      printf '%s\n' "$name" >> "$TMP/preexisting-synthetic.txt"
    fi
  done
}

restore_synthetic_fixtures(){
  for name in "${SYNTHETIC_FIXTURES[@]}"; do
    if [[ -f "$TMP/test-data-backup/$name" ]]; then
      mkdir -p TEST_DATA
      cp -p "$TMP/test-data-backup/$name" "TEST_DATA/$name"
    else
      rm -f "TEST_DATA/$name"
    fi
  done
  if [[ "$TEST_DATA_EXISTED" -eq 0 ]] && [[ -d TEST_DATA ]] && [[ -z "$(find TEST_DATA -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    rmdir TEST_DATA 2>/dev/null || true
  fi
}

cleanup(){
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  restore_synthetic_fixtures
  rm -rf "$TMP"
}
backup_synthetic_fixtures
trap cleanup EXIT

DERIVED=(
  assets/js/ai/prompt-bundle.js
  assets/js/ai/action-registry.js
  assets/js/knowledge/kb-bundle.js
  assets/js/pages/docs-bundle.js
  assets/js/pages/ui-kit-inline.js
)
for path in "${DERIVED[@]}"; do
  [[ -f "$path" ]] && sha256sum "$path" >> "$TMP/before.sha256" || printf 'MISSING  %s\n' "$path" >> "$TMP/before.sha256"
done

printf 'Checking release metadata...\n'
if [[ "$MODE" == "fix" ]]; then python3 tools/sync_build_metadata.py --write; else python3 tools/sync_build_metadata.py; fi

printf 'Regenerating derived assets...\n'
python3 tools/build_prompt_bundle.py >/dev/null
python3 tools/build_action_registry.py >/dev/null
python3 tools/build_knowledge_bundle.py >/dev/null
python3 tools/build_docs_bundle.py >/dev/null
python3 tools/build_ui_kit_inline.py >/dev/null
for path in "${DERIVED[@]}"; do
  [[ -f "$path" ]] && sha256sum "$path" >> "$TMP/after.sha256" || printf 'MISSING  %s\n' "$path" >> "$TMP/after.sha256"
done
if ! cmp -s "$TMP/before.sha256" "$TMP/after.sha256"; then
  if [[ "$MODE" != "fix" ]]; then
    echo 'Generated assets were stale. Run ./release_check.sh --fix, inspect the changes, then rerun the check.' >&2
    diff -u "$TMP/before.sha256" "$TMP/after.sha256" || true
    exit 1
  fi
  printf 'Generated assets refreshed (--fix).\n'
fi
python3 tools/validate_build_consistency.py

printf 'Running contracts...\n'
python3 tools/validate_action_contract.py
python3 tools/validate_architecture_contract.py
python3 tools/validate_state_contract.py
python3 tools/validate_ui_contract.py
python3 tools/validate_privacy_contract.py
python3 tools/validate_source_hygiene.py
python3 tools/audit_css_contract.py
python3 tools/validate_dependency_layers.py

if command -v node >/dev/null 2>&1; then
  printf 'Checking JavaScript syntax...\n'
  find assets/js -type f -name '*.js' -print0 | xargs -0 -n1 node --check

  printf 'Building deterministic synthetic fixtures...\n'
  python3 tools/generate_synthetic_test_data.py >/dev/null
  mapfile -t TESTS < <(grep -L '2026_01_22\.zip' tests/unit/*-test.js | sort)
  printf 'Running %s self-contained unit suites...\n' "${#TESTS[@]}"
  node tests/unit/run.js "${TESTS[@]}"
  printf 'Running self-contained import/workflow regression...\n'
  node tests/regression/import-page-check.js
  printf 'Private real-dataset integration suites are intentionally excluded from the distributable check.\n'
fi

if [[ "$FULL" -eq 1 ]]; then
  printf 'Running browser regressions...\n'
  python3 -m http.server 8765 --bind 127.0.0.1 >"$TMP/http.log" 2>&1 & SERVER_PID=$!
  for _ in {1..40}; do curl -fsS http://127.0.0.1:8765/ >/dev/null 2>&1 && break; sleep 0.1; done
  export LABFLOW_TEST_BASE_URL=http://127.0.0.1:8765
  python3 tools/test_responsive_browser.py
  python3 tests/regression/action-state-propagation-browser.py
  python3 tests/regression/assistant-chat-browser.py http://127.0.0.1:8765
  python3 tests/regression/assistant-chat-lifecycle-browser.py
  python3 tests/regression/message-totem-browser.py
else
  printf 'BROWSER TESTS: NOT RUN (use ./release_check.sh --full).\n'
fi

printf '\nRelease checks completed successfully.\n'
