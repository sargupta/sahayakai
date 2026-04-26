# Agent rules — Cloud Run deploys

These rules exist because **this project is worked on by multiple
parallel Claude / agent sessions**, and Cloud Run's default behaviour
(deploy = auto-route 100% traffic) means concurrent deploys silently
clobber each other. We have lost three production features at least
once that way.

## The two rules

### 1. Never run `gcloud run deploy` directly.

That includes:

- `gcloud run deploy ...`
- `gcloud beta run deploy ...`
- Anything else that creates a Cloud Run revision and routes traffic
  on success.

If you need to ship code:

- **Push to `main`.** A Cloud Build trigger (`sahayakai-main-deploy`)
  fires on every push and runs `cloudbuild.yaml`, which builds the
  image and creates a Cloud Run revision **with `--no-traffic`**.
- The trigger queues concurrent pushes serially (per
  `_BUILD_CONCURRENCY=1`), so two pushes never race at the build
  stage either.
- Watch the build at
  https://console.cloud.google.com/cloud-build/builds?project=sahayakai-b4248

### 2. Never flip traffic without first auditing the new revision.

When the build finishes, the new revision is reachable at
`https://sha-<short-sha>---sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app`
but is serving 0% traffic.

Before flipping:

```bash
./scripts/audit-deployments.sh
```

The audit probes feature endpoints + UI strings and flags any that
are missing in the latest ready revision. If any check is ✗, do not
flip — investigate first.

When the audit is clean:

```bash
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
```

## Emergency override

`scripts/safe-deploy.sh` exists for the rare case the trigger pipeline
itself is broken (Cloud Build outage, git push blocked, etc). It runs
`gcloud run deploy` from your local working tree but with three
guardrails: no concurrent build, last revision must be > 90 s old,
git tracked tree must be clean, and `--no-traffic` is the default.

It is a fallback. Prefer the trigger.

## What you can do without thinking about deploys

- `git push origin develop` (no deploy)
- `git push origin main` (triggers build → no-traffic revision created)
- `./scripts/audit-deployments.sh` (read-only)
- Anything inside the running Cloud Run service (Firestore writes,
  cron jobs, agent scripts) — these don't change deployed code.

## What requires explicit human action

- Flipping traffic to a newly built revision
- Force-routing to an older revision (rollback)
- Modifying the trigger config or `cloudbuild.yaml`

---

# Before you say "done" on a UI change — i18n gate (mandatory)

Three patterns broke the landing page recently. Each has an
enforcement script you MUST run. No exceptions.

## Why this exists

This file used to end above. It was added because:

1. **Agents trust prior work without verifying.** A previous commit
   said "i18n marketing dictionary now covers all 11 supported
   languages" — but it only covered the pricing page. Subsequent
   agents assumed the landing page was covered. It wasn't. 30+
   landing strings stayed English in Hindi mode for weeks.

2. **Agents declare done before user-visible verification.** The
   tests for "i18n complete" used to be: tsc passes, page renders.
   Neither catches "string is hard-coded in JSX". A user opening
   the page in Hindi catches it instantly.

3. **Parallel agents touch the same files.** Nobody owned a
   "comprehensive landing i18n" sweep, so each agent's audit was
   scoped to whatever they were touching. Coverage gaps survived
   indefinitely.

The scripts below close all three. Run them; do not eyeball.

## Gate 1: source audit (run before commit)

```bash
./scripts/audit-i18n-source.sh
```

Heuristic regex that flags JSX text nodes ≥ 2 words and
user-visible attributes (`placeholder`, `aria-label`, `title`,
`alt`, `label`) that are NOT wrapped in `t(...)`. Exits 1 on any
finding. Wired into the pre-commit hook so a commit that
introduces a new hard-coded user-visible string is rejected at
commit time.

If the script flags an alt/aria string you genuinely want to keep
in English (e.g. brand name in alt text), leave it but treat it
as a deliberate decision — note the rationale in the commit
message.

## Gate 2: dictionary coverage (run before push)

When you add a new `t("foo")` call:

1. Open `src/context/language-context.tsx`.
2. Add the key with values for ALL 11 languages (English, Hindi,
   Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi,
   Malayalam, Odia).
3. `tsc --noEmit` — TypeScript will reject duplicate keys
   automatically.

Best-effort translations with my training data are acceptable for
the smaller Indic languages; the alternative (English fallback)
is what causes user-visible regressions. Mark uncertain ones with
a `// REVIEW: {lang}` comment.

## Gate 3: live audit (run after deploy + traffic flip)

```bash
./scripts/audit-i18n-live.sh
```

Fetches the live URL, downloads every JS chunk it references, and
greps the bundle for both your new translation keys AND a sample
of their Hindi-script values. Catches the case where you commit
+ push but the deploy raced and your code didn't actually ship.

Exits 1 if any expected key/value is missing. Re-run after any
`safe-deploy.sh` + `update-traffic --to-latest` cycle to confirm
the new code is what users actually see.

## Workflow summary

```text
edit JSX
  → ./scripts/audit-i18n-source.sh    # gate 1 (also auto via pre-commit)
  → add keys to language-context.tsx
  → tsc --noEmit
  → git commit
  → git push origin main
  → wait for build (or run safe-deploy.sh fallback)
  → audit-deployments.sh + flip traffic
  → ./scripts/audit-i18n-live.sh     # gate 3
  → only NOW say "done"
```
