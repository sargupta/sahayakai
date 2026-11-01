# Decisions and governance

A design system stays coherent only if its decisions are written down and changed on purpose.

## Decided

| Decision | Choice |
| --- | --- |
| Canonical design | Two founder-approved canvases. The 16-screen v3 canvas sets the visual language and the shared chrome; the 47-screen v2 canvas defines the rest of the product (VIDYA Live, conversation, community, every tool's composer and output, parent calls, library, offline). Where they draw the same thing differently, v3 wins |
| Typefaces | Bricolage Grotesque (display) and Instrument Sans (UI), falling back to Noto Sans per script |
| Brand colour | One saffron, `saffron-500` #C96A28; text tones `saffron-600` and `saffron-700`. White text never sits on `saffron-500` (3.77:1): a saffron fill that carries a label (primary buttons, selected chips and segments, the teacher's chat bubble, letter marks) is `accent-fill` (`saffron-600`, 5.28:1). `saffron-500` stays for the orb, dots, bars, icon discs and focus edges (decided 26 Oct 2026) |
| Meaning colours | Leaf means done, selected and ready; indigo means working and curriculum; red and amber are status |
| Neutrals | Warm milk grounds and warm ink text, never slate or pure black |
| Material | Glass cards on a pastel wash, with low warm shadows |
| Shape | Pills for everything pressable; container radii 12–38 |
| Home | Voice-first on the teacher's real day (decided 25 Oct 2026): the day as the headline, waiting items written as things to say, the orb as the hero (no parked orb), the type bar |
| Navigation | Four destinations, never five: Home, Library, Community, Profile, on the phone tab bar and at the top of the web sidebar. Creation through VIDYA and Home. The web's Home · Create · Library · Me bottom bar retires |
| VIDYA | One assistant, three bodies: the glyph-free orb is VIDYA, a mic button is a control, an inline mic is dictation. Three ways to talk: ask in place, VIDYA Live, conversation. Colour is state; the orb is never red; the microphone is open only while VIDYA is visibly listening |
| VIDYA's colours | Listening saffron, working and grounding indigo (v2's bright blue is retired), speaking and ready leaf (the web's saffron speaking state is retired), offline stone. Failure is shown by a red pill and an error card, not the orb |
| VIDYA acting in the app | Navigation only to known sections; actions only when the current screen offers them; anything that changes data waits for an explicit Confirm that voice cannot skip |
| Library | Generations (one row per output, even on retry) and Conversations (every chat and Live talk). A conversation never creates a Generation |
| Icons | One drawn set (`Icon`, 20px grid, 1.7 stroke). No emoji, no text symbols (✓ ✕ ➤ ⚙) and no brand logos in the interface |
| Action colours | Saffron is the one primary; leaf for done and confirm-to-send actions (Submit attendance, Call parent, Send message); red for ending. Indigo is never a button colour, so Regenerate is a secondary button. The black pill is a website-only CTA |
| Web app | The phone layout under 768px; a rail at 768-1023px; the sidebar plus top bar from 1024px; Sheets become Dialogs from 768px (see "The web app and the school console") |
| Boards | All 29 mapped boards selectable; every output labelled with its board |
| Focus | An outline, offset 2px, never a shadow |
| Text size | 12px floor in every script. The apps follow the phone's and the browser's own text-size settings, with no in-app text-size setting (decided 26 Oct 2026) |
| Theme | Light only. The web and Flutter dark modes retire; the camera surface stays dark. A SahayakAI dark theme is designed only if teachers ask for it (decided 26 Oct 2026) |
| Desktop sidebar | Talk to VIDYA, the four destinations, then Make, Class, Messages · Notifications and a folded Explore. Labs is hidden from teachers and stays visible to staff and beta testers behind a flag (decided 26 Oct 2026) |
| Website proof | No sample testimonials on the live site. A testimonial appears only with the person's written consent; until there are signed ones, the section is left out. A figure appears only when it can be sourced (decided 26 Oct 2026) |
| Illustration | None. Empty states and onboarding use one sentence, one action and the orb (decided 26 Oct 2026) |
| How Live starts | Home: hold the hero orb. Every other screen: "Keep talking" in the ask sheet, because holding the parked orb moves it. Web: "Talk to VIDYA" (decided 26 Oct 2026) |
| Live minutes | Read on Profile's usage card (`UsageMeter`, `live`). In Live, a quiet amber "5 min left" pill appears only near the end (`LiveHeader`, `minutesLeft`). At zero VIDYA finishes her sentence, says the month's Live minutes are used up, and offers to carry on by typing. School admins see the pool in the console (decided 26 Oct 2026) |

## Open: needs a founder decision

None. The last eight open questions were decided on 26 Oct 2026, and each is now a row in the table above.

## Follow-through in code

The system already carries these decisions. The apps still need them:
- **Fills under white text.** Primary buttons, selected chips and segments, and the teacher's chat bubble move to `accent-fill` (`saffron-600`) in the Next.js theme (`--primary`) and in Flutter (`lPrimary`).
- **12px floor.** Raise every 10–11px text style in both apps to 12px. Respect the phone's and the browser's text-size settings: no clamped `TextScaler` in Flutter, no fixed-px root size on the web.
- **Light only.** Remove the web theme switch and its dark styles, and Flutter's `darkTheme`, so both apps follow light. The camera surface stays dark.
- **Labs.** Hide it from teachers in the web sidebar behind a flag that staff and beta testers keep.
- **Website.** Take the sample testimonials off the live site until signed consents exist.
- **Live minutes.** The backend reports minutes left. Profile's usage card shows them, Live shows the pill at 5 minutes or fewer, and VIDYA's out-of-minutes line is written in every app language.

## How the system changes

- **One source.** Every value lives in `tokens.json`. Code, docs and decks read it; nobody copies a hex by hand.
- **Proposal.** A change states the problem, the evidence (screens, contrast measurements, teacher feedback) and the before/after renders.
- **Checks.** It passes the gates in "Accessibility and quality gates" and renders every affected component preview.
- **Sign-off.** Brand-level changes (colour, type, navigation, VIDYA's behaviour) need the founder's sign-off. Component changes need a design review.
- **Record.** Every published change is noted in the system's last-change line and, for decisions, in this register.
- **Adopt on touch.** Any product PR that touches a surface migrates it to these tokens and components; nothing is out of scope.
