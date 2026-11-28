# One click: SahayakAI + SamparkAI with REAL calls to the Sargvision class (ElevenLabs, Vobiz,
# Plivo and Exotel — Plivo/Exotel only when their credential files are filled in).
#
# Everything Start-Sahayak-Demo.cmd starts, plus:
#   - the Vobiz voice bridge (sahayakai-agents, :8091, Riya on Gemini Live)
#   - a webhook gateway (:3010 app webhooks only, :8092 bridge stream only) — the tunnels reach
#     ONLY these paths, never the dev server or its development login
#   - two cloudflared quick tunnels (https) for Vobiz callbacks and the media stream
# Real calls: only the 9 Sargvision roster numbers (scripts/sampark/sargvision-roster.json, consent
# recorded); up to 5 calls per contact per day; class-wide batch calls on (rolling: 3 at once, a new
# call every 60 s, confirmation required). Secrets are read from files and never printed.
#
# Stop with Stop-Sahayak-Demo.cmd (also stops the bridge, gateway and tunnels).

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
$State = Join-Path $env:TEMP 'riya-local'
New-Item -ItemType Directory -Force -Path $State | Out-Null
$ExtraPids = Join-Path $State 'realcall-pids.json'
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source; if (-not $Node) { $Node = 'E:\NodeJS\node.exe' }
$Cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $Cloudflared) { foreach ($c in @("$env:ProgramFiles\cloudflared\cloudflared.exe", "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", 'C:\Users\Bhagya\.9router\bin\cloudflared.exe')) { if (Test-Path $c) { $Cloudflared = $c; break } } }
if (-not $Cloudflared) { $Cloudflared = 'cloudflared.exe (not found: winget install Cloudflare.cloudflared)' }
$PlivoCred = if ($env:PLIVO_CRED_FILE) { $env:PLIVO_CRED_FILE } else { 'E:\sargvision\PLIVOCRED.txt' }
$ExotelCred = if ($env:EXOTEL_CRED_FILE) { $env:EXOTEL_CRED_FILE } else { 'E:\sargvision\EXOTELCRED.txt' }
$Python = Join-Path $PSScriptRoot '..\sahayakai-agents\.venv\Scripts\python.exe'
# A worktree has no venv of its own: use the main checkout's (same pinned requirements). The bridge
# still runs THIS checkout's code (run_local_voice.py puts its own src/ first on sys.path).
if (-not (Test-Path $Python)) { $Python = 'E:\sargvision\sahayakai\sahayakai-agents\.venv\Scripts\python.exe' }
$VobizCred = if ($env:VOBIZ_CRED_FILE) { $env:VOBIZ_CRED_FILE } else { 'E:\sargvision\VOBIZCRED.txt' }
$ElCred = 'E:\sargvision\Sampark_details.txt'
$AllContacts = 'sv-abhishek,sv-nischay,sv-nandini,sv-shivadeth,sv-varunesh,sv-yash,sv-sachitt,sv-shree,sv-alyssa'

function Step($s) { Write-Host "`n== $s" -ForegroundColor Cyan }
function Fail($s) {
  Write-Host "`nSTOPPED: $s" -ForegroundColor Red
  # Never leave half a stack behind: stop the bridge, gateway and tunnels this run started.
  if (Test-Path $ExtraPids) {
    foreach ($x in (Get-Content $ExtraPids | ConvertFrom-Json)) { try { Stop-Process -Id $x.pid -Force -ErrorAction Stop } catch {} }
    Remove-Item $ExtraPids -Force -ErrorAction SilentlyContinue
  }
  Write-Host 'Nothing is left running. Fix the problem above and double-click Start-Sahayak-RealCalls.cmd again.'
  exit 1
}
function Read-KV($path, $pattern) {
  foreach ($l in Get-Content $path) { if ($l -match $pattern) { return $Matches[1].Trim().Trim('"').Trim("'") } }
  return $null
}

Step '1. Checks'
foreach ($p in @($Cloudflared, $Python, $VobizCred, $ElCred, '.env.development.local')) { if (-not (Test-Path $p)) { Fail "missing $p" } }
Write-Host '   cloudflared, bridge venv, Vobiz and ElevenLabs credential files found'

Step '2. Stop anything from a previous run'
& $Node scripts/sampark/riya-local.mjs --stop | Out-Host
if (Test-Path $ExtraPids) {
  foreach ($x in (Get-Content $ExtraPids | ConvertFrom-Json)) { try { Stop-Process -Id $x.pid -Force -ErrorAction Stop; Write-Host "   stopped $($x.name)" } catch {} }
  Remove-Item $ExtraPids -Force
}

# Shared secrets (never printed).
$SigningKey = Read-KV '.env.development.local' '^SAHAYAKAI_REQUEST_SIGNING_KEY=(.+)$'
$VertexProject = Read-KV '.env.development.local' '^VERTEX_AI_PROJECT=(.+)$'
if (-not $SigningKey -or $SigningKey.Length -lt 32) { Fail 'SAHAYAKAI_REQUEST_SIGNING_KEY missing in .env.development.local' }
$VobizId = Read-KV $VobizCred '^\s*VOBIZ_AUTH_ID\s*[=:]\s*(.+)$'
$VobizToken = Read-KV $VobizCred '^\s*VOBIZ_AUTH_TOKEN\s*[=:]\s*(.+)$'
$ElKey = Read-KV $ElCred '^\s*api key\s*[=:]\s*(.+)$'
$ElAgent = Read-KV $ElCred '^\s*agent id\s*[=:]\s*(.+)$'
$ElPhone = Read-KV $ElCred '^\s*phone number id\s*[=:]\s*(.+)$'
if (-not ($VobizId -and $VobizToken)) { Fail "VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN missing in $VobizCred" }
if (-not ($ElKey -and $ElAgent -and $ElPhone)) { Fail "api key / agent id / phone number id missing in $ElCred" }

$extras = @()
function Start-Bg($name, $exe, $argList, $log, $envs) {
  $saved = @{}
  foreach ($k in $envs.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, $envs[$k]) }
  $p = Start-Process -FilePath $exe -ArgumentList $argList -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden -PassThru
  foreach ($k in $envs.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) }
  $script:extras += [pscustomobject]@{ name = $name; pid = $p.Id }
  $script:extras | ConvertTo-Json | Set-Content $ExtraPids
  return $p
}

Step '3. Vobiz voice bridge (:8091) and webhook gateway (:3010 / :8092)'
$bridgeEnv = @{ SAMPARK_WEB_BASE_URL = 'http://127.0.0.1:3000'; VOBIZ_AUTH_ID = $VobizId; VOBIZ_AUTH_TOKEN = $VobizToken;
  NO_COLOR = '1'; FORCE_COLOR = $null; PYTHONIOENCODING = 'utf-8'; FIRESTORE_EMULATOR_HOST = $null; GCLOUD_PROJECT = $null }
# The bridge hangs Plivo calls up over Plivo's REST API (Exotel needs nothing: closing the stream ends it).
if (Test-Path $PlivoCred) {
  $PlivoId = Read-KV $PlivoCred '^\s*PLIVO_AUTH_ID\s*[=:]\s*(.+)$'
  $PlivoToken = Read-KV $PlivoCred '^\s*PLIVO_AUTH_TOKEN\s*[=:]\s*(.+)$'
  if ($PlivoId -and $PlivoToken -and $PlivoId -notmatch '^<') { $bridgeEnv['PLIVO_AUTH_ID'] = $PlivoId; $bridgeEnv['PLIVO_AUTH_TOKEN'] = $PlivoToken }
}
if ($VertexProject) { $bridgeEnv['GOOGLE_CLOUD_PROJECT'] = $VertexProject }
# Riya's pre-rendered opening lines (render with sahayakai-agents\scripts\render_riya_opener.py): the
# parent hears Riya the moment the call connects instead of ~8 s of silence while Live connects.
$OpenerDir = Join-Path $env:LOCALAPPDATA 'riya-local\riya-openers'
New-Item -ItemType Directory -Force -Path $OpenerDir | Out-Null
$bridgeEnv['VOBIZ_RIYA_OPENER_DIR'] = $OpenerDir
# Indian English accent, and a little more patience before a parent's turn ends (fewer 'sorry, can you repeat').
$bridgeEnv['VOBIZ_RIYA_LANGUAGE_CODE'] = 'en-IN'
$bridgeEnv['VOBIZ_RIYA_VAD_SILENCE_MS'] = '500'
# Build the Vertex + Firestore clients at bridge start, not on the first call (4.2 s of dead air).
$bridgeEnv['VOBIZ_RIYA_PREWARM'] = '1'
Start-Bg 'vobiz-bridge' $Python @('..\sahayakai-agents\scripts\run_local_voice.py', '--port', '8091') (Join-Path $State 'vobiz-bridge.log') $bridgeEnv | Out-Null
Start-Bg 'webhook-gateway' $Node @('scripts/sampark/webhook-gateway.mjs', '--app', '3000', '--app-gate', '3010', '--bridge', '8091', '--bridge-gate', '8092') (Join-Path $State 'webhook-gateway.log') @{} | Out-Null
$ok = $false
for ($i = 0; $i -lt 90; $i++) { try { if ((Invoke-WebRequest http://127.0.0.1:8091/healthz -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $ok = $true; break } } catch {}; Start-Sleep 1 }
if (-not $ok) { Fail "the Vobiz bridge did not start (log: $State\vobiz-bridge.log.err)" }
Write-Host '   bridge up (GET /healthz 200); gateway forwarding webhook paths only'

Step '4. Public https tunnels (cloudflared quick tunnels)'
function Start-Tunnel($name, $port) {
  # Quick tunnels sometimes take a while (or fail) to register: wait up to 2 min, retry once.
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    $log = Join-Path $State "$name-$attempt.log"
    Remove-Item "$log", "$log.err" -ErrorAction SilentlyContinue
    $p = Start-Bg $name $Cloudflared @('tunnel', '--no-autoupdate', '--url', "http://127.0.0.1:$port") $log @{}
    for ($i = 0; $i -lt 120; $i++) {
      $t = "$(Get-Content "$log.err" -Raw -ErrorAction SilentlyContinue)$(Get-Content $log -Raw -ErrorAction SilentlyContinue)"
      if ($t -match '(https://[a-z0-9-]+\.trycloudflare\.com)') { return $Matches[1] }
      if ($p.HasExited) { break }
      Start-Sleep 1
    }
    try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch {}
    Write-Host "   the $name tunnel did not come up on attempt $attempt; retrying…"
  }
  Fail "the $name tunnel did not come up after two attempts (logs: $State\$name-*.log.err). Check the internet connection."
}
$PublicBase = Start-Tunnel 'tunnel-app' 3010
$BridgeBase = Start-Tunnel 'tunnel-bridge' 8092
Write-Host "   Vobiz callbacks → $PublicBase  (webhook paths only)"
Write-Host "   Media stream    → $BridgeBase  (stream path only)"

Step '5. SahayakAI + SamparkAI with real calls (ElevenLabs, Vobiz, Plivo, Exotel)'
$env:PLIVO_CRED_FILE = $PlivoCred
$env:EXOTEL_CRED_FILE = $ExotelCred
$env:SAHAYAKAI_REQUEST_SIGNING_KEY = $SigningKey
$env:ELEVENLABS_API_KEY = $ElKey
$env:RIYA_REAL_AGENT_ID = $ElAgent
$env:RIYA_REAL_PHONE_NUMBER_ID = $ElPhone
# The agent the Riya clone was copied from (the app refuses to call through it). Read from the
# original agent's export when this shell does not already carry it (never printed).
$SourceExport = 'E:\sargvision\sahayakcallagentvarunesh.txt'
if (-not $env:RIYA_REAL_SOURCE_AGENT_ID -and (Test-Path $SourceExport)) {
  $m = Select-String -Path $SourceExport -Pattern 'agent_[A-Za-z0-9]{20,}' | Select-Object -First 1
  if ($m) { $env:RIYA_REAL_SOURCE_AGENT_ID = $m.Matches[0].Value }
}
if (-not $env:RIYA_REAL_SOURCE_AGENT_ID) { Fail "RIYA_REAL_SOURCE_AGENT_ID not set and not found in $SourceExport" }
if ($env:RIYA_REAL_SOURCE_AGENT_ID -eq $ElAgent) { Fail 'the configured ElevenLabs agent IS the source agent; use the Riya clone' }
# The single authorised test phone of the separate test school. When this shell does not carry one,
# use a Sargvision roster contact's own number (already allow-listed: nobody new becomes callable).
$TestContact = if ($env:RIYA_TEST_CONTACT) { $env:RIYA_TEST_CONTACT } else { 'sv-alyssa' }
if (-not $env:RIYA_REAL_TEST_NUMBER) {
  $rosterFile = Join-Path $PSScriptRoot 'scripts\sampark\sargvision-roster.local.json'
  if (Test-Path $rosterFile) {
    $c = (Get-Content $rosterFile -Raw | ConvertFrom-Json).contacts | Where-Object { $_.id -eq $TestContact } | Select-Object -First 1
    if ($c) { $env:RIYA_REAL_TEST_NUMBER = $c.phone }
  }
}
if (-not $env:RIYA_REAL_TEST_NUMBER) { Fail "RIYA_REAL_TEST_NUMBER not set and roster contact $TestContact not found" }
$env:VOBIZ_CRED_FILE = $VobizCred
Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue
& $Node scripts/sampark/riya-local.mjs --persist --no-menu --ticker --admin dev-user-123 --demo-family --open-home --port 3000 `
  --real-call --vobiz-call --plivo-call --exotel-call --public-base $PublicBase --bridge-base $BridgeBase --vobiz-allow $AllContacts --batch-real --test-cap 5
