#!/usr/bin/env bash
# claw-tree setup script (macOS / Linux)
# Builds the claw Rust CLI and installs web dependencies.
#
# Usage:
#   ./setup.sh              # normal setup (debug build + npm install)
#   ./setup.sh --global     # same, plus `cargo install --path` so `claw` is on PATH

set -euo pipefail

install_global=false
for arg in "$@"; do
    case "$arg" in
        --global) install_global=true ;;
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
# claw-tree global launcher — starts the web UI with cwd as workspace
exec "$repo_root/claw-tree.sh" "\$@"
LAUNCHER
    chmod +x "$HOME/.cargo/bin/claw-tree"
    ok "claw-tree installed — run 'claw-tree' from any directory"
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
    echo "  claw-tree starts the web UI with the current directory as the workspace."
    echo "  claw starts the terminal REPL (also works from any directory)."
else
    echo "  1. cd apps/web"
    echo "  2. npm run dev"
    echo "  3. Open http://localhost:5173"
    echo "  4. Click the gear icon in the toolbar and paste your Anthropic API key"
    echo
    echo "Tip: rerun with --global to install 'claw' and 'claw-tree' on your PATH"
    echo "     so you can launch from any directory."
fi
echo
