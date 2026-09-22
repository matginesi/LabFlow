#!/usr/bin/env bash
# Launch a local llama.cpp OpenAI-compatible server.
#
# Goals:
#   - work with llama-server installed from a distro package or built manually
#   - resolve llama-server from PATH unless an explicit path is provided
#   - preserve LabFlow-friendly defaults
#   - only pass optional flags supported by the detected llama-server build
#   - fail clearly when an explicitly requested feature is unavailable
#
# Environment:
#   LABFLOW_MODEL
#   LABFLOW_LLAMA_SERVER
#   LABFLOW_HOST
#   LABFLOW_PORT
#   LABFLOW_CORS_ORIGINS
#   NO_COLOR
#
# Examples:
#   ./start_llama.sh
#   ./start_llama.sh -m ~/models/model.gguf
#   ./start_llama.sh --server llama-server
#   ./start_llama.sh --server ~/src/llama.cpp/build/bin/llama-server
#   LABFLOW_LLAMA_SERVER=/usr/bin/llama-server ./start_llama.sh
#   ./start_llama.sh --no-thinking
#   ./start_llama.sh --dry-run
#   ./start_llama.sh -- --repeat-penalty 1.1

set -euo pipefail

PROG="$(basename "$0")"

# DEFAULT_MODEL="$HOME/.lmstudio/models/lmstudio-community/NVIDIA-Nemotron-3-Nano-4B-GGUF/NVIDIA-Nemotron-3-Nano-4B-Q4_K_M.gguf"
# DEFAULT_MODEL="/data/models/granite-4.0-h-tiny/granite-4.0-h-tiny-Q4_K_M.gguf"
# DEFAULT_MODEL="/data/models/Qwen3.5-0.8B-Q4_0.gguf"
# DEFAULT_MODEL="/data/models/gemma-3-270m-it-q4_k_m.gguf"  <- NA MERDA
DEFAULT_MODEL="/data/models/LFM2-350M-Q4_K_M.gguf"

MODEL="${LABFLOW_MODEL:-$DEFAULT_MODEL}"
SERVER="${LABFLOW_LLAMA_SERVER:-llama-server}"
HOST="${LABFLOW_HOST:-127.0.0.1}"
PORT="${LABFLOW_PORT:-8080}"
CORS_ORIGINS="${LABFLOW_CORS_ORIGINS:-}"

CTX=16384
PARALLEL=1
GPU_LAYERS=99
FLASH_ATTN=on
CACHE_K=q4_0
CACHE_V=q4_0
TIMEOUT=600
SSE_PING=15

JINJA=true
AUTO_TEMPLATE=true
TEMPLATE=""
TEMPLATE_FILE=""
HF_REPO=""
HF_FILE="chat_template.jinja"
TEMPLATE_SOURCE="GGUF metadata / llama.cpp fallback"

# Leave reasoning controls empty unless explicitly requested.
# LabFlow can then choose per request when supported by the model/server.
# In current llama.cpp, a fixed --reasoning-budget takes precedence over the
# per-request thinking_budget_tokens field, so the default must remain unset.
REASONING=""
REASONING_BUDGET=""
REASONING_FORMAT=""

METRICS=true
VERBOSE=true
TEMP=""
TOP_P=""
MIN_P=""

DRY_RUN=false
SHOW_COMMAND=false
QUIET=false
LAN_MODE=false

EXTRA=()
CMD=()

SERVER_HELP=""
SERVER_VERSION=""
RESOLVED_SERVER=""

# Resolved option names. Most current builds use the defaults below, but
# resolving them from --help makes the launcher tolerant of packaging/build differences.
OPT_MODEL=""
OPT_CTX=""
OPT_PARALLEL=""
OPT_GPU_LAYERS=""
OPT_HOST=""
OPT_PORT=""

if [[ -t 1 && -z "${NO_COLOR:-}" && "${TERM:-}" != "dumb" ]]; then
    R=$'\033[0m'
    B=$'\033[1m'
    RED=$'\033[31m'
    YEL=$'\033[33m'
    GRN=$'\033[32m'
    DIM=$'\033[2m'
else
    R=''
    B=''
    RED=''
    YEL=''
    GRN=''
    DIM=''
fi

say()  { [[ "$QUIET" == true ]] || printf '%s\n' "$*"; }
ok()   { [[ "$QUIET" == true ]] || printf '%s%s%s\n' "$GRN" "$*" "$R"; }
warn() { printf '%swarning:%s %s\n' "$YEL" "$R" "$*" >&2; }
die()  { printf '%serror:%s %s\nTry %s --help.\n' "$RED" "$R" "$*" "$PROG" >&2; exit 2; }
need() { (( $# >= 2 )) || die "option '$1' requires a value"; }

usage() {
    cat <<EOF_USAGE
${B}Usage:${R} $PROG [options] [-- llama-server-args...]

Core:
  -m, --model PATH             GGUF model
  -s, --server CMD|PATH        llama-server command or executable path
  -c, --ctx-size N             context size (default: 16384)
      --parallel N             parallel slots (default: 1)
      --gpu-layers N           GPU layers (default: 99)

Server:
  -H, --host HOST              bind host (default: 127.0.0.1, local only)
  -p, --port PORT              bind port (default: 8080)
      --cors-origin ORIGIN      explicit browser CORS origin override
      --cors-origins ORIGIN     alias of --cors-origin
                                default: llama-server CORS behavior
      --lan                     bind 0.0.0.0; requires explicit CORS origin
      --timeout SEC            request timeout (default: 600)
      --sse-ping SEC           SSE ping interval (default: 15)
      --[no-]metrics
      --[no-]verbose

Memory / attention:
      --flash-attn MODE        on | off | auto
      --cache-k TYPE           KV cache K type
      --cache-v TYPE           KV cache V type

Chat template:
      --[no-]jinja
      --chat-template VALUE
      --chat-template-file PATH
      --chat-template-hf REPO
      --chat-template-hf-file FILE
      --[no-]auto-template

Reasoning:
      --reasoning MODE         on | off | auto
      --reasoning-budget N
      --reasoning-format FORMAT
      --no-thinking            reasoning=off, budget=0

Sampling defaults:
      --temp FLOAT
      --top-p FLOAT
      --min-p FLOAT

Utility:
      --profile-max            128k context, 2 slots, full GPU
      --show-command           print final command
      --dry-run                validate and print, do not launch
  -q, --quiet                  suppress launcher output
  -h, --help

Raw llama-server options must follow '--'.

Environment:
  LABFLOW_MODEL
  LABFLOW_LLAMA_SERVER
  LABFLOW_HOST
  LABFLOW_PORT
  LABFLOW_CORS_ORIGINS
  NO_COLOR

Examples:
  $PROG -m ~/models/model.gguf
  $PROG -m ~/models/model.gguf --no-thinking
  $PROG --server llama-server
  $PROG --server /usr/bin/llama-server
  $PROG --server ~/llama.cpp/build/bin/llama-server
  $PROG --lan --cors-origin http://192.168.1.20:8000
  $PROG --dry-run -- --repeat-penalty 1.1
EOF_USAGE
}

set_template() {
    TEMPLATE=""
    TEMPLATE_FILE=""
    HF_REPO=""
    JINJA=true

    case "$1" in
        inline) TEMPLATE="$2" ;;
        file)   TEMPLATE_FILE="$2" ;;
        hf)     HF_REPO="$2" ;;
        *)      die "internal error: unknown template source '$1'" ;;
    esac
}

parse_args() {
    while (( $# )); do
        case "$1" in
            -h|--help)
                usage
                exit 0
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -m|--model)
                need "$@"
                MODEL="$2"
                shift 2
                ;;
            -s|--server)
                need "$@"
                SERVER="$2"
                shift 2
                ;;
            -c|--ctx-size)
                need "$@"
                CTX="$2"
                shift 2
                ;;
            -np|--parallel)
                need "$@"
                PARALLEL="$2"
                shift 2
                ;;
            -ngl|--gpu-layers)
                need "$@"
                GPU_LAYERS="$2"
                shift 2
                ;;
            -H|--host)
                need "$@"
                HOST="$2"
                LAN_MODE=false
                shift 2
                ;;
            --lan)
                HOST="0.0.0.0"
                LAN_MODE=true
                shift
                ;;
            -p|--port)
                need "$@"
                PORT="$2"
                shift 2
                ;;
            --cors-origin|--cors-origins)
                need "$@"
                CORS_ORIGINS="$2"
                shift 2
                ;;
            --timeout)
                need "$@"
                TIMEOUT="$2"
                shift 2
                ;;
            --sse-ping|--sse-ping-interval)
                need "$@"
                SSE_PING="$2"
                shift 2
                ;;
            --flash-attn)
                need "$@"
                FLASH_ATTN="$2"
                shift 2
                ;;
            --cache-k)
                need "$@"
                CACHE_K="$2"
                shift 2
                ;;
            --cache-v)
                need "$@"
                CACHE_V="$2"
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
                need "$@"
                set_template inline "$2"
                shift 2
                ;;
            --chat-template-file)
                need "$@"
                set_template file "$2"
                shift 2
                ;;
            --chat-template-hf)
                need "$@"
                set_template hf "$2"
                shift 2
                ;;
            --chat-template-hf-file)
                need "$@"
                HF_FILE="$2"
                shift 2
                ;;
            --auto-template|--auto-chat-template)
                AUTO_TEMPLATE=true
                shift
                ;;
            --no-auto-template|--no-auto-chat-template)
                AUTO_TEMPLATE=false
                shift
                ;;
            --reasoning)
                need "$@"
                REASONING="$2"
                shift 2
                ;;
            --reasoning-budget)
                need "$@"
                REASONING_BUDGET="$2"
                shift 2
                ;;
            --reasoning-format)
                need "$@"
                REASONING_FORMAT="$2"
                shift 2
                ;;
            --no-thinking)
                REASONING="off"
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
            --temp)
                need "$@"
                TEMP="$2"
                shift 2
                ;;
            --top-p)
                need "$@"
                TOP_P="$2"
                shift 2
                ;;
            --min-p)
                need "$@"
                MIN_P="$2"
                shift 2
                ;;
            --profile-max)
                CTX=131072
                PARALLEL=2
                GPU_LAYERS=99
                FLASH_ATTN=on
                shift
                ;;
            --show-command)
                SHOW_COMMAND=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                SHOW_COMMAND=true
                shift
                ;;
            --)
                shift
                EXTRA=("$@")
                break
                ;;
            -*)
                die "unknown option '$1'; use '--' for raw llama-server options"
                ;;
            *)
                die "unexpected positional argument '$1'"
                ;;
        esac
    done
}

uint() {
    [[ "$2" =~ ^[0-9]+$ ]] || die "$1 must be a non-negative integer: '$2'"
}

posint() {
    uint "$1" "$2"
    (( 10#$2 > 0 )) || die "$1 must be greater than zero"
}

number() {
    [[ "$2" =~ ^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$ ]] || die "$1 must be numeric: '$2'"
}

resolve_server() {
    local resolved=""

    [[ -n "$SERVER" ]] || die "llama-server command/path is empty"

    if [[ "$SERVER" == */* ]]; then
        [[ -f "$SERVER" ]] || die "llama-server not found: $SERVER"
        [[ -x "$SERVER" ]] || die "llama-server is not executable: $SERVER"
        RESOLVED_SERVER="$(realpath "$SERVER")"
    else
        resolved="$(command -v -- "$SERVER" 2>/dev/null || true)"
        [[ -n "$resolved" ]] || die \
            "llama-server '$SERVER' was not found in PATH. Install llama.cpp or set LABFLOW_LLAMA_SERVER=/path/to/llama-server"
        RESOLVED_SERVER="$(realpath "$resolved" 2>/dev/null || printf '%s' "$resolved")"
    fi

    SERVER="$RESOLVED_SERVER"
}

load_server_metadata() {
    SERVER_HELP="$("$SERVER" --help 2>&1 || true)"
    [[ -n "$SERVER_HELP" ]] || die "could not read '$SERVER --help'"

    SERVER_VERSION="$("$SERVER" --version 2>&1 | head -n1 || true)"
    [[ -n "$SERVER_VERSION" ]] || SERVER_VERSION="unknown"
}

supports() {
    local flag="$1"
    grep -Fq -- "$flag" <<<"$SERVER_HELP"
}

first_supported() {
    local candidate
    for candidate in "$@"; do
        if supports "$candidate"; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

require_option() {
    local label="$1"
    shift

    local found=""
    found="$(first_supported "$@" || true)"
    [[ -n "$found" ]] || die \
        "this llama-server build does not expose the required $label option (${*})"

    printf '%s' "$found"
}

resolve_core_options() {
    OPT_MODEL="$(require_option "model" --model "-m,")"
    OPT_CTX="$(require_option "context-size" --ctx-size "-c,")"
    OPT_PARALLEL="$(require_option "parallel" --parallel "-np,")"
    OPT_GPU_LAYERS="$(require_option "GPU-layers" --n-gpu-layers --gpu-layers "-ngl,")"
    OPT_HOST="$(require_option "host" --host)"
    OPT_PORT="$(require_option "port" --port)"
}

resolve_template() {
    local dir file stem candidate

    dir="$(dirname "$MODEL")"
    file="$(basename "$MODEL")"
    stem="${file%.gguf}"

    if [[ -n "$TEMPLATE_FILE" ]]; then
        [[ -f "$TEMPLATE_FILE" ]] || die "chat template not found: $TEMPLATE_FILE"
        TEMPLATE_FILE="$(realpath "$TEMPLATE_FILE")"
        TEMPLATE_SOURCE="file: $TEMPLATE_FILE"

    elif [[ -n "$TEMPLATE" ]]; then
        TEMPLATE_SOURCE="CLI override"

    elif [[ -n "$HF_REPO" ]]; then
        command -v hf >/dev/null 2>&1 || die "'hf' is required by --chat-template-hf"
        say "Resolving chat template from Hugging Face..."
        TEMPLATE_FILE="$(hf download "$HF_REPO" "$HF_FILE" --quiet)" || die "template download failed"
        [[ -f "$TEMPLATE_FILE" ]] || die "invalid downloaded template path"
        TEMPLATE_FILE="$(realpath "$TEMPLATE_FILE")"
        TEMPLATE_SOURCE="HF: $HF_REPO/$HF_FILE"

    elif [[ "$AUTO_TEMPLATE" == true && "$JINJA" == true ]]; then
        for candidate in \
            "$dir/chat_template.jinja" \
            "$dir/chat-template.jinja" \
            "$dir/$stem.jinja" \
            "$dir/$file.jinja" \
            "$dir/template.jinja"
        do
            if [[ -f "$candidate" ]]; then
                TEMPLATE_FILE="$(realpath "$candidate")"
                TEMPLATE_SOURCE="auto: $TEMPLATE_FILE"
                break
            fi
        done
    fi

    if [[ "$JINJA" != true && ( -n "$TEMPLATE" || -n "$TEMPLATE_FILE" || -n "$HF_REPO" ) ]]; then
        die "chat template overrides require Jinja"
    fi

    if [[ -n "$TEMPLATE_FILE" ]]; then
        supports --chat-template-file || die "llama-server does not support --chat-template-file"
        [[ -s "$TEMPLATE_FILE" ]] || die "chat template is empty: $TEMPLATE_FILE"
        grep -Eq '\{\{|\{%' "$TEMPLATE_FILE" || die "chat template does not look like Jinja"
    fi

    [[ -z "$TEMPLATE" ]] || supports --chat-template || die "llama-server does not support --chat-template"
}

auto_reasoning_format() {
    [[ -z "$REASONING_FORMAT" ]] || return 0

    if { [[ -n "$TEMPLATE_FILE" ]] && grep -Fq '<think>' "$TEMPLATE_FILE" && grep -Fq '</think>' "$TEMPLATE_FILE"; } || \
       { [[ -n "$TEMPLATE" ]] && [[ "$TEMPLATE" == *'<think>'* ]] && [[ "$TEMPLATE" == *'</think>'* ]]; }
    then
        REASONING_FORMAT="deepseek"
    fi
}

validate_cors() {
    if [[ -n "$CORS_ORIGINS" ]]; then
        if [[ "$CORS_ORIGINS" =~ [[:space:]] ]]; then
            die "CORS origin must not contain spaces"
        fi

        [[ "$CORS_ORIGINS" != *,* ]] || die \
            "use one explicit CORS origin only; omit --cors-origin for llama-server defaults"

        if [[ "$CORS_ORIGINS" != "localhost" &&
              "$CORS_ORIGINS" != "*" &&
              ! "$CORS_ORIGINS" =~ ^https?://[^/[:space:]]+$ ]]
        then
            die "CORS origin must be 'localhost', '*', or one exact http(s) origin without a path"
        fi

        [[ "$CORS_ORIGINS" != "*" ]] || warn "CORS is open to every browser origin"
    fi

    if [[ "$HOST" == "0.0.0.0" || "$HOST" == "::" ]]; then
        [[ "$LAN_MODE" == true || -n "${LABFLOW_HOST:-}" ]] || \
            warn "network-wide bind requested; use --lan when this is intentional"

        [[ -n "$CORS_ORIGINS" ]] || die \
            "LAN binding requires --cors-origin <exact LabFlow origin>"

        [[ "$CORS_ORIGINS" != "localhost" ]] || \
            warn "LAN binding with localhost-only CORS will reject remote LabFlow clients"
    fi
}

validate_requested_features() {
    case "$FLASH_ATTN" in
        on|off|auto) ;;
        *) die "flash-attn must be on, off, or auto" ;;
    esac

    if [[ -n "$REASONING" ]]; then
        case "$REASONING" in
            on|off|auto) ;;
            *) die "reasoning must be on, off, or auto" ;;
        esac
        supports --reasoning || die "llama-server does not support --reasoning"
    fi

    if [[ -n "$REASONING_BUDGET" ]]; then
        [[ "$REASONING_BUDGET" =~ ^-?[0-9]+$ ]] || die "reasoning budget must be an integer"
        supports --reasoning-budget || die "llama-server does not support --reasoning-budget"
    fi

    if [[ -n "$REASONING_FORMAT" ]]; then
        supports --reasoning-format || die "llama-server does not support --reasoning-format"
    fi

    [[ -z "$TEMP" ]] || number "temperature" "$TEMP"
    [[ -z "$TOP_P" ]] || number "top-p" "$TOP_P"
    [[ -z "$MIN_P" ]] || number "min-p" "$MIN_P"

    if [[ "$HF_FILE" != "chat_template.jinja" && -z "$HF_REPO" ]]; then
        warn "--chat-template-hf-file has no effect without --chat-template-hf"
    fi
}

validate() {
    resolve_server
    load_server_metadata

    [[ -n "$MODEL" ]] || die "model is required; pass --model PATH or set LABFLOW_MODEL"
    [[ -f "$MODEL" ]] || die \
        "model not found: $MODEL. Pass --model PATH or set LABFLOW_MODEL"

    posint "context size" "$CTX"
    posint "parallel slots" "$PARALLEL"
    uint "GPU layers" "$GPU_LAYERS"
    uint "port" "$PORT"
    (( 10#$PORT >= 1 && 10#$PORT <= 65535 )) || die "port must be 1..65535"
    posint "timeout" "$TIMEOUT"
    posint "SSE ping" "$SSE_PING"

    resolve_core_options
    validate_cors
    resolve_template
    auto_reasoning_format
    validate_requested_features
}

append_optional_value() {
    local flag="$1"
    local value="$2"
    local label="${3:-$flag}"

    if supports "$flag"; then
        CMD+=("$flag" "$value")
    else
        warn "$label is not supported by this llama-server build; skipping it"
    fi
}

append_optional_switch() {
    local flag="$1"
    local label="${2:-$flag}"

    if supports "$flag"; then
        CMD+=("$flag")
    else
        warn "$label is not supported by this llama-server build; skipping it"
    fi
}

build_command() {
    CMD=(
        "$SERVER"
        "$OPT_MODEL" "$MODEL"
        "$OPT_CTX" "$CTX"
        "$OPT_PARALLEL" "$PARALLEL"
        "$OPT_GPU_LAYERS" "$GPU_LAYERS"
        "$OPT_HOST" "$HOST"
        "$OPT_PORT" "$PORT"
    )

    append_optional_value --flash-attn "$FLASH_ATTN" "flash attention"
    append_optional_value --cache-type-k "$CACHE_K" "K cache type"
    append_optional_value --cache-type-v "$CACHE_V" "V cache type"
    append_optional_value --timeout "$TIMEOUT" "request timeout"

    if supports --sse-ping-interval; then
        CMD+=(--sse-ping-interval "$SSE_PING")
    elif supports --sse-ping; then
        CMD+=(--sse-ping "$SSE_PING")
    else
        warn "SSE ping interval is not supported by this llama-server build; skipping it"
    fi

    if [[ -n "$CORS_ORIGINS" ]]; then
        if supports --cors-origins; then
            CMD+=(--cors-origins "$CORS_ORIGINS")
        elif supports --cors-origin; then
            CMD+=(--cors-origin "$CORS_ORIGINS")
        else
            die "an explicit CORS origin was requested, but this llama-server build exposes no supported CORS option"
        fi
    fi

    if [[ "$JINJA" == true ]]; then
        if supports --jinja; then
            CMD+=(--jinja)
        elif [[ -n "$TEMPLATE" || -n "$TEMPLATE_FILE" ]]; then
            die "Jinja/template override requested, but this llama-server build does not support --jinja"
        else
            warn "Jinja flag is not supported by this llama-server build; using server defaults"
        fi
    fi

    [[ -n "$TEMPLATE" ]] && CMD+=(--chat-template "$TEMPLATE")
    [[ -n "$TEMPLATE_FILE" ]] && CMD+=(--chat-template-file "$TEMPLATE_FILE")
    [[ -n "$REASONING" ]] && CMD+=(--reasoning "$REASONING")
    [[ -n "$REASONING_BUDGET" ]] && CMD+=(--reasoning-budget "$REASONING_BUDGET")
    [[ -n "$REASONING_FORMAT" ]] && CMD+=(--reasoning-format "$REASONING_FORMAT")

    if [[ "$METRICS" == true ]]; then
        append_optional_switch --metrics "metrics"
    fi

    if [[ "$VERBOSE" == true ]]; then
        if supports --verbose; then
            CMD+=(--verbose)
        elif supports "-v," || supports " -v "; then
            CMD+=(-v)
        else
            warn "verbose logging is not supported by this llama-server build; skipping it"
        fi
    fi

    if [[ -n "$TEMP" ]]; then
        supports --temp || die "temperature override requested, but --temp is unsupported"
        CMD+=(--temp "$TEMP")
    fi

    if [[ -n "$TOP_P" ]]; then
        supports --top-p || die "top-p override requested, but --top-p is unsupported"
        CMD+=(--top-p "$TOP_P")
    fi

    if [[ -n "$MIN_P" ]]; then
        supports --min-p || die "min-p override requested, but --min-p is unsupported"
        CMD+=(--min-p "$MIN_P")
    fi

    CMD+=("${EXTRA[@]}")
}

summary() {
    [[ "$QUIET" == true ]] && return 0

    local local_host=""
    local lan_ip=""

    local_host="$(hostname 2>/dev/null || true)"
    lan_ip="$(
        hostname -I 2>/dev/null |
        tr ' ' '\n' |
        grep -E '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' |
        head -n1 || true
    )"

    printf '%sLabFlow engine%s\n' "$B" "$R"
    printf '  server     %s\n' "$SERVER"
    printf '  version    %s\n' "$SERVER_VERSION"
    printf '  model      %s\n' "$(basename "$MODEL")"
    printf '  runtime    ctx=%s  parallel=%s  gpu=%s  flash=%s\n' \
        "$CTX" "$PARALLEL" "$GPU_LAYERS" "$FLASH_ATTN"
    printf '  template   %s\n' "$TEMPLATE_SOURCE"
    printf '  reasoning  %s  budget=%s  format=%s\n' \
        "${REASONING:-default}" \
        "${REASONING_BUDGET:-default}" \
        "${REASONING_FORMAT:-auto}"
    printf '  bind       %s:%s\n' "$HOST" "$PORT"
    printf '  CORS       %s\n' "${CORS_ORIGINS:-llama-server default}"

    if [[ -z "$CORS_ORIGINS" && "$HOST" == "127.0.0.1" ]]; then
        printf '  endpoint   http://127.0.0.1:%s/v1\n' "$PORT"
    fi

    if [[ "$HOST" == "0.0.0.0" || "$HOST" == "::" ]]; then
        [[ -n "$local_host" ]] && printf '  hostname   http://%s:%s/v1\n' "$local_host" "$PORT"
        [[ -n "$local_host" ]] && printf '  mDNS       http://%s.local:%s/v1\n' "${local_host%%.*}" "$PORT"
        [[ -n "$lan_ip" ]] && printf '  LAN IP     http://%s:%s/v1\n' "$lan_ip" "$PORT"

        warn "llama-server is exposed to the local network; keep the network trusted"

        if command -v firewall-cmd >/dev/null 2>&1 &&
           firewall-cmd --state >/dev/null 2>&1
        then
            if ! firewall-cmd --quiet --query-port="${PORT}/tcp" >/dev/null 2>&1; then
                warn "firewalld is active and TCP port $PORT is not open in the current zone"
                warn "Fedora fix: sudo firewall-cmd --add-port=${PORT}/tcp && sudo firewall-cmd --permanent --add-port=${PORT}/tcp"
            fi
        else
            warn "if another device cannot connect, ensure the host firewall allows TCP port $PORT"
        fi
    fi
}

print_command() {
    printf '%scommand:%s ' "$DIM" "$R"
    printf '%q ' "${CMD[@]}"
    printf '\n'
}

main() {
    parse_args "$@"

    if [[ "$LAN_MODE" == true || "$HOST" == "0.0.0.0" || "$HOST" == "::" ]]; then
        warn "LAN exposure enabled: llama-server may be reachable by other devices. Restrict CORS and firewall access on shared networks."
    fi

    say "Checking configuration..."
    validate
    build_command
    ok "Configuration OK"
    summary

    [[ "$SHOW_COMMAND" == true ]] && print_command
    [[ "$DRY_RUN" == true ]] && exit 0

    say "Starting llama-server..."
    exec "${CMD[@]}"
}

main "$@"
