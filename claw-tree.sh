#!/usr/bin/env bash
# claw-tree — one-command launcher (macOS / Linux)
# Starts the SvelteKit dev server, optionally opens the browser,
# and optionally drops into a terminal claw REPL alongside.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
web_dir="$repo_root/apps/web"
claw_bin="$repo_root/rust/target/debug/claw"

no_browser=false
chat=false
port=5173

for arg in "$@"; do
    case "$arg" in
        --no-browser) no_browser=true ;;
        --chat)       chat=true ;;
        --port=*)     port="${arg#--port=}" ;;
        -h|--help)
            cat <<EOF
claw-tree launcher

Usage: ./claw-tree.sh [options]

Options:
  --no-browser    Don't auto-open the browser
  --chat          Also start a terminal claw REPL (shared sessions with web)
  --port=N        Dev server port (default 5173)
  -h, --help      This help text
EOF
            exit 0 ;;
    esac
done

step() { printf "\033[0;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[0;32m%s\033[0m\n" "$*"; }
warn() { printf "    \033[0;33m%s\033[0m\n" "$*"; }

if [ ! -d "$web_dir" ]; then
    echo "apps/web not found. Run ./setup.sh first."
    exit 1
fi

if [ ! -x "$claw_bin" ]; then
    warn "claw binary not found at $claw_bin — running setup first"
    "$repo_root/setup.sh"
fi

export CLAW_TREE_WORKSPACE="$PWD"

step "Starting SvelteKit dev server on port $port"
ok "workspace: $CLAW_TREE_WORKSPACE"

(cd "$web_dir" && HOST=0.0.0.0 PORT="$port" npm run dev -- --port "$port") &
server_pid=$!

cleanup() {
    echo
    step "Shutting down dev server"
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for dev server to bind
ready=false
for i in $(seq 1 20); do
    if curl -sf "http://localhost:$port" >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 0.5
done

if $ready; then
    ok "dev server is ready"
else
    warn "dev server still starting — check logs above"
fi

if ! $no_browser; then
    step "Opening browser"
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:$port"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:$port"
    fi
fi

echo
printf "\033[0;32mclaw-tree is running.\033[0m\n"
echo "  Web: http://localhost:$port"
echo "  Stop: Ctrl+C"
echo

if $chat; then
    step "Launching terminal claw REPL (shared sessions with the web UI)"
    echo "    Type /exit to leave the chat. The web UI keeps running."
    echo
    "$claw_bin"
else
    echo "Tip: run with --chat to also start a terminal chat alongside the web UI."
    wait "$server_pid"
fi
