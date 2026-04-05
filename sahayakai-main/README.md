# SahayakAI: AI-Powered Teaching Assistant

**Try it live: [https://sahayakai-f69e0.web.app](https://sahayakai-f69e0.web.app)**

SahayakAI is a web-based application designed to assist teachers in India with lesson planning and content creation. It leverages a fully serverless architecture with Google Cloud and Firebase to provide a scalable, reliable, and cost-effective suite of AI-powered tools.

## Tech Stack

-   **Framework:** [Next.js](https://nextjs.org/) (React)
-   **AI Integration:** [Google's Genkit](https://firebase.google.com/docs/genkit)
-   **AI Models:** [Google Gemini](https://deepmind.google/technologies/gemini/)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Shadcn/ui](https://ui.shadcn.com/) components
-   **Database:** [Cloud Firestore](https://firebase.google.com/docs/firestore) (Serverless NoSQL)
-   **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth)
-   **File Storage:** [Cloud Storage for Firebase](https://firebase.google.com/docs/storage)
-   **CI/CD:** [Cloud Build](https://cloud.google.com/build)
-   **Deployment:**
    -   **Frontend:** [Firebase Hosting](https://firebase.google.com/docs/hosting) (Global CDN)
    -   **Backend:** [Cloud Functions for Firebase](https://firebase.google.com/docs/functions) (Serverless, event-driven)

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

Deployment to production is handled automatically by a GitHub Actions workflow. Pushing changes to the `main` branch will trigger the deployment process.

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
