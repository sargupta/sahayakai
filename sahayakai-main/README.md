# SahayakAI: AI Teaching Platform for India

**Try it live: [https://www.sahayakai.com](https://www.sahayakai.com)**

> **New to the codebase?** Read [`docs/SYSTEM_OVERVIEW.md`](./docs/SYSTEM_OVERVIEW.md) first. It is the canonical, up-to-date map of every production component and the fastest way to onboard.

SahayakAI is a voice-first, eleven-language teaching platform for K-12 teachers in India. It is more than a lesson-plan generator: alongside a suite of AI content tools, it runs an attendance and parent-outreach system (including AI-scripted phone calls to parents in their own language), a teacher social network, and a per-teacher analytics layer. It is built on a fully serverless Google Cloud stack for scale, reliability, and cost efficiency.

## What it does

- **Content spine.** Lesson plans, worksheets, quizzes, exam papers, rubrics, and instant answers, all NCERT/board-aware and localized across eleven Indian languages.
- **Attendance and parent outreach.** Class rosters, daily attendance, marks, a priority-sorted "who needs a parent call today" triage, and Twilio-based AI parent calls.
- **Community.** Groups, a staff-room feed and chat, a teacher directory, connections, 1:1 messaging, and a shared resource library.
- **Analytics.** A five-dimension Teacher Impact Score (see below) and a principal-facing school analytics dashboard.
- **Labs.** A set of parked, experimental tools (visual aids, virtual field trips, assessment scanning, and more).

For the full component-by-component breakdown, see [`docs/SYSTEM_OVERVIEW.md`](./docs/SYSTEM_OVERVIEW.md).

## Tech Stack

-   **Framework:** [Next.js](https://nextjs.org/) 15 (App Router). The entire application, UI and API routes, is one deployable.
-   **AI:** [Google's Genkit](https://firebase.google.com/docs/genkit) over [Google Gemini](https://deepmind.google/technologies/gemini/) (default `gemini-2.5-flash`).
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Shadcn/ui](https://ui.shadcn.com/) components.
-   **Database:** [Cloud Firestore](https://firebase.google.com/docs/firestore) (Mumbai, `asia-south1`; India-resident).
-   **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth).
-   **File Storage:** [Cloud Storage for Firebase](https://firebase.google.com/docs/storage).
-   **Voice:** Twilio (parent calls); Sarvam, Bhashini, and Google Cloud TTS/STT (in-app speech).
-   **Billing:** Razorpay.
-   **CI/CD:** [Cloud Build](https://cloud.google.com/build) + GitHub Actions quality gates.
-   **Hosting:** [Cloud Run](https://cloud.google.com/run), deployed dual-region (Mumbai `asia-south1` + Singapore `asia-southeast1`) behind a global HTTPS load balancer at `www.sahayakai.com`. This is not Firebase Hosting or Cloud Functions.

## Getting Started

### Prerequisites

- Node.js (v20; the project pins `>=20 <21`)
- npm
- [Firebase CLI](https://firebase.google.com/docs/cli)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/sargupta/sahayakai.git
    ```
2.  Navigate to the app directory:
    ```bash
    cd sahayakai/sahayakai-main
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Create a `.env.local` from the template and fill in your Firebase config and API keys:
    ```bash
    cp .env.example .env.local
    ```
    At minimum you need the `NEXT_PUBLIC_FIREBASE_*` values, `FIREBASE_SERVICE_ACCOUNT_KEY`, and `GOOGLE_GENAI_API_KEY`. See [`docs/SYSTEM_OVERVIEW.md`](./docs/SYSTEM_OVERVIEW.md) Section 11 for the grouped environment-variable reference.
5.  Run the app:
    ```bash
    npm run dev          # Next.js dev server at http://localhost:3000
    npm run genkit:dev   # Genkit dev UI for AI flows (optional)
    ```

### Common scripts

```bash
npm run typecheck     # tsc --noEmit
npm run lint
npm test              # jest
npm run predeploy     # typecheck && build, run before every push
npm run qa:e2e        # Playwright end-to-end
```

## Deployment

Production deploys are **manual and gated**, not automatic. Do not run raw `gcloud run deploy`, and do not assume that pushing to `main` deploys anything.

The canonical flow is `bash scripts/safe-deploy.sh` (builds a new Cloud Run revision at 0% traffic), then `scripts/audit-deployments.sh`, then a manual traffic flip to expose the revision to users. Production is dual-region, so Mumbai requires a second run with `REGION=asia-south1`. See [`DEPLOY.md`](./DEPLOY.md) and the deploy-safety contract in [`AGENTS.md`](./AGENTS.md).

## Documentation

Start with [`docs/SYSTEM_OVERVIEW.md`](./docs/SYSTEM_OVERVIEW.md), which links the current, trustworthy documents and flags the stale ones. Key references:

- [`AGENTS.md`](./AGENTS.md), [`DEPLOY.md`](./DEPLOY.md), [`docs/BRANCHING.md`](./docs/BRANCHING.md) - process and deploy.
- [`docs/API_MIGRATION_PATTERN.md`](./docs/API_MIGRATION_PATTERN.md), [`docs/FEATURE_FLAGS.md`](./docs/FEATURE_FLAGS.md) - backend architecture.
- [`docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md`](./docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md) - infra topology.
- [`docs/compliance/DPDP_DATA_PROTECTION.md`](./docs/compliance/DPDP_DATA_PROTECTION.md) - data protection.

Documents describing systems that were never built are retained under [`docs/archive/`](./docs/archive/) and should not be used for onboarding.

---

## Impact Score Dashboard

SahayakAI includes a **Teacher Impact Score Dashboard** — a multi-dimensional analytics engine that measures how deeply a teacher is integrating AI into their classroom practice.

### The Model: Five Orthogonal Dimensions

The Impact Score $H(t)$ is computed using a **sigmoid-activated weighted sum** of five independent behavioral signals:

$$H(t) = 100 \times \sigma\bigl(w_A \cdot A + w_E \cdot E + w_S \cdot S + w_G \cdot G + w_C \cdot C - \beta\bigr)$$

| Dimension | Method | What It Measures |
|--|--|--|
| **A** — Activity | Exponential temporal decay | Recency and frequency of platform sessions |
| **E** — Engagement | Volume-weighted Shannon Entropy (k=13) | Breadth of feature usage across 13 platform tools |
| **S** — Success | Bayesian Beta-Binomial + regen penalty | AI generation competency and prompt quality |
| **G** — Growth | MACD-style EMA divergence + streak | Week-on-week momentum and habit formation |
| **C** — Community | Log share depth + export reach + reciprocity | Contribution to the SahayakAI teacher ecosystem |

### Risk Classification

Churn probability $P(\text{churn}) = 1 - H/100$ drives the dashboard's risk labels:

- 🟢 **Healthy** (score ≥ 70) — Actively engaged and growing
- 🟡 **At-Risk** (score 40–69) — Declining activity, needs re-engagement
- 🔴 **Critical** (score < 40) — High churn probability, requires intervention

### Full Technical Documentation

For the complete mathematical derivation, rationale for each equation, forensic audit findings, and hyperparameter reference, see:

📄 **[`docs/IMPACT_SCORE.md`](./docs/IMPACT_SCORE.md)**
