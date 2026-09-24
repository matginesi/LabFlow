#!/usr/bin/env bash
# Reproducible distributable gate: generated artifacts, contracts, unit tests and a responsive browser audit.
# Private fixtures and live providers remain explicit optional evidence.
#
# Steps run in order and stop at the first failure. Every step is timed and the run
# ends with a summary, so a reviewer can see what ran, what was skipped and how long
# it took without reading the whole log.
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
  --full  additionally run the responsive browser audit against a local HTTP server

Steps run in order and stop at the first failure. Without --fix, stale generated
assets fail closed. Without --full, the browser audit is reported as skipped.
The run ends with a per-step timing summary; the exit status is the gate.
EOF
      exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo 'release_check: python3 is required.' >&2
  exit 3
fi
NODE_AVAILABLE=0
command -v node >/dev/null 2>&1 && NODE_AVAILABLE=1

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

DERIVED=(
  assets/js/ai/prompt-bundle.js
  assets/js/ai/action-registry.js
  assets/js/knowledge/kb-bundle.js
  docs/reference/ACTION_RUNTIME_MATRIX.md
  assets/js/pages/docs-bundle.js
  assets/js/pages/ui-kit-inline.js
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

STEP_INDEX=0
STEP_TOTAL=7
[[ "$NODE_AVAILABLE" -eq 1 ]] && STEP_TOTAL=$((STEP_TOTAL + 5))
[[ "$FULL" -eq 1 ]] && STEP_TOTAL=$((STEP_TOTAL + 1))
STEP_LABEL=""
STEP_START=0
STEP_NAMES=()
STEP_SECONDS=()
TOTAL_START=$SECONDS

on_error(){
  local status=$1
  if [[ -n "$STEP_LABEL" ]]; then
    printf '\nrelease_check: FAILED in step "%s" (exit %s)\n' "$STEP_LABEL" "$status" >&2
  else
    printf '\nrelease_check: FAILED (exit %s)\n' "$status" >&2
  fi
}
trap 'on_error $?' ERR

step(){
  STEP_LABEL="$1"
  STEP_INDEX=$((STEP_INDEX + 1))
  STEP_START=$SECONDS
  printf '\n[%d/%d] %s\n' "$STEP_INDEX" "$STEP_TOTAL" "$STEP_LABEL"
}
step_done(){
  local elapsed=$((SECONDS - STEP_START))
  STEP_NAMES+=("$STEP_LABEL")
  STEP_SECONDS+=("$elapsed")
  printf '        OK (%ss)\n' "$elapsed"
  STEP_LABEL=""
}
step_skip(){
  STEP_LABEL=""
  printf '        SKIPPED (%s)\n' "$1"
}

snapshot_derived(){
  local target="$1"
  : > "$target"
  for path in "${DERIVED[@]}"; do
    [[ -f "$path" ]] && sha256sum "$path" >> "$target" || printf 'MISSING  %s\n' "$path" >> "$target"
  done
}

print_banner(){
  local commit="n/a" dirty="" node_label="not found (JavaScript checks skipped)"
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    commit="$(git rev-parse --short HEAD 2>/dev/null || echo n/a)"
    if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then dirty=" (working tree dirty)"; fi
  fi
  [[ "$NODE_AVAILABLE" -eq 1 ]] && node_label="$(node --version 2>/dev/null || echo unknown)"
  printf 'LabFlow release check\n'
  printf '  mode    : %s\n' "$MODE"
  printf '  browser : %s\n' "$( [[ "$FULL" -eq 1 ]] && echo 'responsive audit requested' || echo 'not run (use --full)' )"
  printf '  started : %s\n' "$(date -Is 2>/dev/null || date)"
  printf '  commit  : %s%s\n' "$commit" "$dirty"
  printf '  python  : %s\n' "$(python3 --version 2>&1)"
  printf '  node    : %s\n' "$node_label"
  printf '  steps   : %s\n' "$STEP_TOTAL"
}
print_banner

snapshot_derived "$TMP/before.sha256"

step "Regenerate contract and documentation bundles"
python3 tools/build_prompt_bundle.py >/dev/null
python3 tools/build_action_registry.py >/dev/null
python3 tools/build_knowledge_bundle.py >/dev/null
python3 tools/build_action_reference.py >/dev/null
python3 tools/build_docs_bundle.py >/dev/null
step_done

# The cache revision is derived from generated bundles, so it is stamped only after
# they are regenerated; the UI Kit inline bundle is excluded from the revision and is
# rebuilt afterwards from the stamped ui-kit.html.
step "Build metadata stamped and current"
if [[ "$MODE" == "fix" ]]; then python3 tools/sync_build_metadata.py --write; else python3 tools/sync_build_metadata.py; fi
step_done

step "Regenerate UI Kit inline bundle"
python3 tools/build_ui_kit_inline.py >/dev/null
step_done

step "Generated assets are current"
snapshot_derived "$TMP/after.sha256"
if ! cmp -s "$TMP/before.sha256" "$TMP/after.sha256"; then
  if [[ "$MODE" != "fix" ]]; then
    printf '\nGenerated assets were stale. Run ./release_check.sh --fix, inspect the changes, then rerun the check.\n' >&2
    diff -u "$TMP/before.sha256" "$TMP/after.sha256" || true
    exit 1
  fi
  printf '        refreshed by --fix; re-run without --fix to verify\n'
fi
step_done

step "Build metadata consistency"
python3 tools/validate_build_consistency.py
step_done

step "Tooling syntax (tools/*.py, tools/*.js)"
python3 -m py_compile tools/*.py
if [[ "$NODE_AVAILABLE" -eq 1 ]]; then
  find tools -type f -name '*.js' -print0 | xargs -0 -r -n1 node --check
else
  printf '        python only: node not found\n'
fi
step_done

step "Source contracts"
python3 tools/validate_action_contract.py
python3 tools/validate_architecture_contract.py
python3 tools/validate_state_contract.py
python3 tools/validate_ui_contract.py
python3 tools/validate_privacy_contract.py
python3 tools/validate_source_hygiene.py
python3 tools/audit_css_contract.py
python3 tools/validate_dependency_layers.py
step_done

if [[ "$NODE_AVAILABLE" -eq 1 ]]; then
  step "JavaScript syntax (assets/js)"
  find assets/js -type f -name '*.js' -print0 | xargs -0 -r -n1 node --check
  step_done

  step "Deterministic synthetic fixtures"
  python3 tools/generate_synthetic_test_data.py >/dev/null
  mapfile -t TESTS < <(grep -L '2026_01_22\.zip' tests/unit/*-test.js | sort)
  printf '        %s self-contained unit suites\n' "${#TESTS[@]}"
  step_done

  step "Self-contained unit suites (${#TESTS[@]})"
  node tests/unit/run.js "${TESTS[@]}"
  step_done

  step "Import/workflow regression"
  node tests/regression/import-page-check.js
  printf '        private real-dataset integration suites excluded from the distributable check\n'
  step_done

  step "Structured-output regression"
  node tools/test_structured_json.js
  step_done
else
  printf '\nJavaScript steps skipped because node is unavailable.\n'
fi

if [[ "$FULL" -eq 1 ]]; then
  step "Responsive browser audit"
  python3 -m http.server 8765 --bind 127.0.0.1 >"$TMP/http.log" 2>&1 & SERVER_PID=$!
  ready=0
  for _ in {1..40}; do
    if curl -fsS http://127.0.0.1:8765/ >/dev/null 2>&1; then ready=1; break; fi
    sleep 0.1
  done
  if [[ "$ready" -ne 1 ]]; then
    printf '        local HTTP server did not become ready\n' >&2
    exit 1
  fi
  export LABFLOW_TEST_BASE_URL=http://127.0.0.1:8765
  python3 tools/test_responsive_browser.py
  step_done
else
  step_skip "responsive browser audit: use ./release_check.sh --full"
fi

printf '\nSummary\n'
if [[ "${#STEP_NAMES[@]}" -gt 0 ]]; then
  for index in "${!STEP_NAMES[@]}"; do
    printf '  %2d. %-44s %ss\n' "$((index + 1))" "${STEP_NAMES[$index]}" "${STEP_SECONDS[$index]}"
  done
fi
printf '      %-44s %ss\n' 'total' "$((SECONDS - TOTAL_START))"
if [[ "$NODE_AVAILABLE" -ne 1 ]]; then
  printf '  note: JavaScript syntax, unit suites and regressions were skipped (node not found).\n'
fi
if [[ "$FULL" -ne 1 ]]; then
  printf '  note: responsive browser audit was skipped (use --full).\n'
fi
printf '\nRelease checks completed successfully.\n'
