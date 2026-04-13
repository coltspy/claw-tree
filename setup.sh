#!/usr/bin/env bash
# claw-tree setup script (macOS / Linux)
# Builds the claw Rust CLI, installs web dependencies, and puts
# `claw` + `claw-tree` on your PATH.
#
# Usage:
#   ./setup.sh              # full setup (release build + global install)
#   ./setup.sh --no-global  # skip global install (debug build only)

set -euo pipefail

install_global=true
for arg in "$@"; do
    case "$arg" in
        --no-global) install_global=false ;;
    esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step()  { printf "\033[0;36m==> %s\033[0m\n" "$*"; }
ok()    { printf "    \033[0;32m%s\033[0m\n" "$*"; }
fail()  { printf "    \033[0;31m%s\033[0m\n" "$*"; }

echo
echo "claw-tree setup"
echo "================"
echo

step "Checking prerequisites"

missing=()
command -v node  >/dev/null 2>&1 || missing+=("node (https://nodejs.org)")
command -v npm   >/dev/null 2>&1 || missing+=("npm (bundled with node)")
command -v cargo >/dev/null 2>&1 || missing+=("cargo (https://rustup.rs)")

if [ "${#missing[@]}" -gt 0 ]; then
    fail "Missing prerequisites:"
    for m in "${missing[@]}"; do
        fail "  - $m"
    done
    exit 1
fi

node_version="$(node --version | sed 's/^v//')"
cargo_version="$(cargo --version | awk '{print $2}')"
ok "node $node_version, cargo $cargo_version"

step "Building claw CLI (Rust)"
echo "    First build takes 1-2 minutes. Subsequent builds are incremental."
(cd "$repo_root/rust" && cargo build -p rusty-claude-cli)
ok "built: rust/target/debug/claw"

step "Installing web dependencies"
(cd "$repo_root/apps/web" && npm install)
ok "web dependencies installed"

if $install_global; then
    step "Installing claw globally (cargo install --path)"
    echo "    Release build, takes a few minutes first time."
    (cd "$repo_root/rust/crates/rusty-claude-cli" && cargo install --path . --locked)
    ok "claw installed to ~/.cargo/bin/claw (on PATH)"

    step "Installing claw-tree launcher to ~/.cargo/bin"
    cat > "$HOME/.cargo/bin/claw-tree" <<LAUNCHER
#!/usr/bin/env bash
# claw-tree global launcher -- starts the web UI with cwd as workspace
exec "$repo_root/claw-tree.sh" "\$@"
LAUNCHER
    chmod +x "$HOME/.cargo/bin/claw-tree"
    ok "claw-tree installed -- run 'claw-tree' from any directory"
fi

echo
printf "\033[0;32mSetup complete.\033[0m\n"
echo
printf "\033[0;36mNext steps:\033[0m\n"
if $install_global; then
    echo "  1. cd into any project directory"
    echo "  2. Run: claw-tree"
    echo "  3. Paste your Anthropic API key in the gear icon"
    echo
    echo "  claw-tree  starts the web UI with the current directory as workspace"
    echo "  claw       starts the terminal REPL (also from any directory)"
else
    echo "  1. Run: ./claw-tree.sh"
    echo "  2. Paste your Anthropic API key in the gear icon"
    echo
    echo "Tip: run setup again without --no-global to install 'claw' and"
    echo "     'claw-tree' on your PATH."
fi
echo
