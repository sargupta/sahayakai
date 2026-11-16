# Screenshots: SahayakAI as built (develop @ 92837486)

Captured on 2026-11-03 from the real running application. Nothing here is a mock-up.

**How they were captured**
1. A clean, detached checkout of `92837486` was made as a separate git worktree (`E:\sargvision\ds-develop-wt`, `node_modules` linked from riya-wt). This keeps the uncommitted riya-wt working tree out of the images.
2. Screens 01–17 came from `next dev` on `:3011`, reading the already-running local Firestore emulator (no seeding).
3. That machine stack stopped mid-run, so screens 18–25 came from a fresh, disposable `scripts/sampark/Start-Riya-Local.ps1 -NoOpen -NoMenu -Port 3011` stack. It used an in-memory emulator and disposable keys. The demo school `hillview-demo` was switched on in **Practice** mode, so nothing can ring.
4. Capture used headless Chromium (Playwright) at DPR 1. Desktop is 1440×900, tablet 900×1100, phone 390×844 (mobile emulation).

The Next.js dev-tools badge was hidden with CSS. No other styling was touched.

**Signed out.** Teacher pages run without a Firebase user, because sign-in is real Google auth and I did not sign in on your behalf. Sampark pages use the documented local dev login (`auth-token=dev-token` cookie, development only), which maps to the seeded admin `dev-user-123`.

**Full-page captures.** These are 1440 wide and taller than 900. In them, the sidebar (`sticky h-svh`), the fixed app wash and the fixed mic orb or TabBar are drawn at their first-viewport position. That is why the wash or sidebar stops at 900px, and why the phone TabBar sits mid-page in `24-phone-lesson-plan.png`. In the browser, they stay pinned while you scroll.

| File | Route | Viewport | What it shows |
|---|---|---|---|
| `01-landing-logged-out.png` | `/` | 1440, full | Marketing landing: ambient glow, Indic marks, hero VIDYA orb, rotating headline, black "Start free" pill |
| `02-lesson-plan.png` | `/lesson-plan` | 1440, full | App shell (sidebar, top bar, wash); bespoke two-column Lesson Plan form |
| `03-worksheet-wizard.png` | `/worksheet-wizard` | 1440, full | **GeneratorPage pattern**: accent bar, icon disc, dashed upload, prompt chips, 3-up selects, CTA, result empty state |
| `04-quiz-generator.png` | `/quiz-generator` | 1440, full | GeneratorPage plus two-column settings: SelectableCards, Bloom chips, slider, strategy callout. An empty bordered strip shows at the top of the settings panel |
| `05-exam-paper.png` | `/exam-paper` | 1440 | Signed-out state: a bare message with no sign-in button |
| `06-rubric-generator.png` | `/rubric-generator` | 1440, full | GeneratorPage |
| `07-instant-answer.png` | `/instant-answer` | 1440, full | GeneratorPage |
| `08-my-library.png` | `/my-library` | 1440 | Sign-in empty state with CTA |
| `09-community.png` | `/community` | 1440, full | Community |
| `11-teacher-training-vidya.png` | `/teacher-training` | 1440 | Sign-in state. The page says "AI Coach"; the nav says "Teacher Training" |
| `12-messages.png` | `/messages` | 1440 | Sign-in state |
| `13-usage.png` | `/usage` | 1440 | Sign-in state |
| `14-command-palette-modal.png` | `/lesson-plan` + Ctrl+K | 1440 | ⌘K palette (Dialog). The ✕ overlaps the "ESC" hint |
| `15-vidya-talk-open.png` | `/lesson-plan` + "Talk to VIDYA" | 1440 | VIDYA error path (no microphone in headless Chromium): toast beside the desaturated orb |
| `16-sampark-public-site.png` | `/sampark` | 1440, full | SamparkAI marketing site |
| `17-sampark-workspace.png` | `/sampark/workspace` | 1440 | SamparkAI workspace: `.theme-sampark` cool slate, school rows, StatusPill |
| `18-sampark-school-today.png` | `/sampark/hillview-demo` | 1440, full | Sampark "Today" console: Practice banner, calling window, KPI tiles with sparklines, by-language, parents |
| `19-sampark-calls.png` | `/sampark/hillview-demo/calls` | 1440, full | Calls |
| `20-sampark-families.png` | `/sampark/hillview-demo/families` | 1440, full | Parents roster, still loading (shows `LoadingBlock` skeletons) |
| `21-sampark-campaigns.png` | `/sampark/hillview-demo/campaigns` | 1440 | Campaigns |
| `22-sampark-demo.png` | `/sampark/demo` | 1440 | Sampark demo sign-in: role cards (principal in peach `live` tone, teacher list), MiniStats |
| `23-tablet-rail-lesson-plan.png` | `/lesson-plan` | 900 | **Rail** layout (76px), labels under icons, Sampark at the foot |
| `24-phone-lesson-plan.png` | `/lesson-plan` | 390, full | Phone shell: menu, wordmark, search, language, avatar; single column; TabBar capsule |
| `25-phone-landing.png` | `/` | 390 | Landing on a phone |

**Not captured**
| Screen | Why |
|---|---|
| Signed-in teacher dashboard (`DashboardHome`), a populated Library or Profile, generated outputs (`ResultShell` bodies) | Need a real Google/Firebase sign-in, and live AI calls for outputs. The dashboard is reconstructed (and labelled) in `../SAHAYAKAI_UI_SHOWCASE.html` |
| `/attendance` (`10-attendance.png`) | Headless Chromium got `ERR_CONNECTION_REFUSED` on 4 attempts while `curl` returned 200 for the same URL. The first two attempts coincided with the dev server going down. Not investigated further |
| Dark mode | Not toggled |
