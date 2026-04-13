# claw-tree setup script (Windows PowerShell)
# Builds the claw Rust CLI and installs web dependencies.
#
# Usage:
#   .\setup.ps1              # normal setup (debug build + npm install)
#   .\setup.ps1 -Global      # same, plus `cargo install --path` so `claw` is on PATH

param(
    [switch]$Global
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

function Write-Step($message) {
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "    $message" -ForegroundColor Green
}

function Write-Fail($message) {
    Write-Host "    $message" -ForegroundColor Red
}

Write-Host ""
Write-Host "claw-tree setup" -ForegroundColor Cyan
Write-Host "================"
Write-Host ""

Write-Step "Checking prerequisites"

$missing = @()
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "node (https://nodejs.org)" }
if (-not (Get-Command npm -ErrorAction SilentlyContinue))  { $missing += "npm (bundled with node)" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { $missing += "cargo (https://rustup.rs)" }

if ($missing.Count -gt 0) {
    Write-Fail "Missing prerequisites:"
    foreach ($m in $missing) { Write-Fail "  - $m" }
    exit 1
}

$nodeVersion = (node --version).TrimStart('v')
$cargoVersion = (cargo --version).Split(' ')[1]
Write-Ok "node $nodeVersion, cargo $cargoVersion"

Write-Step "Building claw CLI (Rust)"
Write-Host "    First build takes 1-2 minutes. Subsequent builds are incremental." -ForegroundColor Gray
Push-Location (Join-Path $repoRoot 'rust')
try {
    cargo build -p rusty-claude-cli
    if ($LASTEXITCODE -ne 0) { throw "cargo build failed" }
} finally {
    Pop-Location
}
Write-Ok "built: rust\target\debug\claw.exe"

Write-Step "Installing web dependencies"
Push-Location (Join-Path $repoRoot 'apps\web')
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
} finally {
    Pop-Location
}
Write-Ok "web dependencies installed"

if ($Global) {
    Write-Step "Installing claw globally (cargo install --path)"
    Write-Host "    Release build, takes a few minutes first time." -ForegroundColor Gray
    Push-Location (Join-Path $repoRoot 'rust\crates\rusty-claude-cli')
    try {
        cargo install --path . --locked
        if ($LASTEXITCODE -ne 0) { throw "cargo install failed" }
    } finally {
        Pop-Location
    }
    Write-Ok "claw installed to ~\.cargo\bin\claw.exe (on PATH)"

    Write-Step "Installing claw-tree launcher"
    $launcherPath = Join-Path $HOME '.cargo\bin\claw-tree.cmd'
    $launcherPs1 = Join-Path $repoRoot 'claw-tree.ps1'
    Set-Content -Path $launcherPath -Value "@echo off`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$launcherPs1`" %*"
    Write-Ok "claw-tree.cmd installed to ~\.cargo\bin (on PATH)"
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
if ($Global) {
    Write-Host "  1. cd into any project directory"
    Write-Host "  2. Run: claw-tree"
    Write-Host "  3. Paste your Anthropic API key in the gear icon"
    Write-Host ""
    Write-Host "  claw-tree starts the web UI with the current directory as the workspace."
    Write-Host "  claw starts the terminal REPL (also works from any directory)."
} else {
    Write-Host "  1. cd apps\web"
    Write-Host "  2. npm run dev"
    Write-Host "  3. Open http://127.0.0.1:5173"
    Write-Host "  4. Click the gear icon in the toolbar and paste your Anthropic API key"
    Write-Host ""
    Write-Host "Tip: rerun with -Global to install 'claw' and 'claw-tree' on your PATH" -ForegroundColor Gray
    Write-Host "     so you can launch from any directory." -ForegroundColor Gray
}
Write-Host ""
