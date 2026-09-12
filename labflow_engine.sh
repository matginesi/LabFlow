#!/usr/bin/env bash
set -euo pipefail

PROG="$(basename "$0")"

# Machine defaults can be overridden without editing this file.
MODEL="${LABFLOW_MODEL:-$HOME/.lmstudio/models/lmstudio-community/NVIDIA-Nemotron-3-Nano-4B-GGUF/NVIDIA-Nemotron-3-Nano-4B-Q4_K_M.gguf}"
SERVER="${LABFLOW_LLAMA_SERVER:-$HOME/llama.cpp/build/bin/llama-server}"
HOST="${LABFLOW_HOST:-127.0.0.1}"
PORT="${LABFLOW_PORT:-8080}"
CORS_ORIGINS="${LABFLOW_CORS_ORIGINS:-localhost}"

CTX=65536
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
HF_FILE=chat_template.jinja
TEMPLATE_SOURCE="GGUF metadata / llama.cpp fallback"

# Empty = do not force server defaults; LabFlow may choose per request.
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

if [[ -t 1 && -z "${NO_COLOR:-}" && "${TERM:-}" != dumb ]]; then
    R=$'\033[0m'; B=$'\033[1m'; RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'
else
    R=''; B=''; RED=''; YEL=''; GRN=''; DIM=''
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
  -s, --server PATH            llama-server executable
  -c, --ctx-size N             context size (default: 65536)
      --parallel N             parallel slots (default: 1)
      --gpu-layers N           GPU layers (default: 99)

Server:
  -H, --host HOST              bind host (default: 127.0.0.1, local only)
  -p, --port PORT              bind port (default: 8080)
      --cors-origin ORIGIN      one allowed browser origin (default: localhost)
      --cors-origins ORIGIN     legacy alias of --cors-origin
      --github-pages            allow the LabFlow GitHub Pages origin
      --lan                     opt in to LAN binding (0.0.0.0) with warning
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
      --temp FLOAT             --top-p FLOAT             --min-p FLOAT

Utility:
      --profile-max            128k context, 2 slots, full GPU
      --show-command           print final command
      --dry-run                validate and print, do not launch
  -q, --quiet                  suppress launcher output
  -h, --help

Raw llama-server options must follow '--'.
Environment: LABFLOW_MODEL, LABFLOW_LLAMA_SERVER, LABFLOW_HOST, LABFLOW_PORT, LABFLOW_CORS_ORIGINS, NO_COLOR

Examples:
  $PROG -m ~/models/model.gguf
  $PROG -m ~/models/model.gguf --no-thinking
  $PROG --github-pages                                      # GitHub Pages -> local llama.cpp
  $PROG --lan --cors-origin http://192.168.1.20:8000        # LabFlow served from another LAN device
  $PROG --dry-run -- --repeat-penalty 1.1
EOF_USAGE
}

set_template() {
    TEMPLATE=""; TEMPLATE_FILE=""; HF_REPO=""; JINJA=true
    case "$1" in
        inline) TEMPLATE="$2" ;;
        file)   TEMPLATE_FILE="$2" ;;
        hf)     HF_REPO="$2" ;;
    esac
}

parse_args() {
    while (( $# )); do
        case "$1" in
            -h|--help) usage; exit 0 ;;
            -q|--quiet) QUIET=true; shift ;;
            -m|--model) need "$@"; MODEL="$2"; shift 2 ;;
            -s|--server) need "$@"; SERVER="$2"; shift 2 ;;
            -c|--ctx-size) need "$@"; CTX="$2"; shift 2 ;;
            -np|--parallel) need "$@"; PARALLEL="$2"; shift 2 ;;
            -ngl|--gpu-layers) need "$@"; GPU_LAYERS="$2"; shift 2 ;;
            -H|--host) need "$@"; HOST="$2"; LAN_MODE=false; shift 2 ;;
            --lan) HOST=0.0.0.0; LAN_MODE=true; shift ;;
            -p|--port) need "$@"; PORT="$2"; shift 2 ;;
            --cors-origin|--cors-origins) need "$@"; CORS_ORIGINS="$2"; shift 2 ;;
            --github-pages) CORS_ORIGINS="https://matginesi.github.io"; shift ;;
            --timeout) need "$@"; TIMEOUT="$2"; shift 2 ;;
            --sse-ping|--sse-ping-interval) need "$@"; SSE_PING="$2"; shift 2 ;;
            --flash-attn) need "$@"; FLASH_ATTN="$2"; shift 2 ;;
            --cache-k) need "$@"; CACHE_K="$2"; shift 2 ;;
            --cache-v) need "$@"; CACHE_V="$2"; shift 2 ;;
            --jinja) JINJA=true; shift ;;
            --no-jinja) JINJA=false; shift ;;
            --chat-template) need "$@"; set_template inline "$2"; shift 2 ;;
            --chat-template-file) need "$@"; set_template file "$2"; shift 2 ;;
            --chat-template-hf) need "$@"; set_template hf "$2"; shift 2 ;;
            --chat-template-hf-file) need "$@"; HF_FILE="$2"; shift 2 ;;
            --auto-template|--auto-chat-template) AUTO_TEMPLATE=true; shift ;;
            --no-auto-template|--no-auto-chat-template) AUTO_TEMPLATE=false; shift ;;
            --reasoning) need "$@"; REASONING="$2"; shift 2 ;;
            --reasoning-budget) need "$@"; REASONING_BUDGET="$2"; shift 2 ;;
            --reasoning-format) need "$@"; REASONING_FORMAT="$2"; shift 2 ;;
            --no-thinking) REASONING=off; REASONING_BUDGET=0; shift ;;
            --metrics) METRICS=true; shift ;;
            --no-metrics) METRICS=false; shift ;;
            --verbose) VERBOSE=true; shift ;;
            --no-verbose) VERBOSE=false; shift ;;
            --temp) need "$@"; TEMP="$2"; shift 2 ;;
            --top-p) need "$@"; TOP_P="$2"; shift 2 ;;
            --min-p) need "$@"; MIN_P="$2"; shift 2 ;;
            --profile-max) CTX=131072; PARALLEL=2; GPU_LAYERS=99; FLASH_ATTN=on; shift ;;
            --show-command) SHOW_COMMAND=true; shift ;;
            --dry-run) DRY_RUN=true; SHOW_COMMAND=true; shift ;;
            --) shift; EXTRA=("$@"); break ;;
            -*) die "unknown option '$1'; use '--' for raw llama-server options" ;;
            *) die "unexpected positional argument '$1'" ;;
        esac
    done
}

supports() { grep -Fq -- "$1" <<<"$SERVER_HELP"; }
uint() { [[ "$2" =~ ^[0-9]+$ ]] || die "$1 must be a non-negative integer: '$2'"; }
posint() { uint "$1" "$2"; (( 10#$2 > 0 )) || die "$1 must be greater than zero"; }
number() { [[ "$2" =~ ^-?([0-9]+([.][0-9]*)?|[.][0-9]+)$ ]] || die "$1 must be numeric: '$2'"; }

resolve_template() {
    local dir file stem candidate
    dir="$(dirname "$MODEL")"; file="$(basename "$MODEL")"; stem="${file%.gguf}"

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
            "$dir/chat_template.jinja" "$dir/chat-template.jinja" \
            "$dir/$stem.jinja" "$dir/$file.jinja" "$dir/template.jinja"; do
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
       { [[ -n "$TEMPLATE" ]] && [[ "$TEMPLATE" == *'<think>'* ]] && [[ "$TEMPLATE" == *'</think>'* ]]; }; then
        REASONING_FORMAT=deepseek
    fi
}

validate() {
    [[ -x "$SERVER" ]] || die "llama-server not executable: $SERVER"
    [[ -n "$MODEL" ]] || die "model is required; pass --model PATH or set LABFLOW_MODEL"
    [[ -f "$MODEL" ]] || die "model not found: $MODEL"
    SERVER_HELP="$("$SERVER" --help 2>&1 || true)"

    posint "context size" "$CTX"
    posint "parallel slots" "$PARALLEL"
    uint "GPU layers" "$GPU_LAYERS"
    uint "port" "$PORT"; (( 10#$PORT >= 1 && 10#$PORT <= 65535 )) || die "port must be 1..65535"
    posint "timeout" "$TIMEOUT"
    posint "SSE ping" "$SSE_PING"
    case "$FLASH_ATTN" in on|off|auto) ;; *) die "flash-attn must be on, off, or auto" ;; esac

    if [[ -n "$REASONING" ]]; then
        case "$REASONING" in on|off|auto) ;; *) die "reasoning must be on, off, or auto" ;; esac
        supports --reasoning || die "llama-server does not support --reasoning"
    fi
    if [[ -n "$REASONING_BUDGET" ]]; then
        [[ "$REASONING_BUDGET" =~ ^-?[0-9]+$ ]] || die "reasoning budget must be an integer"
        supports --reasoning-budget || die "llama-server does not support --reasoning-budget"
    fi

    [[ -z "$TEMP" ]] || number temperature "$TEMP"
    [[ -z "$TOP_P" ]] || number top-p "$TOP_P"
    [[ -z "$MIN_P" ]] || number min-p "$MIN_P"
    [[ "$HF_FILE" == chat_template.jinja || -n "$HF_REPO" ]] || warn "--chat-template-hf-file has no effect without --chat-template-hf"

    resolve_template
    auto_reasoning_format
    [[ -z "$REASONING_FORMAT" ]] || supports --reasoning-format || die "llama-server does not support --reasoning-format"
    if [[ -n "$CORS_ORIGINS" ]] && ! supports --cors-origins; then
        warn "this llama-server build does not expose --cors-origins; browser CORS will use the server default"
        CORS_ORIGINS=""
    fi
    if [[ "$CORS_ORIGINS" == *","* || "$CORS_ORIGINS" =~ [[:space:]] ]]; then
        die "use one CORS origin only (or 'localhost' / '*'); current llama.cpp builds can emit an invalid Access-Control-Allow-Origin header for multi-origin values"
    fi
    if [[ "$CORS_ORIGINS" != "localhost" && "$CORS_ORIGINS" != "*" && ! "$CORS_ORIGINS" =~ ^https?://[^/[:space:]]+$ ]]; then
        die "CORS origin must be 'localhost', '*', or one exact http(s) origin without a path"
    fi
    if [[ "$CORS_ORIGINS" == "*" ]]; then
        warn "CORS is open to every browser origin; prefer 'localhost' or one exact LabFlow origin"
    fi
    if [[ "$HOST" == "0.0.0.0" || "$HOST" == "::" ]]; then
        [[ "$LAN_MODE" == true || -n "${LABFLOW_HOST:-}" ]] || warn "network-wide bind requested; use --lan when this is intentional"
        [[ "$CORS_ORIGINS" != "localhost" ]] || warn "LAN binding is enabled but CORS still accepts localhost only; remote LabFlow clients need --cors-origin <their exact origin>"
    fi
}

build_command() {
    CMD=("$SERVER"
        --model "$MODEL" --ctx-size "$CTX" --parallel "$PARALLEL"
        --n-gpu-layers "$GPU_LAYERS" --flash-attn "$FLASH_ATTN"
        --cache-type-k "$CACHE_K" --cache-type-v "$CACHE_V"
        --host "$HOST" --port "$PORT" --timeout "$TIMEOUT"
        --sse-ping-interval "$SSE_PING")

    [[ -n "$CORS_ORIGINS" ]] && CMD+=(--cors-origins "$CORS_ORIGINS")

    [[ "$JINJA" == true ]] && CMD+=(--jinja)
    [[ -n "$TEMPLATE" ]] && CMD+=(--chat-template "$TEMPLATE")
    [[ -n "$TEMPLATE_FILE" ]] && CMD+=(--chat-template-file "$TEMPLATE_FILE")
    [[ -n "$REASONING" ]] && CMD+=(--reasoning "$REASONING")
    [[ -n "$REASONING_BUDGET" ]] && CMD+=(--reasoning-budget "$REASONING_BUDGET")
    [[ -n "$REASONING_FORMAT" ]] && CMD+=(--reasoning-format "$REASONING_FORMAT")
    [[ "$METRICS" == true ]] && CMD+=(--metrics)
    [[ "$VERBOSE" == true ]] && CMD+=(--verbose)
    [[ -n "$TEMP" ]] && CMD+=(--temp "$TEMP")
    [[ -n "$TOP_P" ]] && CMD+=(--top-p "$TOP_P")
    [[ -n "$MIN_P" ]] && CMD+=(--min-p "$MIN_P")
    CMD+=("${EXTRA[@]}")
}

summary() {
    [[ "$QUIET" == true ]] && return 0
    local local_host lan_ip
    local_host="$(hostname 2>/dev/null || true)"
    lan_ip="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' | head -n1 || true)"
    printf '%sLabFlow engine%s\n' "$B" "$R"
    printf '  model      %s\n' "$(basename "$MODEL")"
    printf '  runtime    ctx=%s  parallel=%s  gpu=%s  flash=%s\n' "$CTX" "$PARALLEL" "$GPU_LAYERS" "$FLASH_ATTN"
    printf '  template   %s\n' "$TEMPLATE_SOURCE"
    printf '  reasoning  %s  budget=%s  format=%s\n' "${REASONING:-default}" "${REASONING_BUDGET:-default}" "${REASONING_FORMAT:-auto}"
    printf '  bind       %s:%s\n' "$HOST" "$PORT"
    printf '  CORS       %s\n' "${CORS_ORIGINS:-server default}"
    [[ "$CORS_ORIGINS" == "localhost" ]] && printf '  browser    open local LabFlow as http://127.0.0.1:<port> or http://localhost:<port> (not 0.0.0.0)\n'
    if [[ "$HOST" == "0.0.0.0" || "$HOST" == "::" ]]; then
        [[ -n "$local_host" ]] && printf '  hostname   http://%s:%s/v1\n' "$local_host" "$PORT"
        [[ -n "$local_host" ]] && printf '  mDNS       http://%s.local:%s/v1\n' "${local_host%%.*}" "$PORT"
        [[ -n "$lan_ip" ]] && printf '  LAN IP     http://%s:%s/v1\n' "$lan_ip" "$PORT"
        warn "llama-server is exposed to the local network; keep the network trusted"
        if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
            if ! firewall-cmd --quiet --query-port="${PORT}/tcp" >/dev/null 2>&1; then
                warn "firewalld is active and TCP port $PORT is not open in the current zone"
                warn "Fedora LAN fix: sudo firewall-cmd --add-port=${PORT}/tcp && sudo firewall-cmd --permanent --add-port=${PORT}/tcp"
            fi
        else
            warn "if another device cannot connect, ensure the host firewall allows TCP port $PORT"
        fi
        [[ -n "$lan_ip" ]] && warn "from phones/tablets prefer the LAN IP or a working .local hostname; bare hostnames such as 'fedora' depend on your router/DNS"
    else
        printf '  endpoint   http://%s:%s/v1\n' "$HOST" "$PORT"
    fi
}
print_command() { printf '%scommand:%s ' "$DIM" "$R"; printf '%q ' "${CMD[@]}"; printf '\n'; }

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
