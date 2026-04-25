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
