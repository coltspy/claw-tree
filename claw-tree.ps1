# claw-tree -- one-command launcher (Windows PowerShell)
# Starts the SvelteKit dev server, optionally opens the browser,
# and optionally drops into a terminal claw REPL alongside.

param(
    [switch]$NoBrowser,
    [switch]$Chat,
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$webDir = Join-Path $repoRoot 'apps\web'
$clawBin = Join-Path $repoRoot 'rust\target\debug\claw.exe'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# Sanity checks
if (-not (Test-Path $webDir)) {
    Write-Host "apps/web not found. Run setup.ps1 first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $clawBin)) {
    Write-Warn "claw binary not found at $clawBin -- running setup first"
    & (Join-Path $repoRoot 'setup.ps1')
}

$env:CLAW_TREE_WORKSPACE = (Get-Location).Path

Write-Step "Starting SvelteKit dev server on port $Port"
Write-Ok "workspace: $env:CLAW_TREE_WORKSPACE"

# Launch the dev server as a background job
$workspace = $env:CLAW_TREE_WORKSPACE
$serverJob = Start-Job -ScriptBlock {
    param($dir, $port, $ws)
    Set-Location $dir
    $env:HOST = '0.0.0.0'
    $env:PORT = $port
    $env:CLAW_TREE_WORKSPACE = $ws
    npm run dev -- --port $port
} -ArgumentList $webDir, $Port, $workspace

Start-Sleep -Seconds 2

# Give it a moment to actually bind the port
$maxTries = 20
$ready = $false
for ($i = 0; $i -lt $maxTries; $i++) {
    try {
        $test = Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -TimeoutSec 1 -UseBasicParsing
        if ($test.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 500
    }
}

if ($ready) {
    Write-Ok "dev server is ready"
} else {
    Write-Warn "dev server still starting (check job output with: Receive-Job $($serverJob.Id))"
}

if (-not $NoBrowser) {
    Write-Step "Opening browser"
    Start-Process "http://127.0.0.1:$Port"
}

Write-Host ""
Write-Host "claw-tree is running." -ForegroundColor Green
Write-Host "  Web: http://127.0.0.1:$Port"
Write-Host "  Stop: Stop-Job $($serverJob.Id); Remove-Job $($serverJob.Id)"
Write-Host ""

if ($Chat) {
    Write-Step "Launching terminal claw REPL (shared sessions with the web UI)"
    Write-Host "    Type /exit to leave the chat. The web UI keeps running." -ForegroundColor Gray
    Write-Host ""
    & $clawBin
} else {
    Write-Host "Tip: run with -Chat to also start a terminal chat alongside the web UI." -ForegroundColor Gray
    Write-Host "Press Ctrl+C or run 'Stop-Job $($serverJob.Id)' to stop the dev server." -ForegroundColor Gray

    # Keep the foreground alive so the user can Ctrl+C
    try {
        while ($serverJob.State -eq 'Running') {
            Start-Sleep -Seconds 1
        }
    } finally {
        Write-Host ""
        Write-Step "Shutting down dev server"
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -ErrorAction SilentlyContinue
    }
}
