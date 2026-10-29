# SamparkAI demo — pre-deployment checklist

For the SahayakAI build that carries SamparkAI and its demo school
(`/sampark/demo`). Results of the last run are in the right-hand column;
re-run everything before each deployment.

## 1. Configuration

| # | Check | How | Last result |
|---|---|---|---|
| 1.1 | Demo off by default in every committed deploy config | `cloudbuild*.yaml` never sets `SAMPARK_DEMO_ENABLED` or `NEXT_PUBLIC_SAMPARK_DEMO_ENABLED` | |
| 1.2 | A demo deployment sets both flags: `SAMPARK_DEMO_ENABLED=true` (server: pages, APIs, Attendance redirect) and `NEXT_PUBLIC_SAMPARK_DEMO_ENABLED=true` (build time: SahayakAI sidebar opens the demo) | deployment env | |
| 1.3 | `GOOGLE_GENAI_API_KEY` comes from the existing secret, never from a committed file | `.env.local` is gitignored; `git ls-files` | |
| 1.4 | No secret reaches the browser bundle | grep the production build's static chunks for the key value | |
| 1.5 | No new paid service, database or API | review | |

## 2. Gates

| # | Check | Command | Last result |
|---|---|---|---|
| 2.1 | Typecheck | `npx tsc --noEmit -p .` | |
| 2.2 | Lint of changed files | `npx eslint <changed>` | |
| 2.3 | Design-token budget (Gate 11) | `node scripts/ci/check-design-tokens.mjs` | |
| 2.4 | i18n source audit (Gate 1) | `bash scripts/audit-i18n-source.sh` | |
| 2.5 | Full Jest suite | `npx jest --coverage=false` | |
| 2.6 | Production build | `NEXT_DIST_DIR=.next-build npx next build` | |

## 3. Behaviour and edge cases

| # | Case | Expected | Last result |
|---|---|---|---|
| 3.1 | Flag off | `/sampark/demo/*` and `/api/sampark-demo/*` are 404; Attendance is the normal page; sidebar opens `/sampark/workspace` | |
| 3.2 | SahayakAI → SamparkAI | Sidebar "SamparkAI" entry opens `/sampark/demo` (demo build) | |
| 3.3 | SamparkAI → SahayakAI | Demo sidebar "SahayakAI" link opens `/` | |
| 3.4 | Attendance handoff | `/attendance` → 307 `/sampark/demo/teacher?from=sahayak`; no PII in the URL | |
| 3.5 | Every sidebar item, both roles | 200 and renders; no dead links | |
| 3.6 | Teacher scope | Another class's student by deep link → refused, no call dialog; only own classes' calls, callbacks and notices | |
| 3.7 | Wrong role by URL | A teacher opening `/demo/admin` is sent to the role picker | |
| 3.8 | Four reasons | Each reason preselects and builds a note; Hindi and English | |
| 3.9 | Difficult parent | Angry reply: no blame, no argument, offers a step | |
| 3.10 | Complaint about the teacher | Recorded as the parent said it, open, visible to teacher (Mark as seen) and principal (Mark resolved) | |
| 3.11 | Good-news call | No complaint record, no "null" text | |
| 3.12 | AI unreachable | Call continues on scripted replies, marked "Scripted replies" | |
| 3.13 | Bad / oversized request, abuse | 400; 61st request in 10 min from one address is 429 | |
| 3.14 | Callback time rules | Outside 10:00–20:00, Sunday, holiday, past, >30 days refused with next permitted time | |
| 3.15 | Parent's callback request | Waits as "Needs confirming" until a person sets a time | |
| 3.16 | Campaign lifecycle | Draft → approve → calling → finished; no phone rings | |
| 3.17 | No answer / busy | Saved as not reached; appears under "Families not reached" | |
| 3.18 | Reset demo | Seeded school returns; signed-in role kept | |
| 3.19 | Phone width (375 px) | No horizontal scroll; dialogs usable | |
| 3.20 | VIDYA orb | WebGL in each state (idle, listening, working, speaking, failed — never red); CSS fallback without WebGL; still under reduced motion | |
| 3.21 | Branding | Only "SamparkAI" in SamparkAI; no "by SahayakAI" | |
| 3.22 | Console | No app errors in the browser console or server log | |

## 4. Release

| # | Step | Last result |
|---|---|---|
| 4.1 | Work committed on the feature branch; tree clean | |
| 4.2 | `develop` fast-forwards (contains `main`), push to `develop` (no deploy) | |
| 4.3 | `develop` → `main` by PR, then the main trigger builds a no-traffic revision; traffic flip is a human action (AGENTS.md) | not started |
