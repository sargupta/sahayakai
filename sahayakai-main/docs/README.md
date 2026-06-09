# SahayakAI Documentation Index

Central index for all project documentation. Docs are organized by purpose.
Each entry is tagged **LIVING** (kept current with the codebase) or
**HISTORICAL** (a point-in-time record, frozen — do not rewrite).

> Naming convention: `SCREAMING_SNAKE_CASE.md`. Root-level `README.md`,
> `AGENTS.md`, and `CHANGELOG.md` keep their conventional names for tooling.

## architecture/ — system design
| Doc | Status |
|-----|--------|
| [SOLUTION_ARCHITECTURE.md](architecture/SOLUTION_ARCHITECTURE.md) | LIVING |
| [PROJECT_DETAIL.md](architecture/PROJECT_DETAIL.md) | LIVING |
| [BLUEPRINT.md](architecture/BLUEPRINT.md) | LIVING |
| [ARCHITECTURE_REVIEW.md](architecture/ARCHITECTURE_REVIEW.md) | HISTORICAL (Jan 2026 review) |
| [ARCHITECTURE_REVIEW_ADDENDUM.md](architecture/ARCHITECTURE_REVIEW_ADDENDUM.md) | HISTORICAL |

## data/ — data model & schema
| Doc | Status |
|-----|--------|
| [DATABASES_SCHEMA.md](data/DATABASES_SCHEMA.md) | LIVING |
| [DATABASE_SCHEMA_REVIEW.md](data/DATABASE_SCHEMA_REVIEW.md) | LIVING |
| [DATABASE_VERIFICATION_REPORT.md](data/DATABASE_VERIFICATION_REPORT.md) | LIVING |
| [TEACHER_CONNECT_SCHEMA.md](data/TEACHER_CONNECT_SCHEMA.md) | LIVING |
| [TEACHER_CONNECT_PUB_SUB.md](data/TEACHER_CONNECT_PUB_SUB.md) | LIVING |
| [TEACHER_LOOKUP.md](data/TEACHER_LOOKUP.md) | LIVING |

## operations/ — cost, flags, deploy, monitoring, runbooks
| Doc | Status |
|-----|--------|
| [COST_ANALYSIS.md](operations/COST_ANALYSIS.md) | LIVING |
| [FEATURE_FLAGS.md](operations/FEATURE_FLAGS.md) | LIVING |
| [MONITORING.md](operations/MONITORING.md) | LIVING |
| [ALERTS.md](operations/ALERTS.md) | LIVING |
| [MAINTENANCE_GUIDE.md](operations/MAINTENANCE_GUIDE.md) | LIVING |
| [DEPLOY.md](operations/DEPLOY.md) | LIVING |
| [BRANCHING.md](operations/BRANCHING.md) | LIVING |
| [BRANCH_STRATEGY.md](operations/BRANCH_STRATEGY.md) | LIVING |
| [PREVIEW_ENV.md](operations/PREVIEW_ENV.md) | LIVING |
| [COMMUNICATION_PROTOCOL.md](operations/COMMUNICATION_PROTOCOL.md) | LIVING |
| [TESTING_PROTOCOL.md](operations/TESTING_PROTOCOL.md) | LIVING |
| [TEST_PLAN.md](operations/TEST_PLAN.md) | LIVING |
| [APP_TESTING_ROADMAP.md](operations/APP_TESTING_ROADMAP.md) | LIVING |
| [ROLLBACK.md](operations/ROLLBACK.md) | HISTORICAL (incident runbook) |
| [INCIDENTS.md](operations/INCIDENTS.md) | HISTORICAL (append-only log) |

## product/ — features, manuals, community, i18n, design system
| Doc | Status |
|-----|--------|
| [USER_MANUAL.md](product/USER_MANUAL.md) | LIVING |
| [USER_MANUAL_UNIFIED.md](product/USER_MANUAL_UNIFIED.md) | LIVING |
| [USER_MANUAL_BENGALI.md](product/USER_MANUAL_BENGALI.md) | LIVING |
| [USER_TESTING_PROMPTS.md](product/USER_TESTING_PROMPTS.md) | LIVING |
| [DESIGN_TOKENS.md](product/DESIGN_TOKENS.md) | LIVING |
| [I18N_BACKLOG.md](product/I18N_BACKLOG.md) | LIVING |
| [VIDEO_RECOMMENDATION_ALGORITHM.md](product/VIDEO_RECOMMENDATION_ALGORITHM.md) | LIVING |
| [COMMUNITY_LIBRARY_ARCHITECTURE.md](product/COMMUNITY_LIBRARY_ARCHITECTURE.md) | LIVING |
| [COMMUNITY_PHASE_1_5_REFERENCE.md](product/COMMUNITY_PHASE_1_5_REFERENCE.md) | LIVING |
| [COMMUNITY_REDESIGN_PLAN.md](product/COMMUNITY_REDESIGN_PLAN.md) | LIVING |
| [MESSAGING_REDESIGN_PLAN.md](product/MESSAGING_REDESIGN_PLAN.md) | LIVING |
| [MOBILE_UX_ANALYSIS.md](product/MOBILE_UX_ANALYSIS.md) | HISTORICAL (Feb 2026 analysis) |

## strategy/ — business, impact, pitch, market
| Doc | Status |
|-----|--------|
| [BUSINESS_MODEL.md](strategy/BUSINESS_MODEL.md) | LIVING |
| [IMPACT_SCORE.md](strategy/IMPACT_SCORE.md) | LIVING |
| [SAHAYAKAI.md](strategy/SAHAYAKAI.md) | LIVING |
| [WHITEPAPER.md](strategy/WHITEPAPER.md) | LIVING |
| [PROJECT_SNAPSHOT.md](strategy/PROJECT_SNAPSHOT.md) | LIVING |
| [STRATEGIC_REVIEW.md](strategy/STRATEGIC_REVIEW.md) | LIVING |
| [RURAL_INDIA_ROADMAP.md](strategy/RURAL_INDIA_ROADMAP.md) | LIVING |
| [RURAL_ADAPTATION_SUMMARY.md](strategy/RURAL_ADAPTATION_SUMMARY.md) | LIVING |
| [INDIAN_CONTEXT_FEATURES.md](strategy/INDIAN_CONTEXT_FEATURES.md) | LIVING |
| [GOOGLE_SERVICES.md](strategy/GOOGLE_SERVICES.md) | LIVING |
| [CRITICAL_ANALYSIS.md](strategy/CRITICAL_ANALYSIS.md) | LIVING |
| [CHALLENGING_QUESTIONS.md](strategy/CHALLENGING_QUESTIONS.md) | LIVING |
| [PROJECT_REQUIREMENTS.md](strategy/PROJECT_REQUIREMENTS.md) | LIVING |
| [PROMPTS.md](strategy/PROMPTS.md) | LIVING |
| [PROJECT_TODO.md](strategy/PROJECT_TODO.md) | LIVING |

## reference/ — current-state code mirror
- [reproduction-notes/](reference/reproduction-notes/) — page-by-page,
  component-by-component, flow-by-flow snapshot of the codebase (68 files).
  **LIVING** — regenerated to reflect current code.

## historical/ — frozen point-in-time records (do NOT rewrite)
- [CHANGE_LOG.md](historical/CHANGE_LOG.md)
- [GAP_EXECUTION_PLAN.md](historical/GAP_EXECUTION_PLAN.md)
- `ui_fixes/`, `baseline/`, `journey_changes/`, `production_checks/`,
  `ai_changes/` — forensic fix logs and feature-branch snapshots.

## Elsewhere in the repo (not under docs/, noted for completeness)
- Root: [`README.md`](../README.md), [`AGENTS.md`](../AGENTS.md),
  [`CHANGELOG.md`](../CHANGELOG.md) — LIVING.
- `outputs/ux_review_2026_04_21/`, `outputs/design_critique/` — HISTORICAL UX reviews.
- `demo-prep/` — HISTORICAL demo materials.
- `qa/` — HISTORICAL QA forensics.
- `infra/README.md`, `monitoring/README*.md` — LIVING infra docs.
- `services/voice-server/docs/DATABASE_SCHEMA.md` — LIVING (voice-server schema).
