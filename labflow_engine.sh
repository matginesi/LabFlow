#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
#  LLAMA.CPP NEXT-GEN LAUNCHER
# ==============================================================================

SCRIPT_NAME="$(basename "$0")"

# ------------------------------------------------------------------------------
# Style & Colors (Modern Palette)
# ------------------------------------------------------------------------------
if [[ -t 1 && "${TERM:-}" != "dumb" ]]; then
    RESET=$'\033[0m'
    BOLD=$'\033[1m'
    DIM=$'\033[2m'
    ITALIC=$'\033[3m'
    UNDERLINE=$'\033[4m'

    # Palette True Color / ANSI 256
    C_PRIMARY=$'\033[38;2;147;112;219m'  # Deep Purple / Orchid
    C_ACCENT=$'\033[38;2;0;229;255m'     # Electric Cyan
    C_SUCCESS=$'\033[38;2;0;230;118m'    # Emerald Green
    C_WARN=$'\033[38;2;255;171;0m'       # Amber
    C_ERROR=$'\033[38;2;255;23;68m'      # Neon Red
    C_MUTED=$'\033[38;2;120;144;156m'    # Slate Gray
else
    RESET='' BOLD='' DIM='' ITALIC='' UNDERLINE=''
    C_PRIMARY='' C_ACCENT='' C_SUCCESS='' C_WARN='' C_ERROR='' C_MUTED=''
fi

# ------------------------------------------------------------------------------
# Defaults
# ------------------------------------------------------------------------------
MODEL_PATH="$HOME/.lmstudio/models/lmstudio-community/NVIDIA-Nemotron-3-Nano-4B-GGUF/NVIDIA-Nemotron-3-Nano-4B-Q4_K_M.gguf"
LLAMA_SERVER="$HOME/llama.cpp/build/bin/llama-server"

CTX_SIZE=65536
PARALLEL=1
GPU_LAYERS=99

FLASH_ATTN="on"
CACHE_K="q4_0"
CACHE_V="q4_0"
JINJA=true
CHAT_TEMPLATE=""
CHAT_TEMPLATE_FILE=""
CHAT_TEMPLATE_HF_REPO=""
CHAT_TEMPLATE_HF_FILE="chat_template.jinja"
AUTO_CHAT_TEMPLATE=true
CHAT_TEMPLATE_SOURCE="GGUF tokenizer.chat_template / llama.cpp fallback"

# Leave these empty by default so the launcher does not override llama.cpp.
# This lets clients such as LabFlow choose reasoning per request.
REASONING_MODE=""
REASONING_BUDGET=""
REASONING_FORMAT=""
REASONING_FORMAT_SOURCE="server auto"

HOST="127.0.0.1"
PORT=8080
TIMEOUT=600
SSE_PING_INTERVAL=15

METRICS=true
VERBOSE=true

TEMP=""
TOP_P=""
MIN_P=""

DRY_RUN=false
EXTRA_ARGS=()

# ------------------------------------------------------------------------------
# UI Components
# ------------------------------------------------------------------------------
banner() {
    printf '\n'
    printf '  %s┌─────────────────────────────────────────────────────────────┐%s\n' "$C_PRIMARY" "$RESET"
    printf '  %s│%s  %s%s⚡ LLAMA.CPP ENGINE LAUNCHER%s                               %s│%s\n' "$C_PRIMARY" "$RESET" "$BOLD" "$C_ACCENT" "$RESET" "$C_PRIMARY" "$RESET"
    printf '  %s│%s  %sModel launcher:%s llama-server                               %s│%s\n' "$C_PRIMARY" "$RESET" "$DIM" "$RESET" "$C_PRIMARY" "$RESET"
    printf '  %s└─────────────────────────────────────────────────────────────┘%s\n\n' "$C_PRIMARY" "$RESET"
}

info_badge() {
    local label="$1"
    local val="$2"
    printf '  %s%-18s%s %s%s%s\n' "$C_MUTED" "$label" "$RESET" "$BOLD" "$val" "$RESET"
}

log_step() {
    printf '  %s[●]%s %s...\n' "$C_ACCENT" "$RESET" "$1"
}

log_success() {
    printf '  %s[✓]%s %s\n' "$C_SUCCESS" "$RESET" "$1"
}

log_error() {
    printf '  %s[✗]%s %s\n' "$C_ERROR" "$RESET" "$1" >&2
}

die() {
    printf '\n'
    log_error "$*"
    printf '\n  %sRun %s%s --help%s %sfor detailed parameter guidelines.%s\n\n' "$C_MUTED" "$BOLD" "$SCRIPT_NAME" "$RESET" "$C_MUTED" "$RESET" >&2
    exit 1
}

need_val() {
    [[ -n "${2-}" && "${2-}" != -* ]] || die "Option '$1' requires a valid non-empty argument."
}

# ------------------------------------------------------------------------------
# Documentation Menu
# ------------------------------------------------------------------------------
usage() {
    banner
    cat <<EOF
${BOLD}USAGE:${RESET}
  ${C_ACCENT}$SCRIPT_NAME${RESET} [FLAGS] [OPTIONS]
  ${C_ACCENT}$SCRIPT_NAME${RESET} [OPTIONS] ${C_MUTED}--${RESET} [RAW LLAMA-SERVER ARGS]

${BOLD}CORE OPTIONS:${RESET}
  ${C_SUCCESS}-m, --model${RESET} ${C_MUTED}<PATH>${RESET}         Path to GGUF model file
  ${C_SUCCESS}-s, --server${RESET} ${C_MUTED}<PATH>${RESET}        Path to llama-server binary
  ${C_SUCCESS}-c, --ctx-size${RESET} ${C_MUTED}<N>${RESET}        Context window size (default: 65536)
  ${C_SUCCESS}-np, --parallel${RESET} ${C_MUTED}<N>${RESET}       Parallel execution slots (default: 1)
  ${C_SUCCESS}-ngl, --gpu-layers${RESET} ${C_MUTED}<N>${RESET}    Offloaded GPU layers (default: 99)

${BOLD}MEMORY & ATTENTION:${RESET}
  ${C_SUCCESS}--flash-attn${RESET} ${C_MUTED}<MODE>${RESET}       Flash Attention: on | off | auto (default: on)
  ${C_SUCCESS}--cache-k${RESET} ${C_MUTED}<TYPE>${RESET}         KV cache K quantization (default: q4_0)
  ${C_SUCCESS}--cache-v${RESET} ${C_MUTED}<TYPE>${RESET}         KV cache V quantization (default: q4_0)

${BOLD}SAMPLING (OPTIONAL):${RESET}
  ${C_SUCCESS}--temp${RESET} ${C_MUTED}<FLOAT>${RESET}            Temperature inference parameter
  ${C_SUCCESS}--top-p${RESET} ${C_MUTED}<FLOAT>${RESET}           Top-P Nucleus sampling
  ${C_SUCCESS}--min-p${RESET} ${C_MUTED}<FLOAT>${RESET}           Min-P sampling threshold

${BOLD}NETWORK & SERVER:${RESET}
  ${C_SUCCESS}-H, --host${RESET} ${C_MUTED}<IP>${RESET}           Server IP binding address (default: 127.0.0.1)
  ${C_SUCCESS}-p, --port${RESET} ${C_MUTED}<PORT>${RESET}        Server HTTP listening port (default: 8080)
  ${C_SUCCESS}--timeout${RESET} ${C_MUTED}<SEC>${RESET}          HTTP request timeout limit (default: 600)
  ${C_SUCCESS}--jinja / --no-jinja${RESET}     Toggle Jinja chat template engine (default: ON)

${BOLD}CHAT TEMPLATE:${RESET}
  ${C_SUCCESS}--chat-template${RESET} ${C_MUTED}<VALUE>${RESET}    Force a llama.cpp built-in template name or raw Jinja
  ${C_SUCCESS}--chat-template-file${RESET} ${C_MUTED}<PATH>${RESET} Use an external Jinja template file
  ${C_SUCCESS}--chat-template-hf${RESET} ${C_MUTED}<REPO>${RESET}    Fetch/reuse a template from a Hugging Face model repo
  ${C_SUCCESS}--chat-template-hf-file${RESET} ${C_MUTED}<FILE>${RESET}
                                      File inside the HF repo (default: chat_template.jinja)
  ${C_SUCCESS}--auto-chat-template${RESET}       Auto-use a template file next to the GGUF (default: ON)
  ${C_SUCCESS}--no-auto-chat-template${RESET}    Disable local template auto-discovery

  ${C_MUTED}Resolution order:${RESET}
    ${C_MUTED}1. --chat-template-file${RESET}
    ${C_MUTED}2. --chat-template${RESET}
    ${C_MUTED}3. --chat-template-hf${RESET}
    ${C_MUTED}4. local template next to the GGUF${RESET}
    ${C_MUTED}5. tokenizer.chat_template embedded in GGUF${RESET}
    ${C_MUTED}6. llama.cpp fallback${RESET}

${BOLD}REASONING / THINKING (OPTIONAL):${RESET}
  ${C_SUCCESS}--reasoning${RESET} ${C_MUTED}<MODE>${RESET}         llama.cpp reasoning mode: on | off | auto
  ${C_SUCCESS}--reasoning-budget${RESET} ${C_MUTED}<N>${RESET}     Thinking token budget; 0 ends reasoning immediately
  ${C_SUCCESS}--reasoning-format${RESET} ${C_MUTED}<FORMAT>${RESET} Response reasoning parser format
  ${C_SUCCESS}--no-thinking${RESET}              Convenience: --reasoning off --reasoning-budget 0

  ${C_MUTED}Tip: for LabFlow, normally leave reasoning unset here and let LabFlow control it per request.${RESET}
  ${C_MUTED}If the selected Jinja contains <think>...</think>, the launcher automatically uses --reasoning-format deepseek.${RESET}

${BOLD}PROFILES & UTILITIES:${RESET}
  ${C_SUCCESS}--profile-max${RESET}            Preset: 128k Context, Full GPU, max-speed KV
  ${C_SUCCESS}--dry-run${RESET}                Simulate setup and output executable command
  ${C_SUCCESS}-h, --help${RESET}               Display this interface

${BOLD}EXAMPLES:${RESET}
  ${C_MUTED}# Run custom model on default server${RESET}
  ${C_ACCENT}./$SCRIPT_NAME -m ~/models/mistral.gguf${RESET}

  ${C_MUTED}# Force a built-in fallback template${RESET}
  ${C_ACCENT}./$SCRIPT_NAME -m ~/models/model.gguf --chat-template chatml${RESET}

  ${C_MUTED}# Use the model vendor's exact Jinja template (recommended when GGUF metadata is missing/wrong)${RESET}
  ${C_ACCENT}./$SCRIPT_NAME -m ~/models/model.gguf --chat-template-file ~/templates/chat_template.jinja${RESET}

  ${C_MUTED}# LFM2.5: use LiquidAI's official template from Hugging Face${RESET}
  ${C_ACCENT}./$SCRIPT_NAME -m ~/models/LFM2.5-8B-A1B-Q4_K_M.gguf \\${RESET}
  ${C_ACCENT}  --chat-template-hf LiquidAI/LFM2.5-8B-A1B${RESET}

  ${C_MUTED}# Force thinking off at server level (usually NOT needed with LabFlow)${RESET}
  ${C_ACCENT}./$SCRIPT_NAME -m ~/models/model.gguf --no-thinking${RESET}

  ${C_MUTED}# Multi-slot inference with custom sampling passed downstream${RESET}
  ${C_ACCENT}./$SCRIPT_NAME -c 32768 -np 4 -- --temp 0.2 --repeat-penalty 1.1${RESET}

EOF
}

# ------------------------------------------------------------------------------
# Argument Parser Engine
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -m|--model)
            need_val "$1" "${2-}"
            MODEL_PATH="$2"
            shift 2
            ;;
        -s|--server)
            need_val "$1" "${2-}"
            LLAMA_SERVER="$2"
            shift 2
            ;;
        -c|--ctx-size)
            need_val "$1" "${2-}"
            CTX_SIZE="$2"
            shift 2
            ;;
        -np|--parallel)
            need_val "$1" "${2-}"
            PARALLEL="$2"
            shift 2
            ;;
        -ngl|--gpu-layers)
            need_val "$1" "${2-}"
            GPU_LAYERS="$2"
            shift 2
            ;;
        --flash-attn)
            need_val "$1" "${2-}"
            FLASH_ATTN="$2"
            shift 2
            ;;
        --cache-k)
            need_val "$1" "${2-}"
            CACHE_K="$2"
            shift 2
            ;;
        --cache-v)
            need_val "$1" "${2-}"
            CACHE_V="$2"
            shift 2
            ;;
        --temp)
            need_val "$1" "${2-}"
            TEMP="$2"
            shift 2
            ;;
        --top-p)
            need_val "$1" "${2-}"
            TOP_P="$2"
            shift 2
            ;;
        --min-p)
            need_val "$1" "${2-}"
            MIN_P="$2"
            shift 2
            ;;
        -H|--host)
            need_val "$1" "${2-}"
            HOST="$2"
            shift 2
            ;;
        -p|--port)
            need_val "$1" "${2-}"
            PORT="$2"
            shift 2
            ;;
        --jinja)
            JINJA=true
            shift
            ;;
        --no-jinja)
            JINJA=false
            shift
            ;;
        --chat-template)
            need_val "$1" "${2-}"
            CHAT_TEMPLATE="$2"
            CHAT_TEMPLATE_FILE=""
            CHAT_TEMPLATE_HF_REPO=""
            JINJA=true
            shift 2
            ;;
        --chat-template-file)
            need_val "$1" "${2-}"
            CHAT_TEMPLATE_FILE="$2"
            CHAT_TEMPLATE=""
            CHAT_TEMPLATE_HF_REPO=""
            JINJA=true
            shift 2
            ;;
        --chat-template-hf)
            need_val "$1" "${2-}"
            CHAT_TEMPLATE_HF_REPO="$2"
            CHAT_TEMPLATE=""
            CHAT_TEMPLATE_FILE=""
            JINJA=true
            shift 2
            ;;
        --chat-template-hf-file)
            need_val "$1" "${2-}"
            CHAT_TEMPLATE_HF_FILE="$2"
            shift 2
            ;;
        --auto-chat-template)
            AUTO_CHAT_TEMPLATE=true
            shift
            ;;
        --no-auto-chat-template)
            AUTO_CHAT_TEMPLATE=false
            shift
            ;;
        --reasoning)
            need_val "$1" "${2-}"
            REASONING_MODE="$2"
            shift 2
            ;;
        --reasoning-budget)
            need_val "$1" "${2-}"
            REASONING_BUDGET="$2"
            shift 2
            ;;
        --reasoning-format)
            need_val "$1" "${2-}"
            REASONING_FORMAT="$2"
            REASONING_FORMAT_SOURCE="explicit CLI"
            shift 2
            ;;
        --no-thinking)
            REASONING_MODE="off"
            REASONING_BUDGET="0"
            shift
            ;;
        --metrics)
            METRICS=true
            shift
            ;;
        --no-metrics)
            METRICS=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --no-verbose)
            VERBOSE=false
            shift
            ;;
        --profile-max)
            CTX_SIZE=131072
            PARALLEL=2
            GPU_LAYERS=99
            FLASH_ATTN="on"
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --)
            shift
            EXTRA_ARGS+=("$@")
            break
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# ------------------------------------------------------------------------------
# Pre-Flight Sanitization Checks
# ------------------------------------------------------------------------------
banner

log_step "Running system and binary checks"

[[ -x "$LLAMA_SERVER" ]] || die "Executable binary not found or permissions missing:\n    $LLAMA_SERVER"
[[ -f "$MODEL_PATH" ]] || die "Target model file does not exist at specified path:\n    $MODEL_PATH"

# Read llama-server help once. We use it only to validate optional features
# requested by the user, so an older local build fails clearly instead of
# silently ignoring an option.
LLAMA_SERVER_HELP="$("$LLAMA_SERVER" --help 2>&1 || true)"

server_supports() {
    grep -Fq -- "$1" <<<"$LLAMA_SERVER_HELP"
}

# Chat-template resolution.
#
# IMPORTANT:
# If no override is selected we deliberately pass NO --chat-template option.
# llama.cpp then uses tokenizer.chat_template embedded in the GGUF metadata.
# That is preferable to forcing ChatML or another generic template.
MODEL_DIR="$(dirname "$MODEL_PATH")"
MODEL_FILE="$(basename "$MODEL_PATH")"
MODEL_STEM="${MODEL_FILE%.gguf}"

if [[ -n "$CHAT_TEMPLATE_FILE" ]]; then
    [[ -f "$CHAT_TEMPLATE_FILE" ]] || die "Chat template file does not exist:\n    $CHAT_TEMPLATE_FILE"
    CHAT_TEMPLATE_FILE="$(realpath "$CHAT_TEMPLATE_FILE")"
    CHAT_TEMPLATE_SOURCE="file: $CHAT_TEMPLATE_FILE"

elif [[ -n "$CHAT_TEMPLATE" ]]; then
    CHAT_TEMPLATE_SOURCE="override: $CHAT_TEMPLATE"

elif [[ -n "$CHAT_TEMPLATE_HF_REPO" ]]; then
    command -v hf >/dev/null 2>&1 || die "The 'hf' CLI is required by --chat-template-hf."

    log_step "Resolving chat template from Hugging Face: $CHAT_TEMPLATE_HF_REPO/$CHAT_TEMPLATE_HF_FILE"

    if ! CHAT_TEMPLATE_FILE="$(
        hf download "$CHAT_TEMPLATE_HF_REPO" "$CHAT_TEMPLATE_HF_FILE" --quiet
    )"; then
        die "Unable to download '$CHAT_TEMPLATE_HF_FILE' from '$CHAT_TEMPLATE_HF_REPO'."
    fi

    [[ -f "$CHAT_TEMPLATE_FILE" ]] || die "Hugging Face returned an invalid template path:\n    $CHAT_TEMPLATE_FILE"
    CHAT_TEMPLATE_FILE="$(realpath "$CHAT_TEMPLATE_FILE")"
    CHAT_TEMPLATE_SOURCE="HF: $CHAT_TEMPLATE_HF_REPO/$CHAT_TEMPLATE_HF_FILE"

elif [[ "$AUTO_CHAT_TEMPLATE" == true && "$JINJA" == true ]]; then
    # Prefer a canonical vendor template, but support useful sidecar names too.
    for candidate in \
        "$MODEL_DIR/chat_template.jinja" \
        "$MODEL_DIR/chat-template.jinja" \
        "$MODEL_DIR/${MODEL_STEM}.jinja" \
        "$MODEL_DIR/${MODEL_FILE}.jinja" \
        "$MODEL_DIR/template.jinja"; do
        if [[ -f "$candidate" ]]; then
            CHAT_TEMPLATE_FILE="$(realpath "$candidate")"
            CHAT_TEMPLATE_SOURCE="auto file: $CHAT_TEMPLATE_FILE"
            break
        fi
    done
fi

if [[ "$JINJA" != true && ( -n "$CHAT_TEMPLATE" || -n "$CHAT_TEMPLATE_FILE" || -n "$CHAT_TEMPLATE_HF_REPO" ) ]]; then
    die "A chat template override requires Jinja. Remove --no-jinja or remove the template override."
fi

if [[ -n "$CHAT_TEMPLATE_FILE" ]]; then
    server_supports "--chat-template-file" || die "This llama-server build does not support --chat-template-file. Update/rebuild llama.cpp."
    [[ -s "$CHAT_TEMPLATE_FILE" ]] || die "Chat template file is empty:\n    $CHAT_TEMPLATE_FILE"

    # Catch accidental HTML/error pages and obviously wrong files early.
    if ! grep -Eq '\{\{|\{%' "$CHAT_TEMPLATE_FILE"; then
        die "The selected chat template does not look like Jinja:\n    $CHAT_TEMPLATE_FILE"
    fi
fi

# If the selected Jinja explicitly uses <think>...</think>, ask llama.cpp to
# split reasoning into message.reasoning_content instead of leaking the tags into
# message.content. This fixes LFM2.5 and other DeepSeek-style templates without
# hard-coding a model name. An explicit --reasoning-format always wins.
if [[ -z "$REASONING_FORMAT" ]]; then
    TEMPLATE_USES_THINK=false
    if [[ -n "$CHAT_TEMPLATE_FILE" ]] && grep -Fq '<think>' "$CHAT_TEMPLATE_FILE" && grep -Fq '</think>' "$CHAT_TEMPLATE_FILE"; then
        TEMPLATE_USES_THINK=true
    elif [[ -n "$CHAT_TEMPLATE" ]] && [[ "$CHAT_TEMPLATE" == *'<think>'* ]] && [[ "$CHAT_TEMPLATE" == *'</think>'* ]]; then
        TEMPLATE_USES_THINK=true
    fi
    if [[ "$TEMPLATE_USES_THINK" == true ]]; then
        REASONING_FORMAT="deepseek"
        REASONING_FORMAT_SOURCE="auto from <think> template"
    fi
fi

if [[ -n "$CHAT_TEMPLATE" ]]; then
    server_supports "--chat-template" || die "This llama-server build does not support --chat-template."
fi

[[ "$CTX_SIZE" =~ ^[0-9]+$ ]] || die "Context size must be an integer: '$CTX_SIZE'"
[[ "$PARALLEL" =~ ^[0-9]+$ ]] || die "Parallel slots parameter must be an integer: '$PARALLEL'"
[[ "$GPU_LAYERS" =~ ^[0-9]+$ ]] || die "GPU offload layers must be an integer: '$GPU_LAYERS'"
[[ "$PORT" =~ ^[0-9]+$ ]] || die "Network port must be a numerical value: '$PORT'"

case "$FLASH_ATTN" in
    on|off|auto) ;;
    *) die "Flash attention state invalid. Expected: 'on', 'off', or 'auto'." ;;
esac

if [[ -n "$REASONING_MODE" ]]; then
    case "$REASONING_MODE" in
        on|off|auto) ;;
        *) die "Reasoning mode invalid. Expected: 'on', 'off', or 'auto'." ;;
    esac
    server_supports "--reasoning" || die "This llama-server build does not support --reasoning. Update/rebuild llama.cpp or omit the option."
fi

if [[ -n "$REASONING_BUDGET" ]]; then
    [[ "$REASONING_BUDGET" =~ ^-?[0-9]+$ ]] || die "Reasoning budget must be an integer: '$REASONING_BUDGET'"
    server_supports "--reasoning-budget" || die "This llama-server build does not support --reasoning-budget. Update/rebuild llama.cpp or omit the option."
fi

if [[ -n "$REASONING_FORMAT" ]]; then
    server_supports "--reasoning-format" || die "This llama-server build does not support --reasoning-format. Update/rebuild llama.cpp or omit the option."
fi

log_success "Environment pre-flight checks passed"

# ------------------------------------------------------------------------------
# Command Array Assembly
# ------------------------------------------------------------------------------
CMD=(
    "$LLAMA_SERVER"
    --model "$MODEL_PATH"
    --ctx-size "$CTX_SIZE"
    --parallel "$PARALLEL"
    --n-gpu-layers "$GPU_LAYERS"
    --flash-attn "$FLASH_ATTN"
    --cache-type-k "$CACHE_K"
    --cache-type-v "$CACHE_V"
    --host "$HOST"
    --port "$PORT"
    --timeout "$TIMEOUT"
    --sse-ping-interval "$SSE_PING_INTERVAL"
)

[[ "$JINJA" == true ]] && CMD+=(--jinja)
[[ -n "$CHAT_TEMPLATE" ]] && CMD+=(--chat-template "$CHAT_TEMPLATE")
[[ -n "$CHAT_TEMPLATE_FILE" ]] && CMD+=(--chat-template-file "$CHAT_TEMPLATE_FILE")

[[ -n "$REASONING_MODE" ]] && CMD+=(--reasoning "$REASONING_MODE")
[[ -n "$REASONING_BUDGET" ]] && CMD+=(--reasoning-budget "$REASONING_BUDGET")
[[ -n "$REASONING_FORMAT" ]] && CMD+=(--reasoning-format "$REASONING_FORMAT")

[[ "$METRICS" == true ]] && CMD+=(--metrics)
[[ "$VERBOSE" == true ]] && CMD+=(--verbose)

[[ -n "$TEMP" ]] && CMD+=(--temp "$TEMP")
[[ -n "$TOP_P" ]] && CMD+=(--top-p "$TOP_P")
[[ -n "$MIN_P" ]] && CMD+=(--min-p "$MIN_P")

CMD+=("${EXTRA_ARGS[@]}")

# ------------------------------------------------------------------------------
# Configuration Dashboard Output
# ------------------------------------------------------------------------------
printf '\n  %s%sENGINE CONFIGURATION%s\n' "$BOLD" "$C_PRIMARY" "$RESET"
printf '  %s─────────────────────────────────────────────────────────────%s\n' "$C_MUTED" "$RESET"

info_badge "Model" "$(basename "$MODEL_PATH")"
info_badge "Model Path" "$MODEL_PATH"
info_badge "Context Window" "$CTX_SIZE Tokens"
info_badge "Parallel Slots" "$PARALLEL"
info_badge "Offloaded Layers" "$GPU_LAYERS (GPU)"
info_badge "Flash Attention" "$FLASH_ATTN"
info_badge "KV Cache Strategy" "K:$CACHE_K | V:$CACHE_V"
info_badge "Jinja Templating" "$JINJA"
info_badge "Chat Template" "$CHAT_TEMPLATE_SOURCE"
info_badge "Reasoning Mode" "${REASONING_MODE:-server/client default}"
info_badge "Reasoning Budget" "${REASONING_BUDGET:-server/client default}"
info_badge "Reasoning Format" "${REASONING_FORMAT:-server auto} (${REASONING_FORMAT_SOURCE})"
info_badge "Binding Endpoint" "http://$HOST:$PORT"

if ((${#EXTRA_ARGS[@]} > 0)); then
    printf '\n  %s%sEXTRA PASSTHROUGH ARGS%s\n' "$BOLD" "$C_WARN" "$RESET"
    printf '  %s' "$C_MUTED"
    printf '%q ' "${EXTRA_ARGS[@]}"
    printf '%s\n' "$RESET"
fi

printf '\n  %s%sEXECUTABLE COMMAND%s\n' "$BOLD" "$C_ACCENT" "$RESET"
printf '  %s' "$DIM"
printf '%q ' "${CMD[@]}"
printf '%s\n\n' "$RESET"

# ------------------------------------------------------------------------------
# Launch Execution
# ------------------------------------------------------------------------------
if [[ "$DRY_RUN" == true ]]; then
    printf '  %s[!] Dry-run enabled. Engine startup sequence halted.%s\n\n' "$C_WARN" "$RESET"
    exit 0
fi

printf '  %s🚀 Launching llama-server process...%s\n' "$BOLD" "$RESET"
printf '  %s• API Endpoint:%s   http://%s:%s\n' "$C_MUTED" "$RESET" "$HOST" "$PORT"
printf '  %s• Health Check:%s   http://%s:%s/health\n' "$C_MUTED" "$RESET" "$HOST" "$PORT"
printf '  %s• Open-AI Models:%s http://%s:%s/v1/models\n\n' "$C_MUTED" "$RESET" "$HOST" "$PORT"

# Pass control directly to the compiled process
exec "${CMD[@]}"
