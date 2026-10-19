<#
.SYNOPSIS
  Isolated non-production Riya staging, step by step, on Windows. Never touches production.

.DESCRIPTION
  Run the steps in order from sahayakai-main. Each step stops at the first failure.
    -Step Verify     read-only ElevenLabs check: which agent/branch the number is assigned to, SIP, outbound
    -Step Infra      create/verify the sampark-nonprod database and the RIYA_* secrets (hidden prompts)
    -Step Deploy     build and deploy sahayakai-riya-staging (cloudbuild-riya-staging.yaml), smoke test
    -Step Webhook    after you add the post-call webhook in ElevenLabs: store its secret, roll a revision,
                     then signed checks over HTTPS (bad 401, stale 401, other agent 200, unlinked 503)
    -Step WindowOn   staging-only calling-window override for ONE controlled test (max 3 h, self-expiring)
    -Step WindowOff  remove the override (do this right after the call)
    -Step Status     show the service URL, webhook health and whether the override is set

  Secrets are typed at hidden prompts and piped straight to Secret Manager; nothing is written to the
  repository or printed. Only non-secret ids are kept in %TEMP%\riya-staging\ids.json.
  Requires: gcloud signed in as a user with roles on sahayakai-b4248 (see -Step Infra errors), Node 20.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Verify', 'Infra', 'Deploy', 'Webhook', 'WindowOn', 'WindowOff', 'Status')][string]$Step,
    [string]$Project = 'sahayakai-b4248',
    [string]$Region = 'asia-southeast1',
    [string]$PhoneNumberId = 'phnum_8101m535s90df9qa3jy6mdh2b864',
    [string]$SourceExport = 'E:\sargvision\sahayakcallagentvarunesh.txt',
    [ValidateRange(10, 180)][int]$WindowMinutes = 60,
    # Only when the verifier cannot read the source agent (it lives in another workspace): you looked in
    # THAT workspace and its number is still assigned to the source agent. Never set it without looking.
    [switch]$SourceNumberCheckedManually
)
# 'Continue': Windows PowerShell 5.1 turns a native command's stderr (2>&1) into a terminating
# error under 'Stop'. Every native call below is checked through $LASTEXITCODE instead.
$ErrorActionPreference = 'Continue'
$Service = 'sahayakai-riya-staging'
$StateDir = Join-Path $env:TEMP 'riya-staging'
$IdsFile = Join-Path $StateDir 'ids.json'
New-Item -ItemType Directory -Force $StateDir | Out-Null
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))

function Fail([string]$m) { Write-Host "STOPPED: $m" -ForegroundColor Red; exit 1 }
function Ok([string]$m) { Write-Host "  ok  $m" -ForegroundColor Green }
function Read-Secret([string]$label) {
    $sec = Read-Host -AsSecureString "$label (input hidden)"
    $plain = [System.Net.NetworkCredential]::new('', $sec).Password
    if (-not $plain) { Fail "$label was empty" }
    return $plain
}
function Gcloud-Ok { $acct = (& gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>$null); if (-not $acct) { Fail 'gcloud is not signed in. Run: gcloud auth login' }; Ok "gcloud account $acct" }
function Service-Url { (& gcloud run services describe $Service --region=$Region --project=$Project --format='value(status.url)' 2>$null) }
function Save-Ids($o) { $o | ConvertTo-Json | Set-Content -Encoding ascii $IdsFile }
function Load-Ids { if (-not (Test-Path $IdsFile)) { Fail 'run -Step Verify first' }; Get-Content $IdsFile -Raw | ConvertFrom-Json }
function Secret-Exists([string]$name) { & gcloud secrets describe $name --project=$Project *> $null; return ($LASTEXITCODE -eq 0) }
function Put-Secret([string]$name, [string]$value) {
    if (Secret-Exists $name) { $value | & gcloud secrets versions add $name --data-file=- --project=$Project | Out-Null }
    else { $value | & gcloud secrets create $name --data-file=- --replication-policy=automatic --project=$Project | Out-Null }
    if ($LASTEXITCODE -ne 0) { Fail "could not write secret $name (needs roles/secretmanager.admin on $Project)" }
    Ok "secret $name stored (value not shown)"
}

switch ($Step) {
    'Verify' {
        $key = Read-Secret 'ElevenLabs API key'
        $env:ELEVENLABS_API_KEY = $key
        try {
            $report = Join-Path $StateDir 'riya-clone-report.md'
            $out = & node scripts/sampark/verify-riya-clone.mjs --phone-number-id $PhoneNumberId --source-file $SourceExport --out $report 2>&1
            $code = $LASTEXITCODE
        } finally { Remove-Item Env:ELEVENLABS_API_KEY -ErrorAction SilentlyContinue; $key = $null }
        $out | ForEach-Object { Write-Host $_ }
        $line = $out | Where-Object { "$_" -like 'RIYA_TARGET *' } | Select-Object -First 1
        if (-not $line -or "$line" -notmatch '^RIYA_TARGET agent=(agent_\w+) branch=(\S*)$') { Fail 'the number is not assigned to any agent, or the key cannot read it (see above)' }
        $agent = $Matches[1]; $branch = $Matches[2]
        $src = (Get-Content $SourceExport -Raw); $src = $src.Substring($src.IndexOf('{')) | ConvertFrom-Json
        if ($agent -eq $src.agent_id) { Fail 'the number is assigned to Varunesh''s SOURCE agent. Stop: do not reassign it here.' }
        $must = '1 ids and name', '5d preview opening = agent first message', '11a number assigned to the clone', '11b outbound SIP trunk configured', '11d outbound calls enabled', '11e outbound transport', '11f outbound authentication configured', '8d every agent variable is supplied by Sahayak', '12e AI disclosure in first message'
        # 11g needs the live source agent. If this key cannot read it (another workspace), the check is
        # UNVERIFIED and you must confirm it yourself in that workspace (-SourceNumberCheckedManually).
        if (-not (Select-String -Path $report -SimpleMatch '| 11g original agent keeps its own number | PASS |' -Quiet)) {
            if (-not $SourceNumberCheckedManually) { Fail '11g is not PASS: open the source agent''s workspace, confirm its number is still assigned to it, then re-run with -SourceNumberCheckedManually' }
            Write-Host '  note  11g confirmed manually by the operator (source agent not readable with this key)' -ForegroundColor Yellow
        }
        $failed = foreach ($m in $must) { if (-not (Select-String -Path $report -SimpleMatch "| $m | PASS |" -Quiet)) { $m } }
        Save-Ids @{ agentId = $agent; branchId = $branch; phoneNumberId = $PhoneNumberId; sourceAgentId = $src.agent_id }
        Write-Host "Report: $report  (exit $code)"
        if ($failed) { Fail ("required checks not passing: " + ($failed -join '; ')) }
        Ok "clone $agent, branch $(if ($branch) { $branch } else { 'main' }), number ${PhoneNumberId}: SIP, outbound, auth, variables PASS"
        Write-Host 'Read 5d/12a/12e/12h in the report too (opening line, recording, AI disclosure, transcript retention).'
    }
    'Infra' {
        Gcloud-Ok
        & gcloud firestore databases describe --database=sampark-nonprod --project=$Project *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Creating Firestore database sampark-nonprod (asia-south1)…'
            & gcloud firestore databases create --database=sampark-nonprod --location=asia-south1 --project=$Project
            if ($LASTEXITCODE -ne 0) { Fail 'could not create sampark-nonprod (needs roles/datastore.owner on the project)' }
        }
        Ok 'database sampark-nonprod exists'
        Put-Secret 'RIYA_ELEVENLABS_API_KEY' (Read-Secret 'ElevenLabs API key for staging')
        foreach ($n in 'RIYA_SAMPARK_PII_KEY', 'RIYA_SAMPARK_PHONE_PEPPER') {
            if (Secret-Exists $n) { Ok "secret $n already exists (kept: changing it would make stored phones unreadable)"; continue }
            $bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
            Put-Secret $n ([Convert]::ToBase64String($bytes))
        }
        if (-not (Secret-Exists 'RIYA_ELEVENLABS_WEBHOOK_SECRET')) {
            # Placeholder until -Step Webhook stores the real one from ElevenLabs; signed events fail until then.
            $bytes = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
            Put-Secret 'RIYA_ELEVENLABS_WEBHOOK_SECRET' ([Convert]::ToBase64String($bytes))
        }
        $sa = (& gcloud projects describe $Project --format='value(projectNumber)') + '-compute@developer.gserviceaccount.com'
        foreach ($n in 'RIYA_ELEVENLABS_API_KEY', 'RIYA_ELEVENLABS_WEBHOOK_SECRET', 'RIYA_SAMPARK_PII_KEY', 'RIYA_SAMPARK_PHONE_PEPPER') {
            & gcloud secrets add-iam-policy-binding $n --member="serviceAccount:$sa" --role=roles/secretmanager.secretAccessor --project=$Project *> $null
            if ($LASTEXITCODE -ne 0) { Fail "could not grant $sa access to $n" }
        }
        Ok "runtime service account $sa can read the RIYA_* secrets"
    }
    'Deploy' {
        Gcloud-Ok
        $ids = Load-Ids
        if ((& git status --porcelain)) { Fail 'the worktree has uncommitted changes; commit or stash first' }
        $sha = (& git rev-parse --short HEAD)
        & gcloud builds submit .. --project=$Project --config=cloudbuild-riya-staging.yaml `
            --substitutions="SHORT_SHA=$sha,_AGENT_ID=$($ids.agentId),_AGENT_BRANCH_ID=$($ids.branchId),_PHONE_NUMBER_ID=$($ids.phoneNumberId),_SOURCE_AGENT_ID=$($ids.sourceAgentId)"
        if ($LASTEXITCODE -ne 0) { Fail 'Cloud Build failed (needs roles/cloudbuild.builds.editor and run.admin; see the build log above)' }
        $url = Service-Url; Ok "deployed $url (commit $sha)"
        Write-Host "Now add the post-call webhook in ElevenLabs: URL $url/api/webhooks/elevenlabs-riya, HMAC on, clone only, no audio. Then run -Step Webhook."
    }
    'Webhook' {
        Gcloud-Ok
        $ids = Load-Ids; $url = Service-Url; if (-not $url) { Fail 'service not deployed' }
        $secret = Read-Secret 'Webhook secret ElevenLabs showed for this webhook'
        Put-Secret 'RIYA_ELEVENLABS_WEBHOOK_SECRET' $secret
        & gcloud run services update $Service --region=$Region --project=$Project --update-secrets=ELEVENLABS_WEBHOOK_SECRET=RIYA_ELEVENLABS_WEBHOOK_SECRET:latest --quiet | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail 'could not roll a revision with the new secret' }
        $hook = "$url/api/webhooks/elevenlabs-riya"
        $h = try { (Invoke-WebRequest -Uri $hook -Method GET -UseBasicParsing -TimeoutSec 60).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
        if ($h -ne 200) { Fail "webhook health GET -> $h (expected 200)" }; Ok "GET $hook -> 200"
        $env:ELEVENLABS_WEBHOOK_SECRET = $secret; $env:ELEVENLABS_AGENT_ID = $ids.agentId
        try {
            $conv = 'conv_stagingcheck_' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            $checks = @(
                @{ n = 'bad signature'; a = @('--bad-signature'); want = 'HTTP 401' },
                @{ n = 'stale signature'; a = @('--stale'); want = 'HTTP 401' },
                @{ n = 'another agent'; a = @('--agent', 'agent_otherotherotherotherother000'); want = 'HTTP 200' },
                @{ n = 'unlinked conversation (retryable)'; a = @(); want = 'HTTP 503' }
            )
            foreach ($c in $checks) {
                $r = & node scripts/sampark/send-test-riya-webhook.mjs --staging --url $hook --conversation $conv @($c.a) 2>&1 | Select-Object -Last 1
                if ("$r" -notlike "$($c.want)*") { Fail "$($c.n): got '$r', expected $($c.want)" }
                Ok "$($c.n): $r"
            }
        } finally { Remove-Item Env:ELEVENLABS_WEBHOOK_SECRET, Env:ELEVENLABS_AGENT_ID -ErrorAction SilentlyContinue; $secret = $null }
        Write-Host 'Signed checks pass over public HTTPS. Persistence of a real result is proven only by the real call.'
    }
    'WindowOn' {
        Gcloud-Ok
        $until = [DateTimeOffset]::UtcNow.AddMinutes($WindowMinutes).ToString('yyyy-MM-ddTHH:mm:ssZ')
        & gcloud run services update $Service --region=$Region --project=$Project --update-env-vars="SAMPARK_RIYA_STAGING_TEST_WINDOW_UNTIL=$until" --quiet | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail 'could not set the override' }
        Ok "staging test window open until $until UTC (expires by itself; run -Step WindowOff after the call)"
    }
    'WindowOff' {
        Gcloud-Ok
        & gcloud run services update $Service --region=$Region --project=$Project --remove-env-vars=SAMPARK_RIYA_STAGING_TEST_WINDOW_UNTIL --quiet | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail 'could not remove the override' }
        Ok 'override removed; normal school calling hours apply'
    }
    'Status' {
        Gcloud-Ok
        $url = Service-Url; if (-not $url) { Fail "$Service is not deployed" }
        $h = try { (Invoke-WebRequest -Uri "$url/api/webhooks/elevenlabs-riya" -UseBasicParsing -TimeoutSec 60).StatusCode } catch { $_.Exception.Response.StatusCode.value__ }
        $envs = & gcloud run services describe $Service --region=$Region --project=$Project --format='value(spec.template.spec.containers[0].env)'
        Write-Host "URL      $url"
        Write-Host "Webhook  GET -> $h"
        Write-Host ("Override " + $(if ("$envs" -match 'SAMPARK_RIYA_STAGING_TEST_WINDOW_UNTIL') { 'SET' } else { 'not set' }))
    }
}
