# SahayakAI: AI-Powered Teaching Assistant

**Try it live: [https://www.sahayakai.com](https://www.sahayakai.com)**

_Last updated: 2026-06-10_

SahayakAI is a web-based application that helps teachers across India with lesson planning, assessment, classroom communication, and content creation. It runs as a single Next.js app on Cloud Run, backed by Google Cloud and Firebase, providing a scalable, reliable, and cost-effective suite of AI-powered tools.

## Tech Stack

-   **Framework:** [Next.js](https://nextjs.org/) 15 (App Router, React 18)
-   **AI Integration:** [Google's Genkit](https://firebase.google.com/docs/genkit) (`googleai` plugin)
-   **AI Models:** [Google Gemini](https://deepmind.google/technologies/gemini/). Default text model `gemini-2.5-flash`; `gemini-2.5-pro` for assignment grading, `gemini-3-pro-image-preview` for visual-aid images, `gemini-2.5-flash-image` for avatars.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Shadcn/ui](https://ui.shadcn.com/) components
-   **Database:** [Cloud Firestore](https://firebase.google.com/docs/firestore) (Serverless NoSQL)
-   **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth) (ID token verified in middleware via `jose`)
-   **File Storage:** [Cloud Storage for Firebase](https://firebase.google.com/docs/storage)
-   **Payments:** [Razorpay](https://razorpay.com/) (HMAC-verified webhooks)
-   **Telephony (parent calls):** Twilio REST (default) or Exotel (opt-in via `VOICE_PROVIDER`)
-   **CI/CD:** [Cloud Build](https://cloud.google.com/build) trigger `sahayakai-main-deploy` on push to `main`
-   **Deployment:** Single [Cloud Run](https://cloud.google.com/run) service `sahayakai-hotfix-resilience` (region `asia-southeast1`, project `sahayakai-b4248`). New revisions are built `--no-traffic` and traffic is flipped manually.

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- npm or yarn
- [Firebase CLI](https://firebase.google.com/docs/cli)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/sargupta/sahayakai.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd sahayakai-main
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```
4.  Set up your environment variables by creating a `.env.local` file in the root of the project. You will need to add your Firebase configuration details.
    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
    NEXT_PUBLIC_FIREBASE_APP_ID=
    FIREBASE_SERVICE_ACCOUNT_KEY=
    ```
5.  Run the development server:
    ```bash
    npm run dev
    ```

    The application will be available at `http://localhost:3000`.

## Deployment

A Cloud Build trigger (`sahayakai-main-deploy`) fires on every push to `main` and runs `cloudbuild.yaml`, which builds the image and creates a Cloud Run revision **with `--no-traffic`** (no auto-routing, to prevent parallel-deploy races). After the build, audit the new revision and flip traffic manually:

```bash
./scripts/audit-deployments.sh
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
```

`scripts/safe-deploy.sh` is a guarded fallback for when the trigger pipeline is unavailable. Never run raw `gcloud run deploy`. See `AGENTS.md` for the full deploy protocol.

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

📄 **[`docs/strategy/IMPACT_SCORE.md`](./docs/strategy/IMPACT_SCORE.md)**
