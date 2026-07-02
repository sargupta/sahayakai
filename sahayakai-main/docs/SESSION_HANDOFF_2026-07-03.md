# Session Handoff — 2026-07-03

Resume point for a fresh Claude session. Everything below is the state as of the end of the big security + design-review session.

---

## ▶ How to resume (do this in the new session)
1. Open the new session in: `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main`
2. (Optional) pick the model: `/model claude-fable-5`
3. Rehydrate context — say to Claude:
   > "Read `docs/SESSION_HANDOFF_2026-07-03.md` and continue from there."
   Persistent memory (`MEMORY.md`) also auto-loads and points here.
4. For depth, also skim: `docs/security/BUG_AUDIT_2026-07-02.md` and `docs/design/proposals/INDEX.md`.

---

## ▶ Current state (facts)
- **Production is LIVE & healthy** on the security-hardened build.
  - Cloud Run revision **`sahayakai-hotfix-resilience-00531-yec`** = commit **`237a37769`**, 100% traffic, canary clean, `/api/health` 200.
  - Firestore **rules + indexes deployed** (incl. the `fcm_tokens` collection-group index for H28; cleaned 6 invalid single-field index entries).
  - **Rollback if needed:** `gcloud run services update-traffic sahayakai-hotfix-resilience --region=asia-southeast1 --project=sahayakai-b4248 --to-revisions=sahayakai-hotfix-resilience-00529-nej=100`
- **Branches all consistent** (contain every fix, buildable): `main` = `daa615053`, `develop` = `22767d4f7`, `fix/security-hardening-2026-07-02` = `c637d78d1`. PR: https://github.com/sargupta/sahayakai/pull/72
- **Working tree is dirty (~140 files)** — pre-existing GOOD WIP (prior forensic-fix + i18n pass, NOT mine). Left uncommitted for its authors. **Stage specific files only; never `git add -A`.**

---

## ▶ What's DONE
1. **Full security audit + fixes** — P0 (C1–C8), P1 (H1–H21), P2/P3 client crashes + data/cost/AI backend + infra. Verified by a 6-agent adversarial review; all 6 review findings fixed. Deployed to prod. Full report + fix status: `docs/security/BUG_AUDIT_2026-07-02.md`.
2. **Design review board** — 14 specialists reviewed the whole app; 15 proposals in `docs/design/proposals/` (`00-north-star` … `13-inventory` + `INDEX.md`). Visual dashboard: `docs/design/design-review-dashboard.html` (published artifact). **No app code changed — proposals only.**

---

## ▶ PENDING — needs YOU (can't be auto-done)
1. **Rotate the `.env.local` keys (C3)** — Firebase service-account key, Twilio token, Sarvam/Tavily/Gemini — if any built image reached a shared registry. (Coordinated Secret Manager + redeploy; risky to auto-do.)
2. **Test mobile account deletion** end-to-end — it now uses a redirect re-auth flow (client contract change).

## ▶ PENDING — deferred security (need a decision, then implementable)
- **H8** storage READ scoping (signed URLs / access-checked proxy — voice DMs + shared images are auth-wide readable).
- **Prompt-injection delimiter framing** across ~18 AI flows (input caps shipped; framing deferred — output-quality-sensitive).
- **video-storyteller quota** (needs a `GatedFeature` + per-tier pricing decision).
- **H21** payment binding (amount↔plan + payment-idempotency ledger; currently admin-only-gated).
- **CSP** flip from Report-Only → enforcing (after reviewing violation reports).
- **Block/report/moderation feature** (systemic gap — harassment has no recourse).
- **App Check** enforcement (currently default-off).
- **npm audit fix (H16) — TOOLING-BLOCKED.** Local npm writes a lock the container's older `node:20-alpine` npm rejects (`npm ci` fails in Cloud Build though it passes locally). Redo only with the container's npm version (or `npm install` inside the build image). Reverted twice; 79 vulns remain.

---

## ▶ The immediate FORK (pick one to continue)
- **A. Greenlight a design phase** — recommended: **Phase 0** (ratify tokens + fix saffron contrast `#FF9933`→`#F08A2E` + CI lint on raw hex/px/`orange-*` + self-host fonts + vectorize logo). Highest-leverage structural bet after that: the `GeneratorPage` primitive. See `docs/design/proposals/INDEX.md` decision menu.
- **B. Fable-5 critical review** — the user asked for a direct, first-person critical review of the app *by Fable 5* (not delegated agents). OFFERED but NOT yet delivered. If they still want it: write it in first person, no sub-agents. Scope: whole product, or a slice (teacher UX / codebase / GTM / design).
- **C. Start a deferred security project** (H8 signed-URL media or the block/report feature are the highest-value).

---

## ▶ Gotchas / hard rules (carry forward)
- **Deploy pipeline:** `fix/*` branches CANNOT deploy (safe-deploy Guard 0). Prod deploys from `hotfix/*` or `main` push (trigger `sahayakai-main-deploy`). Flow: `hotfix/*` branch → `bash scripts/safe-deploy.sh` (defaults `--no-traffic`) → `firebase deploy --only firestore:rules,firestore:indexes` → flip traffic manually → `bash scripts/audit-deployments.sh`. **Never raw `gcloud run deploy`.** Cloud Build uses `--source=.` so the tree must be CLEAN (stash WIP first).
- **Git:** branch from `develop`; `--no-ff` merges; never commit to `main` directly (merge `develop`→`main`). Commitlint rejects bad types on merge commits — use `chore(release):` or `merge(scope):`.
- **i18n gate:** pre-commit blocks hardcoded user-facing strings; wrap in `t()`. Override only for true sentinels: `SKIP_I18N_AUDIT=1`.
- **Committing files that import untracked files breaks the container build** (dangling imports) — commit their untracked deps too.
- Project: Cloud Run `sahayakai-hotfix-resilience`, region `asia-southeast1`, GCP project `sahayakai-b4248`. gcloud is authed via impersonation.
