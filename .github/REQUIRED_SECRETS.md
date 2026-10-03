# Repository secrets used by CI

Every `secrets.NAME` referenced anywhere in `.github/workflows/` must have a row
below, and every row must still be referenced by some workflow. A Jest gate
(`sahayakai-main/src/__tests__/scripts/workflow-secrets-declared.test.ts`)
enforces both directions on every pull request.

The gate exists because a workflow can reference a secret that was never created
and GitHub says nothing: the expression silently expands to an empty string and
the step fails somewhere downstream with an error about its own inputs. That is
exactly what happened to `GCP_SA_READ_ONLY_KEY` — referenced from 2026-07,
never created, and the nightly schedule turned `main` red every day for weeks
inside `google-github-actions/auth` while the drift check it guarded never ran
once. Declaring secrets in a file a human reviews turns that silence into a
visible row with a status.

`Status` is maintained by hand. It is a statement about the GitHub repository's
secret store, which CI cannot read, so treat it as documentation rather than as
something the gate verifies.

| Secret | Status | Referenced by | Consequence if absent |
| --- | --- | --- | --- |
| `GCP_SA_KEY` | present | `google-cloudrun-docker.yml`, `firebase-deploy.yml`, `genkit-eval.yml` | Cloud Run and Firebase deploy workflows cannot authenticate. Note this is a full-access key; do not reuse it for read-only probes. |
| `GCP_SA_READ_ONLY_KEY` | **MISSING — founder action** | `quality-gates.yml` (Gate 3 Cloud Run drift, Gate 7 AppCheck env) | Both live checks skip with a notice instead of running. Cloud Run spec drift and the AppCheck env setting go unverified. Create as a service-account key holding only `roles/run.viewer` on `sahayakai-b4248`. |
| `GENKIT_EVAL_API_KEY` | present | `genkit-eval.yml` | AI flow evals cannot call the model. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | present | `firebase-deploy.yml` | The hosting build ships without a Firebase web config. |
| `TWILIO_ACCOUNT_SID` | present | `e2e-smoke.yml` | The parent-call smoke probe cannot reach Twilio. |
| `TWILIO_AUTH_TOKEN` | present | `e2e-smoke.yml` | As above. Rotate this alongside the Twilio console token. |
| `TWILIO_PHONE_NUMBER` | present | `e2e-smoke.yml` | The smoke probe has no caller ID to dial from. |
