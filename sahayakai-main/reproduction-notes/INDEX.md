# SahayakAI — Reproduction Notes Index

Complete technical documentation for reproducing the SahayakAI application from scratch.

**Total pages documented:** 26
**Total components documented:** 17 files (grouping related components)
**Total AI flows documented:** 5 files
**Total actions documented:** 5 files
**Total lib utilities documented:** 7 files
**Total global docs:** 7 files

---

## Start Here

If reproducing from scratch, read in this order:

1. [ARCHITECTURE.md](ARCHITECTURE.md) — Overall system design, request lifecycle, provider stack
2. [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) — Colors, typography, component library, icon rules
3. [DATA-SCHEMAS.md](DATA-SCHEMAS.md) — All Firestore collections and TypeScript types
4. [FIRESTORE-RULES.md](FIRESTORE-RULES.md) — Security rules (critical — app won't work without these)
5. [CONFIG.md](CONFIG.md) — Environment variables, next.config, tailwind config
6. [DEPLOYMENT.md](DEPLOYMENT.md) — Cloud Run, CI/CD, Firebase setup checklist

---

## Pages

### AI Tool Pages (core product)
| Page | Route | Doc |
|---|---|---|
| Home | / | [pages/home.md](pages/home.md) |
| Instant Answer | /instant-answer | [pages/instant-answer.md](pages/instant-answer.md) |
| Lesson Plan | /lesson-plan | [pages/lesson-plan.md](pages/lesson-plan.md) |
| Quiz Generator | /quiz-generator | [pages/quiz-generator.md](pages/quiz-generator.md) |
| Visual Aid Designer | /visual-aid-designer | [pages/visual-aid-designer.md](pages/visual-aid-designer.md) |
| Worksheet Wizard | /worksheet-wizard | [pages/worksheet-wizard.md](pages/worksheet-wizard.md) |
| Rubric Generator | /rubric-generator | [pages/rubric-generator.md](pages/rubric-generator.md) |
| Teacher Training | /teacher-training | [pages/teacher-training.md](pages/teacher-training.md) |
| Video Storyteller | /video-storyteller | [pages/video-storyteller.md](pages/video-storyteller.md) |
| Virtual Field Trip | /virtual-field-trip | [pages/virtual-field-trip.md](pages/virtual-field-trip.md) |
| Content Creator | /content-creator | [pages/content-creator.md](pages/content-creator.md) |
| Visual Aid Creator | /visual-aid-creator | [pages/visual-aid-creator.md](pages/visual-aid-creator.md) |

### User & Onboarding
| Page | Route | Doc |
|---|---|---|
| Onboarding | /onboarding | [pages/onboarding.md](pages/onboarding.md) |
| My Profile | /my-profile | [pages/my-profile.md](pages/my-profile.md) |
| Public Profile | /profile/[uid] | [pages/public-profile.md](pages/public-profile.md) |

### Social & Community
| Page | Route | Doc |
|---|---|---|
| Community | /community | [pages/community.md](pages/community.md) |
| Messages | /messages | [pages/messages.md](pages/messages.md) |
| Notifications | /notifications | [pages/notifications.md](pages/notifications.md) |
| My Library | /my-library | [pages/my-library.md](pages/my-library.md) |
| Community Library | /community-library | [pages/community-library.md](pages/community-library.md) |
| Submit Content | /submit-content | [pages/submit-content.md](pages/submit-content.md) |

### Analytics & Admin
| Page | Route | Doc |
|---|---|---|
| Impact Dashboard | /impact-dashboard | [pages/impact-dashboard.md](pages/impact-dashboard.md) |
| Review Panel | /review-panel | [pages/review-panel.md](pages/review-panel.md) |
| Cost Dashboard | /admin/cost-dashboard | [pages/admin-cost-dashboard.md](pages/admin-cost-dashboard.md) |
| Log Dashboard | /admin/log-dashboard | [pages/admin-log-dashboard.md](pages/admin-log-dashboard.md) |
| API Docs | /api-docs | [pages/api-docs.md](pages/api-docs.md) |
| API Playground | /api-playground | [pages/api-playground.md](pages/api-playground.md) |

---

## Components

### Layout & Navigation
| Component | File | Doc |
|---|---|---|
| AppSidebar | src/components/app-sidebar.tsx | [components/layout/app-sidebar.md](components/layout/app-sidebar.md) |
| OmniOrb (VIDYA) | src/components/omni-orb.tsx | [components/layout/omni-orb.md](components/layout/omni-orb.md) |

### Auth
| Component | Doc |
|---|---|
| AuthButton + AuthDialog | [components/auth/auth-button.md](components/auth/auth-button.md) |

### Community
| Component | Doc |
|---|---|
| CommunityChat | [components/community/community-chat.md](components/community/community-chat.md) |
| TeacherDirectory | [components/community/teacher-directory.md](components/community/teacher-directory.md) |
| CreatePostDialog | [components/community/create-post-dialog.md](components/community/create-post-dialog.md) |

### Messages
| Component | Doc |
|---|---|
| ConversationList | [components/messages/conversation-list.md](components/messages/conversation-list.md) |
| ConversationThread | [components/messages/conversation-thread.md](components/messages/conversation-thread.md) |
| MessageBubble | [components/messages/message-bubble.md](components/messages/message-bubble.md) |
| VoiceRecorder | [components/messages/voice-recorder.md](components/messages/voice-recorder.md) |

### Profile
| Component | Doc |
|---|---|
| ProfileView | [components/profile/profile-view.md](components/profile/profile-view.md) |

### AI Output Displays
| Component | Doc |
|---|---|
| All 8 display components | [components/ai-outputs/display-components.md](components/ai-outputs/display-components.md) |

### Shared / Utilities
| Component | Doc |
|---|---|
| Language/Grade/Subject/Difficulty selectors | [components/shared/selectors.md](components/shared/selectors.md) |
| MicrophoneInput | [components/shared/microphone-input.md](components/shared/microphone-input.md) |
| ImageUploader | [components/shared/image-uploader.md](components/shared/image-uploader.md) |
| FileTypeIcon | [components/shared/file-type-icon.md](components/shared/file-type-icon.md) |

---

## AI Flows

| Flow | Doc |
|---|---|
| Instant Answer | [flows/instant-answer.md](flows/instant-answer.md) |
| Lesson Plan Generator | [flows/lesson-plan-generator.md](flows/lesson-plan-generator.md) |
| Quiz Generator | [flows/quiz-generator.md](flows/quiz-generator.md) |
| Agent Router (VIDYA) | [flows/agent-router.md](flows/agent-router.md) |
| Rubric, Teacher Training, Video Storyteller, VFT, Visual Aid, Voice-to-Text, Worksheet | [flows/other-flows.md](flows/other-flows.md) |

---

## Server Actions

| Actions File | Doc |
|---|---|
| community.ts | [actions/community-actions.md](actions/community-actions.md) |
| messages.ts | [actions/messages-actions.md](actions/messages-actions.md) |
| connections.ts | [actions/connections-actions.md](actions/connections-actions.md) |
| content.ts | [actions/content-actions.md](actions/content-actions.md) |
| auth.ts + profile.ts + notifications.ts | [actions/auth-profile-actions.md](actions/auth-profile-actions.md) |

---

## Lib Utilities

| Utility | Doc |
|---|---|
| Firebase client + admin setup | [lib/firebase-setup.md](lib/firebase-setup.md) |
| Auth middleware (middleware.ts) | [lib/auth-middleware.md](lib/auth-middleware.md) |
| TTS service | [lib/tts-service.md](lib/tts-service.md) |
| Analytics + usage tracking | [lib/analytics-and-tracking.md](lib/analytics-and-tracking.md) |
| Indian context database | [lib/indian-context.md](lib/indian-context.md) |
| IndexedDB client storage | [lib/indexed-db.md](lib/indexed-db.md) |
| Server-side rate limiting | [lib/server-safety.md](lib/server-safety.md) |

---

## Critical Rules to Never Break

1. **AI flows are server modules** — never `'use server'`, never imported by pages directly
2. **x-user-id from headers only** — never trust client-supplied userId in server actions
3. **connections created via Admin SDK only** — Firestore rules block client create on connections
4. **No emojis in UI** — all visual communication via Lucide icons
5. **11 languages** — never assume Hindi-only; all selectors must show all 11 languages
6. **Voice on all chat surfaces** — every chat component must have VoiceRecorder
7. **Never commit to main directly** — always branch, merge with `--no-ff`
8. **pairId deterministic** — `[uid1, uid2].sort().join('_')` everywhere, consistently
9. **Google Search grounding OFF for lesson-plan** — only Instant Answer uses it
10. **Print IDs** — every display component needs its `id="*-pdf"` div for print CSS

---

## Key File Paths Quick Reference

```
src/app/layout.tsx              Root layout + provider stack
src/middleware.ts               Auth + security headers
src/context/auth-context.tsx    Firebase auth state
src/context/language-context.tsx  11-language support
src/lib/firebase.ts             Client SDK init
src/lib/firebase-admin.ts       Server SDK init (lazy)
src/lib/server-safety.ts        Rate limiting
src/lib/tts.ts                  Text-to-speech
src/lib/indian-context.ts       Cultural context DB
src/types/index.ts              Core enums + interfaces
src/types/messages.ts           Messaging schema
firestore.rules                 Security rules
```
