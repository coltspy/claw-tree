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
}

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. cd apps\web"
Write-Host "  2. npm run dev"
Write-Host "  3. Open http://localhost:5173"
Write-Host "  4. Click the gear icon in the toolbar and paste your Anthropic API key"
if (-not $Global) {
    Write-Host ""
    Write-Host "Tip: rerun with -Global to install the 'claw' command globally" -ForegroundColor Gray
    Write-Host "     so you can use terminal mode without the full path." -ForegroundColor Gray
}
Write-Host ""
