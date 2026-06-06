# ADK Sidecar On-Call Runbook

_Last updated: 2026-06-06. Audience: on-call engineer. Read top to bottom before your first shift._

This runbook covers the ADK Python sidecar (`sahayakai-agents` on Cloud Run, region `asia-southeast1`). The Next.js path and Firebase services have their own runbooks. If a page does not clearly belong to ADK, default to the Next.js runbook and escalate.

## What gets paged

The on-call rotation is paged via Google Cloud Monitoring → PagerDuty → Slack `#sahayakai-oncall`. Alerts that wake you up:

**Sidecar 5xx rate > 2% over 5 minutes.** Severity P1. This is the primary correctness signal. The threshold is deliberately tight because canary is only 10% of traffic — a real incident here is small in absolute terms but high signal.

**Sidecar P95 latency > 8s over 10 minutes.** Severity P2. Most agents target sub-3s. Eight seconds is the point at which the Next.js timeout starts firing and users see Genkit-fallback responses.

**Genkit fallback rate > 5% over 10 minutes.** Severity P2. Next.js falls back to Genkit when the sidecar errors or times out. A spike here means ADK is silently degrading.

**Score-parity nightly job failure or red verdict.** Severity P3, business hours only. The 02:00 SGT job runs the parity harness against fixtures. A red verdict means a model or prompt change has drifted past tolerance.

**Cloud Run instance count pinned at max (20) for > 15 minutes.** Severity P2. Either real load spike or a runaway loop.

**Firebase AI Logic quota > 80% of daily.** Severity P3. Cost / abuse signal.

## First response

When paged, within two minutes:

1. Open the Cloud Run service dashboard for `sahayakai-agents` (bookmarked in `#sahayakai-oncall` channel topic). Confirm the alert is real — sometimes the alert lags recovery by a minute.
2. Check `featureFlags/global` in Firestore (link in channel topic). Note the current canary percentage and any kill-switch state.
3. Decide: is this **broken** (errors, parity red) or **slow** (latency, queue depth)?

The triage tree:

- **Broken and getting worse** → flip the `adk_canary_pct` to `0` in `featureFlags/global` now. This routes everything to Genkit. Then investigate. The cost of an unnecessary failover is small (~30 seconds of cache invalidation). The cost of leaving a broken canary up is teacher complaints.
- **Broken but stable (isolated to one agent)** → set `agents.<name>.enabled` to `false` in `featureFlags/global`. Other agents continue on ADK.
- **Slow but correct** → do not failover yet. Check the Cloud Run instance count. If pinned at max, raise the max in the Cloud Run console (preapproved up to 40); if not pinned, look for downstream latency (Vertex, Firestore).
- **Parity nightly red** → no immediate user impact. Investigate at desk. Do not failover.

After deciding, post in `#sahayakai-oncall` with the action taken, even if the action was "watching." Silence on a page makes the next on-call nervous.

## Common scenarios

**Sidecar returns 5xx on a specific agent.** Most often a schema validation failure after a model upgrade. Check Cloud Logging filtered by `agent_name` for the offending field. Compare against `qa/baseline-schemas/<agent>.json`. If the model is returning a new shape, the immediate fix is to disable that agent's ADK route (per-agent flag) and file a Sev-2 ticket. Do not hand-patch the schema at 2am.

**AppCheck failure (post-Q4.A).** Symptom: 401 from sidecar with `appcheck_invalid` in the response. Cause is almost always a client-side AppCheck token expiry or a clock skew on the Next.js fleet. First check whether Next.js itself is healthy and serving (if Next.js is also seeing AppCheck failures, this is a Firebase incident — escalate to Firebase status page). If Next.js is fine, the problem is the AppCheck-to-sidecar bridge. Temporary mitigation: flip the `bypass_appcheck` flag (auditable, alerts the security channel). Permanent fix during business hours.

**Genkit fallback spike without sidecar 5xx.** Counterintuitive but real. Usually a Cloud Run cold-start storm — instance count just scaled from 1 to 8 and the new instances are still loading model SDKs. Wait three minutes. If it persists, check the sidecar's `/healthz` latency in the Cloud Run "request latency" panel. If `/healthz` itself is slow, the container is unhealthy — roll back to the previous Cloud Run revision via the console (preapproved).

**Latency regression.** Compare current P95 to the per-agent baseline in `qa/parity-scores/<agent>.json` (`latency_p95_ms` field). If the regression is on one agent, suspect a prompt change in the last deploy of `sahayakai-agents`. Check `git log` on that repo's `main` branch for the past 24 hours. Roll back the sidecar revision if the timing aligns. If the regression is across all agents, suspect Vertex region health — check Google Cloud Status for `asia-southeast1`.

**Agent-specific bug reported by support.** Reproduce against the same agent in staging first. If reproducible in staging, file P2; do not page anyone. If only reproducible in prod, capture the request payload (with PII stripped) and run it through the shadow-diff CLI: `scripts/shadow-diff.sh <agent> <fixture-path>`. The CLI prints Genkit vs ADK outputs side by side. If ADK is wrong and Genkit is right, disable that agent's ADK route immediately.

## Communication

`#sahayakai-oncall` — primary channel for incident response. Post within 2 minutes of page, again at action, again at resolution.

`#sahayakai-eng` — broader engineering. Cross-post only at incident open and close, not for every update.

`#sahayakai-leadership` — only for Sev-1 (user-visible outage > 15 minutes, data loss, security). Do not post here speculatively.

Escalation contacts in the PagerDuty schedule, in this order: primary on-call (you), secondary on-call, Platform AI lead, CTO. Skip levels only for Sev-1.

External communication (status page, customer email) is **never** the on-call's call. Escalate to leadership and let them decide.

## Post-incident

Every page that results in a config change, a rollback, or user-visible impact gets a postmortem. Pages that resolved without action get a one-line note in the weekly on-call review, not a full postmortem.

Postmortem template (copy into `qa/postmortems/YYYY-MM-DD-<short-name>.md`):

```
# Incident: <short name>
Date: YYYY-MM-DD
Duration: HH:MM SGT to HH:MM SGT
Severity: P0 / P1 / P2
Author: <name>

## Summary
One paragraph. What happened, who was impacted, how we resolved it.

## Timeline
HH:MM — first signal
HH:MM — on-call paged
HH:MM — first action
HH:MM — resolution

## Root cause
What actually went wrong. Not what we did to fix it.

## What went well
Two or three things.

## What went poorly
Two or three things. Be specific. "Monitoring was confusing" is not specific.

## Action items
- [ ] <Owner> — <action> — <due date>
```

Action items go into the Q4 tracker. They are reviewed at the Monday platform sync. A postmortem without action items is acceptable only if the root cause was external (Google Cloud outage) and there is genuinely nothing we would do differently.

**Learning capture.** Every postmortem ends with one sentence added to `qa/docs/ADK_KNOWN_LIMITATIONS.md` if the incident exposed a limitation we did not already know. The point is to keep the limitations register honest — if we keep getting paged for the same class of issue and it is not in the register, the register is lying.

## Things not to do at 2am

Do not edit prompts. Do not deploy from your laptop. Do not change feature-flag values for agents other than the one paging. Do not turn off alerting because it is noisy — file a ticket to tune it during business hours. Do not promise a fix ETA in a customer-facing channel.

If you are unsure, route 100% to Genkit and go back to sleep. The migration is reversible by design. Use that.
