# AI Behavior & Safety Log: Home Page

**Date**: Dec 15, 2025

## 4.1 Rate Limiting (Guardrail)
-   **Method**: Implemented a "Token Bucket" style rate limiter using `localStorage`.
-   **Policy**: Users can generate 5 plans every 10 minutes.
-   **Why**: To prevent accidental quota exhaustion by enthusiasm or simple bots.
-   **Failure State**: Returns a friendly "Whoa, slow down! You've been working hard. Take a 2-minute break." message instead of a generic backend error.

## 4.2 Content Safety (Pre-Scan)
-   **Method**: Regex-based "Blocklist" for high-risk keywords (explosives, self-harm, hate speech) before hitting the LLM.
-   **Why**: Cost saving + Immediate rejection of unsafe intent without risking LLM "jailbreaks".
-   **Impact**: Topics containing blocked keywords return an immediate rejection toast.
