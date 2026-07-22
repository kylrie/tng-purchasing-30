#Requires -Version 5.1
<#
    TNG QR Print Bridge - Fun Roof (b1) START SCRIPT
    ================================================
    Starts the print bridge in THIS window so you can watch the logs. It will:

        1. find the bridge folder (the one with package.json)
        2. make sure config.json + the service-account key are in place
        3. install dependencies (only the first time) and build if needed
        4. start the bridge (npm start) and keep this window open

    Leave this window OPEN while the restaurant is trading - closing it stops
    auto-printing. Press Ctrl+C to stop the bridge on purpose.

    HOW TO RUN (in PowerShell, from this folder):
        powershell -NoProfile -ExecutionPolicy Bypass -File .\start-tfr-bridge.ps1
#>

$ErrorActionPreference = 'Stop'

function Fail-Exit([string]$m) {
    Write-Host ""
    Write-Host "  ERROR: $m" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close this window"
    exit 1
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " TNG QR Print Bridge - Fun Roof (b1)"               -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# --- 1) locate bridge root (folder containing package.json) ------------------
function Find-BridgeRoot([string]$startDir) {
    foreach ($c in @($startDir, (Join-Path $startDir '..'))) {
        if (Test-Path (Join-Path $c 'package.json')) { return (Resolve-Path $c).Path }
    }
    return $null
}
$scriptDir  = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$bridgeRoot = Find-BridgeRoot $scriptDir
if (-not $bridgeRoot) { Fail-Exit "Could not find the bridge (no package.json near '$scriptDir'). Copy the whole qr-print-bridge folder over and run this from inside it." }

Set-Location $bridgeRoot
Write-Host " Bridge folder : $bridgeRoot" -ForegroundColor Gray

# --- 2) Node.js present ------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail-Exit "Node.js is not installed. Install the LTS from https://nodejs.org, then run this again."
}

# --- 3) config.json present --------------------------------------------------
$configPath = Join-Path $bridgeRoot 'config.json'
if (-not (Test-Path $configPath)) {
    Fail-Exit "config.json not found at $configPath. Copy tfr-windows-package\config.example.json to that path and edit it (see README_TFR_WINDOWS.md)."
}
Write-Host " Config file   : $configPath" -ForegroundColor Gray

# --- 4) service-account key present (resolve like the bridge does) -----------
try { $cfg = Get-Content -Raw -Path $configPath | ConvertFrom-Json } catch { Fail-Exit "config.json is not valid JSON: $($_.Exception.Message)" }
$saRaw = "$($cfg.serviceAccountPath)"
if (-not $saRaw) { Fail-Exit "config.json has no serviceAccountPath. Add it (usually ""./service-account.json"")." }
if ([System.IO.Path]::IsPathRooted($saRaw)) { $saPath = $saRaw } else { $saPath = Join-Path $bridgeRoot $saRaw }
if (-not (Test-Path $saPath)) { Fail-Exit "Service-account key not found at $saPath. Ask the TNG admin for it and save it there (never email/commit it)." }

Write-Host " Business unit : $($cfg.businessUnitId)   Database: $($cfg.databaseId)" -ForegroundColor Gray

# tell the bridge exactly which config to use (removes any ambiguity)
$env:BRIDGE_CONFIG = $configPath

# --- 5) dependencies + build -------------------------------------------------
if (-not (Test-Path (Join-Path $bridgeRoot 'node_modules'))) {
    Write-Host ""
    Write-Host " First run: installing dependencies (npm install)... this may take a few minutes." -ForegroundColor Yellow
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail-Exit "npm install failed (exit $LASTEXITCODE). Check the internet connection and try again." }
}
if (-not (Test-Path (Join-Path $bridgeRoot 'dist\index.js'))) {
    Write-Host " Building the bridge (npm run build)..." -ForegroundColor Yellow
    & npm run build
    if ($LASTEXITCODE -ne 0) { Fail-Exit "Build failed (exit $LASTEXITCODE)." }
}

# --- 6) start (foreground - keeps this window open with live logs) -----------
Write-Host ""
Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host " Starting bridge. Keep this window OPEN. Ctrl+C to stop." -ForegroundColor Green
Write-Host "--------------------------------------------------" -ForegroundColor Green
Write-Host ""

& npm start
$code = $LASTEXITCODE

Write-Host ""
Write-Host " Bridge stopped (exit $code)." -ForegroundColor Yellow
Read-Host "Press Enter to close this window"
