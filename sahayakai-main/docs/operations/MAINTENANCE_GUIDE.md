# Maintenance & Scaling Guide

> Last updated: 2026-06-10

This guide explains how to update SahayakAI once the Load Balancer (GCLB) and Cloud Run architecture is live. Production service: `sahayakai-hotfix-resilience` (`asia-southeast1`, project `sahayakai-b4248`).

---

## 1. Updating API Keys & Secrets (The Presentation Guard)
The app now supports **Multi-Key Resilience**. This prevents "429 Rate Limit" errors during live presentations by automatically failing over to backup keys.

**The Process:**
1.  Generate 2 or 3 separate API keys from [Google AI Studio](https://aistudio.google.com/).
2.  Go to **GCP Secret Manager** -> `GOOGLE_GENAI_API_KEY`.
3.  Click **"New Version"**.
4.  Paste the keys as a **comma-separated list**:
    `AIza...Key1, AIza...Key2, AIza...Key3`
5.  **Restart/Redeploy:** The app will now rotate through these keys automatically. If Key 1 hits a limit, it silently switches to Key 2.

---

## 2. Deploying New Features (New Code)
When you add a new feature or switch to a different branch:

**The Process:**
1.  Run `./scripts/safe-deploy.sh` (the canonical prod path; `develop` deploys to `sahayakai-preview`, `main`/`hotfix/*` to prod). NEVER run raw `gcloud run deploy`.
2.  **What happens:** a new Cloud Run revision is built **with `--no-traffic`** and a `dep-<sha>` tag — it is warm but does NOT auto-route. This prevents parallel-deploy races.
3.  **Flip traffic explicitly** once `./scripts/audit-deployments.sh` is clean:
    ```bash
    gcloud run services update-traffic sahayakai-hotfix-resilience \
      --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
    ```
4.  **Result:** users see new features at `sahayakai.com` after the traffic flip. See [DEPLOY.md](./DEPLOY.md) for the full runbook.

---

## 3. SSL & Certificate Management
Currently, we use a **Google-managed certificate**.

**The Process:**
- **Renewal:** Google handles this automatically 30 days before expiry. You do nothing.
- **New Domain:** If you decide to move to `portal.sahayakai.in`, you will need to:
    1. Create a new `ssl-certificate` in GCP.
    2. Update the `target-https-proxy` in the Load Balancer to include the new certificate.

---

## 4. When to touch Cloudflare?
Cloudflare is now a "pass-through." You only need to touch it if:
- You want to add a new subdomain (like `docs.sahayakai.com`).
- You want to change security settings (WAF, Page Rules).
- **Note:** If you ever change the Load Balancer IP (highly unlikely), you'd update the `A` record there.

---

## Summary
| Change Type | Where to Update |
| :--- | :--- |
| **Code / Features** | Cloud Run (Deploy new revision) |
| **API Keys / Secrets** | Secret Manager + Cloud Run |
| **Custom Domain** | Cloudflare (DNS) + GCP (SSL Cert) |
| **Load Balancing Logic** | URL Maps (GCP Compute Engine) |

> [!TIP]
> This architecture is "Set and Forget." Focus on your code in `src/`, and the infrastructure will handle the traffic and AI routing automatically!
