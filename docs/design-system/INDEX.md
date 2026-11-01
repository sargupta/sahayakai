# SahayakAI design system — mobile reference

Imported 2026-11-01 from the **SahayakAI** design-system artifact
(https://claude.ai/artifact/EaHTw4ZR4Gh4rRiajMdaub, version `1793008987-cdf7`).
This folder is the reference for implementing the mobile screens in this app.
It is documentation only: nothing here is compiled or bundled.

## What is here

| Path | What it is |
| --- | --- |
| `SYSTEM.md` | The system's own README: thesis, voice, colour, type, space, shape, motion, VIDYA, a11y floor |
| `tokens.json` | Every token (colour, type, space, radius, shadow, wash). Source for `lib/core/theme/*` |
| `design-system.json` | Manifest of the system (groups, components, decisions) |
| `guides/` | 11 guides: screen anatomy, VIDYA and voice, VIDYA Live, boards, languages, writing, the canonical flow, a11y gates, platforms and code (has the Flutter migration table), decisions, print/messages |
| `screens/<Name>/` | The 40 mobile screens: `README.md` (spec, states, rules) + `preview.html` (the exact composition, as React calls) |
| `components/<Name>/` | The 91 components those screens are built from: `README.md` + `preview.html` |
| `reference/index.d.ts` | Props for every component (includes `Checkbox` and the `LANGUAGES` list, which have no folder of their own) |
| `reference/bundle.css` | The `sk-` reference CSS. Port paddings, sizes and radii from here exactly |
| `assets/` | READMEs for app icons, the 49-glyph icon set and logos (the SVG/PNG files were not published with the artifact) |

`preview.html` files need the artifact's `bundle.js` to render, which was not copied.
Read them as code, or open the artifact link to see them drawn.

## What was left out, and why

- **Website, web app and school console**: `ScreenWeb*`, `ScreenConsole*`, `Web*`, `CTABand`, `FeatureCard`, `MetricCard`, `Testimonial`, `DevicePhone`, `Cover`, `SideRail`, `TopBar`, `Dialog`, `LibraryCard`, `VidyaPresence`, `DataTable`, `SourceLabel`, `OutcomeBar`, `ApiKeyRow`, `KeyReveal`, and guides `07-website.md` and `13-web-app.md`. Not mobile. (`StatTile` is grouped under Console but the Student and Scan results screens use it, so it is included.)
- **Fonts and licences**: identical copies are already in `assets/fonts/`.
- **`components/bundle.js`, `artifact-type/`, `SKILL.md`**: the artifact's web runtime and viewer, not design content.

## Screen map

Each mobile screen and where it lands in `lib/features/`. "Exists" means a screen
for that job is already there and should be brought to the spec; "New" means
nothing covers it yet.

### Start
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenOnboarding | `onboarding/presentation/onboarding_screen.dart` | Exists |
| ScreenHome | `vidya/presentation/vidya_home_screen.dart` (Home tab) | Exists |

### VIDYA
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenListening | `vidya/presentation/vidya_sheet.dart` (VoiceSheet over the page) | Exists |
| ScreenConversation | `vidya/` typed thread (ChatThread + Composer chat variant) | New route |
| ScreenInstantAnswerAsk | `instant_answer/presentation/instant_answer_screen.dart` (ask) | Exists |
| ScreenInstantAnswer | `instant_answer/presentation/instant_answer_screen.dart` (answer) | Exists |
| ScreenLiveListening | VIDYA Live full-screen route over `vidya/data/gemini_live_client.dart` | New |
| ScreenLiveWorking | VIDYA Live (working state) | New |
| ScreenLiveSpeaking | VIDYA Live (speaking state) | New |
| ScreenLiveFailed | VIDYA Live (failed state) | New |

### Make
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenMake | `content_creator/presentation/content_creator_screen.dart` | Exists |
| ScreenComposer | `lesson_planner/presentation/lesson_plan_screen.dart` (composer) | Exists |
| ScreenQuizComposer | `quiz_generator/presentation/quiz_generator_screen.dart` (composer) | Exists |
| ScreenWorksheetWizard | `worksheet_wizard/presentation/worksheet_wizard_screen.dart` | Exists |

### Outputs
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenLessonPlan | `lesson_planner/` output | Exists |
| ScreenQuizOutput | `quiz_generator/` output | Exists |
| ScreenExamPaper | `exam_paper/presentation/exam_paper_screen.dart` | Exists |
| ScreenRubric | `rubric_generator/presentation/rubric_generator_screen.dart` | Exists |
| ScreenVisualAid | `visual_aid/presentation/visual_aid_screen.dart` | Exists |

### Class and calls
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenRegister | `attendance/presentation/attendance_roster_screen.dart` | Exists |
| ScreenRollCall | `attendance/presentation/mark_attendance_screen.dart` | Exists |
| ScreenStudent | `attendance/` student detail | New |
| ScreenOutreach | `parent_hotline/` pickStudent stage | Exists |
| ScreenReason | `parent_hotline/` reason stage (sheet, step 1 of 3) | Exists |
| ScreenEvidence | `parent_hotline/` compose stage (sheet, step 2 of 3) | Exists |
| ScreenMessageReview | `parent_hotline/` review stage | Exists |
| ScreenInCall | `parent_hotline/` calling stage | Exists |
| ScreenCallSummary | `parent_hotline/` summary stage (placeholder today) | Partial |
| ScreenSendToParents | `parent_message/presentation/parent_message_screen.dart` | Exists |

### Community
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenCommunity | `staffroom/presentation/staffroom_screen.dart` (feed) | Exists |
| ScreenStaffRoom | `staffroom/presentation/staff_room_chat_screen.dart` | Exists |
| ScreenNetwork | `staffroom/presentation/network_hub_screen.dart` | Exists |
| ScreenMessages | `inbox/presentation/inbox_screen.dart` | Exists |
| ScreenResources | shared resources library | New |

### Library and you
| Screen | Flutter target | Status |
| --- | --- | --- |
| ScreenLibrary | `library/presentation/library_screen.dart` (Generations) | Exists |
| ScreenLibraryConversations | `library/` Conversations segment | New segment |
| ScreenOffline | offline queue (designed, not shipped; see `SYSTEM.md` "Not synced") | New |
| ScreenProfile | `profile/presentation/me_screen.dart` | Exists |
| ScreenScanner | `assessment_scanner/presentation/assessment_scanner_screen.dart` | Exists |
| ScreenScanResults | `assessment_scanner/` results | Exists |

## Shared chrome

### Decision: VIDYA is docked in the tab bar (2026-11-01)

This app deliberately departs from this system on one rule. `SYSTEM.md` and `guides/02-vidya-and-voice.md` say the orb is "never inside the tab bar"; the product owner chose the v2 canvas's "Group I · VIDYA as a layer, not a page" instead (screens 9a-01 to 9a-06, https://claude.ai/artifact/G6QCt8NrxPeyV26u6jXVJz). Where this section and the system disagree about the tab bar or the orb's place, this section wins.

- **On the shell** (`/`, the four tabs) the orb sits in the bar after a divider; the floating orb hides.
- **On pushed screens** (tools, no tab bar) the floating orb parks as the system describes.
- Exactly one orb per screen either way. Everything else about the orb (colour is state, no glyph, motion) is unchanged.

### Where each piece lives

- **TabBar** → `dashboard/presentation/floating_bottom_nav.dart` (keeps its name; Flutter's material library already has a `TabBar`). No drawn labels, 18px icons, `surface-chrome` capsule, `FloatingNavTone.camera` for the scanner. Two layouts:
  - undocked (system spec): 42px discs 6px apart in 48px touch cells, saffron active disc;
  - docked (v2 9a, used by the app): 40px discs 4px apart in 44px cells, 1×24 divider, the orb; the active tab is a 12% saffron tint with a saffron-600 icon, so the orb stays the one saffron sphere.
- **Dock** → `vidya/presentation/widgets/vidya_dock.dart`: `VidyaDockOrb` (42px sphere, 44px cell, smaller dock shadow) and `VidyaDockPrompt`, the capsule above the bar: "Ready · Tap to deliver" with the count opens the deliver tray from any tab; "Tap to speak" shows on Home while resting.
- **Shared orb logic** → `vidya/presentation/vidya_presence.dart`: state mapping, hint and tap for both the dock and the floating orb (`vidya_overlay.dart`).
- **Orb** → `vidya/presentation/widgets/vidya_orb.dart`. Glyph-free in every state; floating, it parks right 16 / bottom 100 (172 over a CTA), left 18 for the left hand.
- **Not yet built from 9a**: a per-page context object feeding page-specific suggestions into the capsule ("Make a worksheet from this post"). The capsule shows only the ready and Home states today.
- **ScreenHeader**: no shared widget yet; screens draw their own headers.
- **OrbHint / VoiceSheet / DeliverTray**: see `guides/02-vidya-and-voice.md`.
- **Tokens**: `lib/core/theme/` carries the colour, radius and spacing tokens; check type, shadows and washes against `tokens.json`.
