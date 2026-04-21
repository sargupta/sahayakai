# Infrastructure — Cloud Armor

Runbook + reproducible script for the production WAF protecting `sahayakai.com`.

## What's protected

All traffic arriving at the Global HTTPS LB (IP `34.50.150.243`, fronting
Cloud Run service `sahayakai-hotfix-resilience` via backend service
`sahayakai-backend-service`) passes through the Cloud Armor policy
`sahayakai-bot-block`.

## Active rules

| Priority | Action | What it blocks |
|----------|--------|----------------|
| 1000 | `deny-403` | Bot scans for secrets/admin paths: `/.env`, `/.env.bak`, `/.git/`, `/wp-admin`, `/phpMyAdmin` (case-insensitive), `/admin.php`, `/.aws/`, `/.ssh/`, `/xmlrpc.php`, etc. |
| 2000 | `deny-403` | Known malicious IPs observed in logs (currently 2) |
| 3000 | `rate-based-ban` | `/api/auth/*` — 30 req/min/IP, exceed = deny-429 + 10-min ban |
| default | `allow` | Everything else |

## Verified as of 2026-04-21

```
/phpmyadmin → 403
/phpMyAdmin → 403
/PHPMyAdmin → 403
/wp-admin   → 403
/.env       → 403
/api/health → 200
```

## How to update

### Add more blocked paths
Edit `cloud-armor.sh`, extend the `RULE1000_EXPR` regex. Run the script again
(it's idempotent — `update` vs `create` handled automatically).

### Add scanner IPs
Look at enforcement logs:

```bash
gcloud logging read 'jsonPayload.enforcedSecurityPolicy.name="sahayakai-bot-block"' \
  --project=sahayakai-b4248 --freshness=7d --limit=100 \
  --format="value(httpRequest.remoteIp)" | sort | uniq -c | sort -rn
```

Add repeat offenders to `SCANNER_IPS` in the script (CIDR format, comma-separated)
and re-run.

### Temporarily disable
If blocking a legitimate user by accident:
```bash
gcloud compute backend-services update sahayakai-backend-service \
  --project=sahayakai-b4248 --global --no-security-policy
```
Re-attach with `--security-policy=sahayakai-bot-block` when ready.

## Caveats

1. Cloud Armor RE2 regex **does not support capture groups** — use non-capturing
   `(?:...)` or the script update will fail.
2. Rule changes take **30–90 seconds** to propagate globally. Don't panic if
   a test immediately after update returns the old behavior.
3. Rate-limit rule (3000) uses `enforce-on-key=IP`. If requests come from a
   shared NAT (e.g., entire school behind one IP), 30 req/min might be
   aggressive. Monitor `/api/auth/*` for 429s and tune up if needed.

## Related

- `monitoring/dashboard.json` — includes a bot scan log panel fed by 404s.
  Once rules here are stable, that panel should go quiet because blocked
  requests are 403 before reaching the app.
