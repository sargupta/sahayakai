# SahayakAI Project Map (gemini.md)

## Project Overview
**Status:** Blueprint Phase (B.L.A.S.T. Protocol)
**Last Updated:** 2026-01-29
**Project Identity:** "Bharat First" AI Teaching Assistant for Rural India.

## B.L.A.S.T. Protocol Progress
- [x] **B - Blueprint:** Discovery synthesized from Strategic Review & Roadmap
- [x] **L - Link:** Verified Gemini/Genkit connectivity via `tools/verify_link.ts`
- [x] **A - Architect:** Comprehensive Ecosystem SOPs roll-out (Master, Interactive, Support, Lesson Plan) - Layer 1 Complete.
- [ ] **S - Stylize:** Premium "Bharat" UX/UI Refinement (In Progress: Added Copy button to Instant Answer card)
- [ ] **T - Trigger:** Automation & Deployment triggers

## Discovery Questions (Synthesized)
*   **North Star:** Transform SahayakAI from a single-user tool to a nationwide ecosystem platform. Immediate priority: Completing the "Indian Context" transformation and establishing a "Semantic Cache" for sustainability.
*   **Integrations:** 
    *   **Core:** Google Gemini (via Genkit), Firebase (Hosting/Functions/Auth).
    *   **Priority:** Semantic Caching layer (to be built), Supabase/Realtime DB migration for curriculum mapping.
    *   **Future:** Student/Parent communication (WhatsApp/SMS).
*   **Source of Truth:** 
    *   Current: `src/lib/indian-context.ts` (Context Data), `src/ai/flows/` (AI Prompts).
    *   Technical: `STRATEGIC_REVIEW.md` and `RURAL_INDIA_ROADMAP.md` as policy guides.
*   **Delivery Payload:** Structured, culturally relevant lesson plans, localized UI (10+ languages), and offline-ready PWA assets.
*   **Behavioral Rules:** 
    *   **The "Bharat-First" Constraint:** Mandatory use of Indian rural contexts (Agriculture, local geography, zero-cost resources).
    *   **Resource Awareness:** Default assumption is "Chalk & Blackboard" environment.
    *   **Tone:** Supportive, pedagogical, and highly accessible (voice-first).
    *   **Reliability:** Deterministic business logic must wrap LLM outputs.
    *   **Planning Phase Constraint:** MUST prepare a plan (`implementation_plan.md`) and divide work into tasks (`task.md`) before executing any implementation changes. Without doing this, do not move forward.

## Data Schema (Lesson Plan Payload)
```json
{
  "title": "string",
  "gradeLevel": "string (Required)",
  "duration": "string (Required)",
  "subject": "string (Required)",
  "objectives": ["string"],
  "keyVocabulary": [{"term": "string", "meaning": "string"}],
  "materials": ["string"],
  "activities": [
    {
      "phase": "Engage | Explore | Explain | Elaborate | Evaluate",
      "name": "string",
      "description": "string",
      "duration": "string",
      "teacherTips": "string (Optional)",
      "understandingCheck": "string (Optional)"
    }
  ],
  "assessment": "string",
  "homework": "string (Optional)"
}
```

## Data Schema (Teacher Training Payload)
```json
{
  "introduction": "string (Required) - Empathetic acknowledgment of the teacher's concern",
  "advice": [
    {
      "strategy": "string (Required) - Actionable classroom technique",
      "pedagogy": "string (Required) - Core pedagogical principle name (e.g., 'Scaffolding', 'Zone of Proximal Development')",
      "explanation": "string (Required) - Simple explanation with Indian context analogy"
    }
  ],
  "conclusion": "string (Required) - Motivational closing statement"
}
```

}
```

## Data Schema (Quiz Payload)
```json
{
  "title": "string (Required)",
  "questions": [
    {
      "questionText": "string (Required)",
      "questionType": "multiple_choice | fill_in_the_blanks | short_answer | true_false",
      "options": ["string"],
      "correctAnswer": "string (Required)",
      "explanation": "string (Required) - Pedagogical explanation tied to Bharat context",
      "difficultyLevel": "easy | medium | hard"
    }
  ],
  "teacherInstructions": "string (Optional) - Classroom management tips",
  "gradeLevel": "string (Optional)",
  "subject": "string (Optional)"
}
```

## Architectural Boundaries
- **Logic Layer:** All business rules (NCERT mapping, Bharat-context injection, pedagogical grounding) happen in the AI System Prompt guided by `architecture/` SOPs.
- **Validation Layer:** Deterministic checks for "Westernisms", metadata completeness, and mandatory pedagogical citations.

## Git Standards & Branching Rules

> Canonical doc: [`sahayakai-main/docs/BRANCHING.md`](sahayakai-main/docs/BRANCHING.md). This section is a summary.

### Branch Strategy
- **`main`** — production branch. **NEVER commit directly to main.** Only receives merges from `develop` (release PRs) or `hotfix/*` (emergencies). Auto-deploy is DISABLED; prod deploys are manual via `sahayakai-main/scripts/safe-deploy.sh` from a `main` checkout.
- **`develop`** — integration / staging branch. Source of truth for the `sahayakai-preview` Cloud Run service. Auto-deploys to preview on push (once Cloud Build GitHub App is reinstalled; manual via `safe-deploy.sh` from a `develop` checkout until then).
- **`feature/<name>`** — new features. Branch from `develop`, merge back to `develop` via squash PR.
- **`fix/<name>`** — bug fixes (non-emergency). Branch from `develop`, merge back to `develop`.
- **`hotfix/<name>`** — emergency prod fix. Branch from `main`, merge to `main` + back-merge to `develop`.
- **`chore/<name>`**, **`docs/<name>`**, **`refactor/<name>`** — same pattern as `fix/*`.

Legacy aliases (`feat/*`, `bugfix/*`, `audit/*`, `polish/*`) are deprecated — use canonical names. Cleanup PR pending.

### Workflow (mandatory)
```bash
# 1. Always branch off develop (use main only for hotfix)
git checkout develop && git pull origin develop --ff-only
git checkout -b fix/<descriptive-name>

# 2. Make changes, commit with conventional commits
git add <specific files>   # never git add -A or git add .
git commit -m "fix(scope): description"

# 3. Open PR to develop. Squash-merge.
git push -u origin fix/<name>
gh pr create --base develop ...
gh pr merge --squash --delete-branch

# 4. (Periodically) Promote develop → main via --no-ff merge PR
gh pr create --base main --head develop --title "release(YYYY-MM-DD): ..."
gh pr merge --merge   # --no-ff merge (NOT squash — preserves history)

# 5. Tag the release
git checkout main && git pull
git tag release-YYYY-MM-DD
git push origin release-YYYY-MM-DD

# 6. Deploy
git checkout main
bash sahayakai-main/scripts/safe-deploy.sh   # deploys with --no-traffic
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --to-latest   # flip traffic
bash sahayakai-main/scripts/smoke-test.sh
```

### Commit Message Convention (Conventional Commits)
```
<type>(<scope>): <short description>

Types: feat | fix | chore | docs | refactor | test | perf | build | ci | revert | merge
Scope: cost | tts | vft | quiz | auth | ci | deps | flag | deploy | community | vidya | ...

Examples:
  fix(tts): add Authorization header for prod middleware
  feat(chat): add Firestore real-time message listener
  fix(cost): remove unnecessary grounding from lesson-plan
  chore(deps): upgrade firebase-admin to 13.x
  chore(release): catch up main to develop tip — 65 commits
```

### Rules Claude Must Follow
1. **Never work directly on `main`.** Always create a `fix/`, `feature/`, `chore/`, `docs/`, or `hotfix/` branch first.
2. **Never `git add -A` or `git add .`** — stage specific files only.
3. **Never `git push --force`** to main.
4. **Never `--no-verify`** (skip hooks) unless explicitly asked.
5. **Squash merge** for `feature/*`, `fix/*`, `chore/*`, `docs/*` → `develop`. **`--no-ff` merge** for `develop` → `main` and `hotfix/*` → `main` (preserves history for `git bisect` / `git blame`). Never rebase-merge feature branches.
6. **Always confirm before destructive ops** (force push, branch delete on shared branches, etc.).
7. **Co-author every commit** with `Co-Authored-By: <agent name> <noreply@anthropic.com>` when an AI agent contributed.
8. **Use `safe-deploy.sh` only** for prod and preview deploys. It is branch-aware: main → prod, develop → preview, hotfix/* → prod. Other branches are refused.
9. **Never run raw `gcloud run deploy`** for `sahayakai-hotfix-resilience`. The race-detection and `--no-traffic` guards in `safe-deploy.sh` are the only protection against parallel-session clobbering.

### Deployment

Reality (2026-05-21):
- **Prod deploy**: `bash sahayakai-main/scripts/safe-deploy.sh` from a `main` checkout, then manual `gcloud run services update-traffic ... --to-latest`. NO auto-deploy on push to main (workflows disabled, Cloud Build trigger not installed).
- **Preview deploy** (`sahayakai-preview`): `bash sahayakai-main/scripts/safe-deploy.sh` from a `develop` checkout. Will become auto on push to develop once the Cloud Build GitHub App is reinstalled and `scripts/setup-build-trigger-preview.sh` is run.
- **Service**: `sahayakai-hotfix-resilience` (prod) and `sahayakai-preview` (preview) — Cloud Run, region `asia-southeast1`, project `sahayakai-b4248`.

See [`sahayakai-main/DEPLOY.md`](sahayakai-main/DEPLOY.md) for the operator runbook, [`sahayakai-main/docs/PREVIEW_ENV.md`](sahayakai-main/docs/PREVIEW_ENV.md) for preview env details, and [`sahayakai-main/docs/ROLLBACK.md`](sahayakai-main/docs/ROLLBACK.md) for rollback procedure.

## Maintenance Log
*   **2026-01-29:** Project initialized. Discovery Questions answered via strategic analysis. Handshake verified Gemini API link. Created `architecture/lesson_plan_generation_sop.md`.
*   **2026-01-29:** Commenced **Phase 4: S - Stylize**. Added Copy button and improved layout for the Instant Answer component on the homepage.
*   **2026-01-29:** **Schema First Pattern Established** - Defined Teacher Training payload schema in `gemini.md`, created `validate_teacher_training.ts` validator, and integrated it into the flow. Tests confirm deterministic checks for empathy, pedagogy citations, and encouragement.
*   **2026-01-29:** **Agentic Skills Deployed** - Created `senior-software-engineer` and `scrum-master` skills. These enforce "Business Serious" operating protocols for Code Architecture and Project Governance.
*   **2026-01-29:** **Skills Upgraded to Expert Level** - Enhanced skills with "Phased Workflows", bundled Reference Templates (ADR, Checklists, Standups), and Python Automation Scripts (`scaffold_test.py`, `generate_status_report.py`).
*   **2026-01-29:** **Micro-Lesson Generator DEPLOYED (Vertical Slice 1)** - Completed Logic, UI, and PDF Export.
    *   **Architecture:** Enforced 5-slide rule via Validator.
    *   **Quality:** Passed Senior Engineer Audit (Complexity Check) and Vitest functional tests.
    *   **Feature:** Client-side PDF generation producing 5-slide, high-contrast decks.
*   **2026-03-09:** **BAKTA Persona & OmniOrb Consolidation** - Injected Mr. Abhishek Gupta's blunt, truth-speaking persona into the AI voice. Consolidated OmniOrb microphones and resolved domain mapping conflicts for `sargupta.in`.
*   **2026-03-04:** **Infrastructure & UX Hardening** - Fixed TTS Authorization ("Unauthorized" error) and implemented audio priming. Refactored "Grade" to "Class" terminology for Bharat-First localization.
*   **Next Step:** Apply Schema First methodology to remaining services (Quiz, Worksheet, Field Trip) and refine the UI to match the data contracts.

