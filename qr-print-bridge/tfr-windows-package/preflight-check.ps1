#Requires -Version 5.1
<#
    TNG QR Print Bridge - Fun Roof (b1) PREFLIGHT CHECK  (read-only, safe)
    =====================================================================
    Confirms this laptop is ready to run the bridge. It ONLY reads/tests:

        * Node.js + npm are installed
        * config.json exists and is valid
        * the Firebase service-account key file exists
        * the printer answers on its network port (TCP connect only)
        * the internet / Firebase is reachable

    It does NOT change anything. It does NOT print. It does NOT write to
    Firebase or to production data. Run it as many times as you like.

    HOW TO RUN (in PowerShell, from this folder):
        powershell -NoProfile -ExecutionPolicy Bypass -File .\preflight-check.ps1
#>

$ErrorActionPreference = 'Continue'

# ----------------------------------------------------------------------------
# small helpers for readable PASS / WARN / FAIL output
# ----------------------------------------------------------------------------
$script:passCount = 0
$script:failCount = 0
$script:warnCount = 0

function Say-Pass([string]$m) { Write-Host "  [ OK ]  $m"   -ForegroundColor Green;  $script:passCount++ }
function Say-Fail([string]$m) { Write-Host "  [FAIL]  $m"   -ForegroundColor Red;    $script:failCount++ }
function Say-Warn([string]$m) { Write-Host "  [WARN]  $m"   -ForegroundColor Yellow; $script:warnCount++ }
function Say-Info([string]$m) { Write-Host "         $m"    -ForegroundColor Gray }

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " TNG QR Print Bridge - Fun Roof (b1) preflight"      -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------------------------
# locate the bridge root (the folder that contains package.json). These helper
# scripts live in the 'tfr-windows-package' subfolder, so the bridge root is
# either this folder or its parent - whichever has package.json.
# ----------------------------------------------------------------------------
function Find-BridgeRoot([string]$startDir) {
    foreach ($c in @($startDir, (Join-Path $startDir '..'))) {
        if (Test-Path (Join-Path $c 'package.json')) { return (Resolve-Path $c).Path }
    }
    return $null
}

$scriptDir  = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$bridgeRoot = Find-BridgeRoot $scriptDir

if (-not $bridgeRoot) {
    Say-Fail "Could not find the bridge (no package.json in '$scriptDir' or its parent)."
    Say-Info "Make sure this script is inside the qr-print-bridge folder you copied over."
    Write-Host ""
    exit 1
}
Say-Info "Bridge folder : $bridgeRoot"
$configPath = Join-Path $bridgeRoot 'config.json'
Say-Info "Config file   : $configPath"
Write-Host ""

# ----------------------------------------------------------------------------
# 1) Node.js
# ----------------------------------------------------------------------------
Write-Host "1) Node.js" -ForegroundColor White
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVer = (& node --version) 2>$null
    Say-Pass "Node.js installed ($nodeVer)"
    $verNum = ($nodeVer -replace '[^0-9\.]', '').Split('.')[0]
    if ([int]$verNum -lt 18) { Say-Fail "Node $nodeVer is older than 18 - the bridge needs Node 18+. Install the current LTS from https://nodejs.org" }
} else {
    Say-Fail "Node.js is NOT installed. Install the LTS from https://nodejs.org then re-run this."
}

# ----------------------------------------------------------------------------
# 2) npm
# ----------------------------------------------------------------------------
Write-Host "2) npm" -ForegroundColor White
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm) {
    $npmVer = (& npm --version) 2>$null
    Say-Pass "npm installed (v$npmVer)"
} else {
    Say-Fail "npm is NOT available. It comes with Node.js - reinstall Node.js from https://nodejs.org"
}

# ----------------------------------------------------------------------------
# 3) config.json exists + is valid JSON
# ----------------------------------------------------------------------------
Write-Host "3) config.json" -ForegroundColor White
$config = $null
if (Test-Path $configPath) {
    try {
        $config = Get-Content -Raw -Path $configPath | ConvertFrom-Json
        Say-Pass "config.json found and is valid JSON"
        if ($config.businessUnitId) { Say-Info "businessUnitId = $($config.businessUnitId)  (expected: b1)" }
        if ($config.databaseId)     { Say-Info "databaseId     = $($config.databaseId)  (expected: tng-systems)" }
        if ("$($config.businessUnitId)" -ne 'b1') { Say-Warn "businessUnitId is not 'b1' - Fun Roof should be b1." }
    } catch {
        Say-Fail "config.json exists but is NOT valid JSON: $($_.Exception.Message)"
    }
} else {
    Say-Fail "config.json not found at $configPath"
    Say-Info "Copy the template:  copy `"$scriptDir\config.example.json`" `"$configPath`""
}

# ----------------------------------------------------------------------------
# 4) service-account key file exists (resolved the same way the bridge does:
#    relative paths are relative to the config file's folder)
# ----------------------------------------------------------------------------
Write-Host "4) Firebase service-account key" -ForegroundColor White
if ($config -and $config.serviceAccountPath) {
    $saRaw = "$($config.serviceAccountPath)"
    if ([System.IO.Path]::IsPathRooted($saRaw)) {
        $saPath = $saRaw
    } else {
        $saPath = Join-Path $bridgeRoot $saRaw
    }
    if (Test-Path $saPath) {
        Say-Pass "Service-account key found: $saPath"
        # sanity: is it JSON with a private_key? (read-only, never printed)
        try {
            $sa = Get-Content -Raw -Path $saPath | ConvertFrom-Json
            if ($sa.private_key -and $sa.client_email) { Say-Info "Key looks like a valid service account (project: $($sa.project_id))" }
            else { Say-Warn "Key file is JSON but missing private_key/client_email - is this the right file?" }
        } catch { Say-Fail "Service-account file is not valid JSON - the bridge cannot authenticate. Re-download it from the TNG admin." }
    } else {
        Say-Fail "Service-account key not found at: $saPath"
        Say-Info "Ask the TNG admin for the key and save it there (never email/commit it)."
    }
} else {
    Say-Warn "Cannot check the key - config.json is missing or has no serviceAccountPath."
}

# ----------------------------------------------------------------------------
# 5) Printer reachable on the network (TCP connect only - sends NOTHING, prints
#    NOTHING). Uses the host/port from config.json, or the known default.
# ----------------------------------------------------------------------------
Write-Host "5) Printer network reachability (TCP connect - no printing)" -ForegroundColor White
$targets = @()
if ($config -and $config.printers) {
    foreach ($station in 'KITCHEN','BAR') {
        $p = $config.printers.$station
        if ($p -and $p.host) { $targets += [pscustomobject]@{ Station=$station; Host="$($p.host)"; Port=[int]$p.port } }
    }
}
if ($targets.Count -eq 0) {
    Say-Warn "No printers in config.json - testing the known default 192.168.100.104:9100"
    $targets += [pscustomobject]@{ Station='DEFAULT'; Host='192.168.100.104'; Port=9100 }
}
# de-duplicate identical host:port so we don't test the same printer twice
$seen = @{}
foreach ($t in $targets) {
    $key = "$($t.Host):$($t.Port)"
    if ($seen.ContainsKey($key)) { Say-Info "$($t.Station) uses the same printer as another station ($key) - already tested"; continue }
    $seen[$key] = $true
    Say-Info "Testing $($t.Station) -> $key (this can take up to ~20s if unreachable)..."
    $ok = $false
    try { $ok = Test-NetConnection -ComputerName $t.Host -Port $t.Port -InformationLevel Quiet -WarningAction SilentlyContinue } catch { $ok = $false }
    if ($ok) { Say-Pass "Printer reachable at $key (TcpTestSucceeded = True)" }
    else     { Say-Fail "Printer NOT reachable at $key - see the printer troubleshooting in README_TFR_WINDOWS.md" }
}

# ----------------------------------------------------------------------------
# 6) Internet / Firebase reachable (needed so the bridge can read print jobs)
# ----------------------------------------------------------------------------
Write-Host "6) Internet / Firebase reachability" -ForegroundColor White
$netOk = $false
try { $netOk = Test-NetConnection -ComputerName 'firestore.googleapis.com' -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue } catch { $netOk = $false }
if ($netOk) { Say-Pass "Internet OK (firestore.googleapis.com:443 reachable)" }
else        { Say-Fail "Cannot reach firestore.googleapis.com:443 - check the laptop's Wi-Fi / internet." }

# ----------------------------------------------------------------------------
# 7) Sleep reminder
# ----------------------------------------------------------------------------
Write-Host "7) Power settings" -ForegroundColor White
Say-Warn "REMINDER: the laptop must NOT sleep, or auto-printing stops."
Say-Info "Windows Settings -> System -> Power & battery -> Screen and sleep ->"
Say-Info "  'When plugged in, put my device to sleep after' = Never."

# ----------------------------------------------------------------------------
# summary
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host " Summary: $script:passCount passed, $script:warnCount warnings, $script:failCount failed" -ForegroundColor Cyan
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
if ($script:failCount -eq 0) {
    Write-Host " READY. You can start the bridge:  .\start-tfr-bridge.ps1" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host " NOT READY. Fix the [FAIL] items above, then run this again." -ForegroundColor Red
    Write-Host ""
    exit 1
}
