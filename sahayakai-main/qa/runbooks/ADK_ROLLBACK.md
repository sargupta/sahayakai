# ADK Migration — Rollback Runbook

**Audience:** on-call engineer at 3am. Read top-to-bottom; pick the section that matches the alert.

**Golden rule:** flip flags first (seconds), fix code later. Shadow mode is safe — Genkit serves users, sidecar runs fire-and-forget.

**Modes:**
- `shadow` — Genkit serves user; sidecar called async, response discarded. Safe.
- `canary` — `<percent>%` of traffic served by sidecar; rest by Genkit.
- `full` — 100% sidecar, Genkit not called.

---

## 1. Single-agent revert — canary/full → shadow

**Use when:** one agent is misbehaving (5xx, slow, wrong output), rest of the system is fine.

```bash
cd /Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main
node scripts/flag-flip.mjs --agent <name> --mode shadow --percent 100
```

`<name>` is the agent key (e.g. `quiz`, `lessonPlan`, `instantAnswer`, `vidya`, `parentMessage`, `visualAid`, `videoStoryteller`, `worksheet`, `rubric`, `examPaper`, `teacherTraining`, `virtualFieldTrip`, `assignmentAssessor`, `voiceToText`, `avatar`, `communityPersonaMessage`, `parentCall`, `scanner`).

**Verify (read flag back):**
```bash
node scripts/check-p0-flags.mjs --agent <name>
# OR direct Firestore read:
node -e "const a=require('firebase-admin');a.initializeApp();a.firestore().doc('config/featureFlags').get().then(s=>console.log(JSON.stringify({mode:s.data()['<name>SidecarMode'],pct:s.data()['<name>SidecarPercent']},null,2)))"
```

**Expected after flip:**
- Dispatcher (`src/ai/dispatcher.ts`) routes 100% of `<name>` traffic to Genkit.
- Sidecar still called fire-and-forget for shadow-diff telemetry; response discarded.
- User-visible behaviour reverts to pre-migration Genkit output within ~30s (flag cache TTL).

**If the flag flip doesn't take effect within 60s:** flag cache may be stale on a specific Cloud Run instance — force traffic rotation by issuing a no-op revision update:
```bash
gcloud run services update sahayakai-hotfix-resilience --region=asia-southeast1 --project=sahayakai-b4248 --update-labels=flag-bust=$(date +%s)
```

---

## 2. Full-system kill-switch — all 18 agents → shadow

**Use when:**
- Sidecar wide outage (Cloud Run service down, image broken, OOM looping).
- Security incident (suspected sidecar compromise, leaked audience secret).
- Cross-agent regression detected (shadow-diff scores cratered across the board).

**Single command:**
```bash
cd /Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main
node scripts/adk-shadow-flip.mjs --off
```

This script does a single Firestore batched write that sets every `<agent>SidecarMode` to `shadow` and every `<agent>SidecarPercent` to `100` in one atomic commit on `config/featureFlags`. All 18 agents flip together — no partial state.

**Verify:**
```bash
node scripts/check-p0-flags.mjs --all
```
Every row should read `mode=shadow, pct=100`.

**Reactivation (after the underlying issue is fixed):** do NOT use `--on` blindly. Bring agents back one at a time via the per-agent canary scripts (e.g. `scripts/avatar-shadow-to-canary.mjs`) so you can watch shadow-diff scores between steps.

---

## 3. Sidecar Cloud Run revision rollback

**Use when:** new sidecar revision is the proximate cause (regression introduced by a deploy, not a flag flip).

### 3.1. Find the previous "known good" revision

```bash
gcloud run revisions list \
  --service=sahayakai-agents \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --limit=10 \
  --format="table(metadata.name,status.conditions[0].lastTransitionTime,spec.containers[0].image,status.traffic.percent)"
```

Cross-reference the `image` column against `gcr.io/sahayakai-b4248/sahayakai-agents:<tag>` git tags / commit SHAs. The "known good" revision is the most recent one BEFORE the bad deploy, that previously carried 100% traffic without paging.

### 3.2. Flip traffic to the known-good revision

**Production:**
```bash
gcloud run services update-traffic sahayakai-agents \
  --to-revisions=<previous-rev>=100 \
  --region=asia-southeast1 \
  --project=sahayakai-b4248
```

**Staging:**
```bash
gcloud run services update-traffic sahayakai-agents-staging \
  --to-revisions=<previous-rev>=100 \
  --region=asia-southeast1 \
  --project=sahayakai-b4248
```

### 3.3. Verify

```bash
# 1. Traffic split
gcloud run services describe sahayakai-agents --region=asia-southeast1 --project=sahayakai-b4248 --format="value(status.traffic)"

# 2. Health probe
curl -sf https://sahayakai-agents-<hash>-as.a.run.app/healthz && echo OK

# 3. End-to-end via dispatcher: trigger one canary agent, watch sidecar logs
gcloud run services logs read sahayakai-agents --region=asia-southeast1 --project=sahayakai-b4248 --limit=50
```

---

## 4. Next.js prod redeploy after a regression

**Use when:** the bug is in Genkit / dispatcher / API route code (not sidecar), and a previous main commit was healthy.

```bash
cd /Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main
git checkout main
git pull origin main
git log --oneline -10                   # identify last known-good commit
git checkout <good-sha>                  # OR revert the bad commit, push to main, then deploy HEAD
bash scripts/safe-deploy.sh
```

**Hard rules (from `MEMORY.md`):**
- **NEVER** run raw `gcloud run deploy` for `sahayakai-hotfix-resilience` — it races with parallel sessions and silently clobbers earlier deploys. Always use `scripts/safe-deploy.sh`.
- `safe-deploy.sh` aborts if (a) any Cloud Build is in flight, (b) the most recent revision was created <90s ago, (c) the working tree is dirty.
- Default mode is `--no-traffic --tag=dep-<sha>` — the revision builds and warms but does NOT auto-route. Flip traffic explicitly:
  ```bash
  gcloud run services update-traffic sahayakai-hotfix-resilience --region=asia-southeast1 --to-latest
  ```
- Before AND after every deploy, run:
  ```bash
  bash scripts/audit-deployments.sh
  ```
  Post-deploy: probes the live URL for known feature markers; any `✗` means redeploy needed.

---

## 5. Specific failure modes & responses

### 5.1. "Sidecar 5xx spike on agent X"
**Symptoms:** Cloud Run error rate alert; dispatcher fallback logs spiking for one agent.

1. Flip the offending agent to shadow (§1).
2. Capture sidecar logs for the last 15 min:
   ```bash
   gcloud run services logs read sahayakai-agents --region=asia-southeast1 --project=sahayakai-b4248 --limit=500 > /tmp/sidecar-$(date +%Y%m%dT%H%M).log
   ```
3. Grep for stack traces, OOM markers (`exceeded memory limit`), or `audience` / `app-check` errors.
4. Page sidecar team (§6 L2). Attach the log dump.
5. Open postmortem stub (§7).

### 5.2. "VIDYA voice broken — no STT response"
**Symptoms:** OmniOrb mic spins forever; user reports no transcript.

1. Check Next.js route logs:
   ```bash
   gcloud run services logs read sahayakai-hotfix-resilience --region=asia-southeast1 --project=sahayakai-b4248 --limit=200 | grep -i "voice-to-text\|/api/assistant\|sarvam"
   ```
2. Check Sarvam AI status page / API key validity (Sarvam handles `ne`/`as`; for Hindi-only English fallback it's Google STT).
3. If Sarvam is down: flip `voiceToText` to shadow (§1) — Genkit path uses Google STT only, loses `ne`/`as` but English/Hindi work.
4. If sidecar `vidya` is the culprit: flip `vidya` to shadow (§1).
5. Verify in browser DevTools: `/api/ai/voice-to-text` should return 200 with `{ transcript }`.

### 5.3. "Audience-secret regression — all agents falling back to Genkit"
**Symptoms:** dispatcher logs show `401 invalid_audience` from sidecar across every agent; shadow-diff dashboard reads 0% sidecar coverage.

**Immediate fix (manual env-var patch on the staging sidecar):**
```bash
gcloud run services update sahayakai-agents-staging \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --update-env-vars=SAHAYAKAI_AGENTS_AUDIENCE=<staging-service-URL>
```

For production, replace `sahayakai-agents-staging` with `sahayakai-agents` and use the prod service URL.

**Longer-term:** Q4.B work to bake audience into Cloud Build via substitution variables so manual env patches aren't needed. Until then, document the value in `cloudbuild-agents.yaml` and re-apply on every revision.

### 5.4. "AppCheck verification failing"
**Symptoms:** sidecar 403s with `app-check` in error body; browser users get `auth/no-token` errors.

1. Check sidecar env:
   ```bash
   gcloud run services describe sahayakai-agents --region=asia-southeast1 --project=sahayakai-b4248 --format="value(spec.template.spec.containers[0].env)" | tr ',' '\n' | grep -i app_check
   ```
   `SAHAYAKAI_REQUIRE_APP_CHECK` should be `true` in prod, may be `false` in staging.
2. If the env var got dropped by a bad cloudbuild deploy: re-apply via `--update-env-vars=SAHAYAKAI_REQUIRE_APP_CHECK=true` on the service.
3. Verify cloudbuild state — did the last `cloudbuild-agents.yaml` run succeed end-to-end?
   ```bash
   gcloud builds list --project=sahayakai-b4248 --limit=5
   ```
4. If AppCheck infrastructure (Firebase) is the issue: temporarily flip `SAHAYAKAI_REQUIRE_APP_CHECK=false` on sidecar (accept the risk), or kill-switch all agents to shadow (§2) until Firebase recovers.

### 5.5. "Feature-flag Firestore doc corrupted"
**Symptoms:** dispatcher logs spam `flag parse error`; agents random-route or all-fallback.

1. Snapshot the current bad state for forensics:
   ```bash
   node -e "const a=require('firebase-admin');a.initializeApp();a.firestore().doc('config/featureFlags').get().then(s=>require('fs').writeFileSync('/tmp/flags-corrupted-'+Date.now()+'.json',JSON.stringify(s.data(),null,2)))"
   ```
2. Restore from yesterday's backup. Firestore PITR is enabled — use the Cloud Console import-from-backup UI, OR if a known-good JSON snapshot exists in `qa/feature-flag-snapshots/`:
   ```bash
   node scripts/restore-feature-flags.mjs --from qa/feature-flag-snapshots/<YYYY-MM-DD>.json
   ```
3. If no recent snapshot exists: hand-rebuild by running `node scripts/adk-shadow-flip.mjs --off` (sets all 18 to shadow@100) — this is the safe default.
4. Verify with `node scripts/check-p0-flags.mjs --all`.

---

## 6. Escalation matrix

| Tier | Owner | Handles | Reach via |
|------|-------|---------|-----------|
| **L1** | On-call engineer | Flag flips (§1, §2), traffic rerouting (§3), runbook execution | PagerDuty primary |
| **L2** | Sidecar team (Python/ADK) | Sidecar bugs, ADK upgrades, audience-secret issues, sidecar Cloud Run config | Slack `#sidecar-oncall`, PagerDuty `sidecar` rotation |
| **L3** | Web team (Next.js/dispatcher) | Dispatcher TS bugs, flag-plane schema, Genkit flow regressions, API route issues | Slack `#web-oncall`, PagerDuty `web` rotation |
| **Security** | Security lead | Suspected breach, audience-secret leak, AppCheck bypass | PagerDuty `security`, direct phone |
| **Billing** | Finance lead | Cloud Run cost spike (>2× baseline), Vertex AI quota burn | Email `finance@`, non-pager |

**Default escalation flow:** L1 stabilises (flip to shadow), then pages L2 or L3 based on symptom locus. Security and billing are out-of-band — page directly when applicable, do NOT chain through L1→L2→L3.

---

## 7. Postmortem template

**Every revert must be followed by a postmortem.** Create at `qa/postmortems/<YYYY-MM-DD>-<short-slug>.md` within 24h of incident close.

```markdown
# Postmortem — <date> — <short-slug>

## Summary
One sentence: what broke, who saw it, how long, how we recovered.

## Timeline (UTC)
- HH:MM — first signal (alert / user report)
- HH:MM — on-call ack
- HH:MM — mitigation applied (e.g. flag flip to shadow)
- HH:MM — user-visible recovery confirmed
- HH:MM — root cause identified
- HH:MM — durable fix deployed

## Impact
- Users affected: <count or %>
- Agents affected: <list>
- Duration of user impact: <minutes>
- Revenue / SLO impact: <if known>

## Root cause
What actually went wrong. Be specific — bad commit SHA, env var typo, race condition.

## Detection
How did we find out? Alert vs user report. Was the alert good (paged at the right threshold) or noisy/late?

## Mitigation
Which runbook section was used. Did it work as written? What was missing?

## Action items
- [ ] OWNER — durable fix for root cause — by <date>
- [ ] OWNER — runbook update if the response was clumsy — by <date>
- [ ] OWNER — alert tuning if detection was slow — by <date>
- [ ] OWNER — test added to prevent regression — by <date>

## What went well
At least one thing. Morale matters.

## What went poorly
Be honest. No blame, just facts.
```

**Filing convention:** commit the postmortem to `develop` within 48h; link from the incident PagerDuty record.
