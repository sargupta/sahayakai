# Rollback procedure

Three paths exist, in order of preference (fastest → slowest):

## 1. Feature flag flip (fastest, no redeploy)

If the broken behavior is gated behind a Firebase Remote Config flag (see `docs/FEATURE_FLAGS.md` once Phase C lands):

1. Open https://console.firebase.google.com/project/sahayakai-b4248/config
2. Find the offending flag (e.g., `feature_community_personas`).
3. Set to `false`. Publish.
4. Propagation takes ~1 minute. No redeploy needed.

If the offending feature is NOT flag-gated, skip to #2.

## 2. Cloud Run revision promote (under 1 minute)

Pin prod traffic to a previous known-good revision. Code on `main` stays as-is; only the served revision changes.

```bash
# List recent revisions
gcloud run revisions list --service=sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --limit=10

# Pick a known-good revision (e.g., the one tagged dep-6e448e013 = release-2026-05-21)
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --to-revisions=sahayakai-hotfix-resilience-00449-puj=100

# Confirm
bash scripts/audit-deployments.sh
```

Traffic flip is instant.

The most recent prod rollback fence is documented in `.claude/rollback-target-2026-05-21.md`.

## 3. Git revert + redeploy (slowest, but cleanest history)

If you need the bad code OFF `main` (not just off Cloud Run traffic), revert + redeploy.

```bash
# Revert the offending merge commit
git checkout main
git pull origin main
git revert -m 1 <bad-merge-sha>
git push origin main

# Verify the revert via a temporary branch / PR if branch protection requires it:
git checkout -b hotfix/revert-<bad-feature>
git push -u origin hotfix/revert-<bad-feature>
gh pr create --base main --title "hotfix(revert): <bad-feature>" --body "<reason>"
gh pr merge --merge   # use --no-ff merge for revert PRs

# Deploy from main
git checkout main && git pull
bash scripts/safe-deploy.sh

# Flip traffic to the new revision
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --to-latest

# Smoke test
bash scripts/smoke-test.sh
```

This is the only path that takes the bad code out of the source tree. Use it for security issues, schema bugs that left orphaned data, etc. — not for "the UI is ugly."

## Don't forget: back-merge to develop

If you reverted on `main` via step 3 and `develop` still has the bad commit, the next `develop → main` release will re-introduce the bug. Always back-merge:

```bash
git checkout develop && git pull
git merge main --no-ff -m "merge(revert): back-merge hotfix from main to keep develop in sync"
git push origin develop
```

## Rollback fence tags

Before any risky push to `main`, capture a tag pointing to the current prod state:

```bash
PROD_REV=$(gcloud run services describe sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --format='value(status.traffic[0].revisionName)')
# (gcloud doesn't expose the source SHA directly, but every revision is tagged dep-<sha> by safe-deploy.sh)

git tag prod-$(date +%Y-%m-%d)-pre-<event> <current-prod-sha>
git push origin prod-$(date +%Y-%m-%d)-pre-<event>
```

Examples in the wild: `prod-2026-05-21-pre-catchup`.

## What's in production right now

```bash
bash scripts/audit-deployments.sh
```

The output ends with:
- The live revision name + image SHA
- A list of recent revisions (12 by default)
- The single registry path in use (or, if multiple, a race signal)
- Feature probe results against the live URL
- Recent commits on `origin/main`

The most recent rollback fence note is in `.claude/rollback-target-*.md`.
