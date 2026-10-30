<#
.SYNOPSIS
  Start the local Riya x Sahayak stack (Firestore emulator + seed + next dev) on Windows.

.DESCRIPTION
  A thin wrapper: it puts the project's portable Node 20 first on PATH for this window only,
  checks Java, and runs scripts/sampark/riya-local.mjs, which does the actual work and was
  tested end to end. Nothing global is changed (no npm/Node install, no Firebase experiment),
  and no secret is written to disk: the disposable PII key, pepper and webhook secret live only
  in the launcher's memory.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sampark\Start-Riya-Local.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sampark\Start-Riya-Local.ps1 -Stop
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\sampark\Start-Riya-Local.ps1 -RealCall
#>
[CmdletBinding()]
param(
    [string]$ToolsDir = 'E:\sargvision\riya-tools',
    [switch]$Stop,
    [switch]$ReuseEmulator,
    [switch]$RealClock,
    [switch]$NoOpen,
    # The one authorised real Riya test call (RIYA_LOCAL_SETUP.md section 11.6). Asks for the
    # ElevenLabs key with hidden input when ELEVENLABS_API_KEY is not already set in this window.
    [switch]$RealCall,
    # Optional: a local file holding the ElevenLabs key (read into this window's process only, never printed).
    [string]$KeyFile,
    # Keep emulator data and the local disposable keys between runs (outside the repository).
    [switch]$Persist,
    # Run without the interactive menu (stop with -Stop).
    [switch]$NoMenu,
    [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repo

# Node 20: the portable copy under $ToolsDir, else whatever is on PATH (must be >= 20).
$nodeExe = Get-ChildItem -Path $ToolsDir -Recurse -Filter node.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' } | Select-Object -First 1
if ($nodeExe) {
    $env:Path = "$($nodeExe.DirectoryName);$env:Path"
    Write-Host "Using Node from $($nodeExe.DirectoryName)"
}
$nodeVersion = (& node -v) 2>$null
if (-not $nodeVersion -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 20) {
    Write-Error "Node 20 or newer not found (got '$nodeVersion'). Pass -ToolsDir with the folder that contains node.exe."
    exit 1
}
Write-Host "Node $nodeVersion"

if ($Stop) {
    & node scripts/sampark/riya-local.mjs --stop
    exit $LASTEXITCODE
}

if (-not $ReuseEmulator) {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        $env:Path = "$(Join-Path $env:JAVA_HOME 'bin');$env:Path"
    }
    $javaLine = (& cmd /c 'java -version 2>&1' | Select-Object -First 1)
    if (-not $javaLine) {
        Write-Error 'Java was not found. Install Java 17 (or set JAVA_HOME) and retry.'
        exit 1
    }
    Write-Host "Java: $javaLine"
}

$launcherArgs = @('scripts/sampark/riya-local.mjs', '--port', "$Port")
if ($ReuseEmulator) { $launcherArgs += '--reuse-emulator' }
if ($RealClock) { $launcherArgs += '--real-clock' }
if ($NoOpen) { $launcherArgs += '--no-open' }
if ($RealCall) {
    if (-not $env:ELEVENLABS_API_KEY -and $KeyFile) {
        $raw = (Get-Content -Raw $KeyFile).Trim()
        if ($raw -match '=') { $raw = ($raw -split '=', 2)[1].Trim().Trim('"', "'") }
        $env:ELEVENLABS_API_KEY = $raw
        Remove-Variable raw
    }
    if (-not $env:ELEVENLABS_API_KEY) {
        $sec = Read-Host -AsSecureString 'ElevenLabs API key (input hidden; kept in this window only)'
        $env:ELEVENLABS_API_KEY = [System.Net.NetworkCredential]::new('', $sec).Password
        Remove-Variable sec
    }
    $launcherArgs += '--real-call'
}
if ($Persist) { $launcherArgs += '--persist' }
if ($NoMenu) { $launcherArgs += '--no-menu' }

& node @launcherArgs
exit $LASTEXITCODE
