# 11 — Accessibility Proposal

**Lens:** Inclusive design for SahayakAI's real users — teachers on mid-range Android phones, in bright classrooms and open verandas, with varying literacy, eyesight, and tech comfort. NEP/RTE "Divyang inclusion" is already in our AI soul prompt; the UI must match. Constraints: Lucide icons only, saffron-forward, 11 Indic languages.

Files reviewed: `dashboard/dashboard-home.tsx`, `lesson-plan/lesson-plan-input-section.tsx`, `microphone-input.tsx`, `ui/button.tsx`, `ui/input.tsx`, `lib/tts.ts`, `marketing/page-audio.tsx`, `app/globals.css`.

---

## 1. Current-state assessment + top gaps

**What's already good.** Button base height was raised to 44px (iOS HIG / Material min) — the comment shows intent. Voice is a first-class input: `MicrophoneInput` does VAD, noise suppression, per-language BCP-47 STT, and a spoken greeting. `focus-visible:ring-2` exists on Button and Input. A reusable browser-TTS read-aloud already ships as `PageAudio` (zero-cost, no auth). Attendance calendar explicitly sets `min-h-[44px] min-w-[44px]`.

**Top gaps (ranked):**

1. **Contrast — saffron-on-white fails WCAG AA.** `--primary` = `28 70% 59%` (#FF9933). Measured:
   - Saffron text on white: **2.51:1** (AA needs 4.5:1). The dashboard `<span className="text-primary">{teacherName}</span>`, "Answer" heading, and every saffron link/label fail.
   - **White text on a saffron button: also ~2.5:1** — our *primary CTA label* fails AA. `--ring` is the same saffron, so the focus ring on a saffron button is nearly invisible.
   - `--muted-foreground` on white: **4.72:1** — squeaks past indoor AA, fails in sunlight. Most secondary/helper copy uses it.
2. **No screen-reader announcement of AI results.** Only 8 files in the whole app use `aria-live`/`role=status`/`sr-only`. The dashboard "Thinking" dots and the `answer` panel render silently — a low-vision teacher gets no "generating… / here is your answer" cue. Generator result surfaces mostly lack live regions too.
3. **Touch targets below min on key controls.** Dashboard text-submit button is `h-10 w-10` (40px); the answer-close `X` is `h-6 w-6` (24px). Both are below the 44px floor the Button base already sets elsewhere.
4. **Icon-only buttons missing labels.** ~28 `size="icon"` buttons have no inline `aria-label` (some rely on `title`, which SRs read inconsistently). Lucide `<Image>`, `<X>`, `<RefreshCw>` render as unlabeled to assistive tech.
5. **Missing alt text.** Only 19 `alt=` in the codebase; generated visual-aid / diagram images are the whole point of that tool and need descriptive alt (or the AI caption).
6. **Motion with no `prefers-reduced-motion` guard.** Dashboard stacks `animate-ping`, `animate-pulse`, `animate-bounce`; the mic pulses on a 3s loop. No reduced-motion escape hatch — a problem for vestibular sensitivity and for cheap GPUs (also a perf/"lagging" signal).

---

## 2. Design approach: voice + iconography as PRIMARY

For a low-literacy or low-vision teacher, reading dense Devanagari/Tamil at arm's length in sun is the failure mode. Treat **voice as the accessibility superpower it already is**, and make **icons carry meaning, text confirm it** — never text alone.

- **Every primary action = big mic + big icon + short label.** The dashboard hero already leads with an XL mic; extend that pattern to each generator: a persistent "बोलकर बताइए / Tap and speak" affordance above the text field, not hidden below the fold.
- **Icon-first tool cards.** Quick-action cards already pair a Lucide glyph with a title — keep the icon large (28–32px), give every card an `aria-label` combining tool + description, and never ship an icon-only control without a visible OR `sr-only` label.
- **Round-trip voice.** Input is voice; output should be too (see §4). A teacher should be able to speak a topic and *hear* the result without reading a word.
- **Consistent icon vocabulary.** One Lucide glyph per concept app-wide (Mic = speak, Volume2 = listen, Lightbulb = answer, Sparkles = AI). Predictability is an accessibility feature for low-tech-comfort users.

---

## 3. Contrast & sizing standards (beyond WCAG minimums)

Tuned for outdoor glare and low-end panels — target **AAA where cheap, AA as the floor**:

| Token / element | Rule |
|---|---|
| Saffron as **text on light** | Ban `text-primary` for body text. Use `saffron-700` (`20 78% 38%`) = **5.25:1** on saffron-50. Reserve #FF9933 for large non-text fills/borders/icons ≥24px (3:1 UI rule). |
| Saffron as **button background + white text** | Darken CTA bg to saffron-700 (white-on-saffron-700 = **5.68:1**) OR keep #FF9933 with **near-black `--foreground` text (7.12:1)**. Don't ship white-on-#FF9933 for the label. |
| Body / secondary text | Floor **4.5:1**; prefer 7:1. Bump `--muted-foreground` one step darker for helper copy read outdoors. |
| Focus ring | Ring must contrast with BOTH the control and the page. Give focus a **2px dark outline + 2px offset** (or invert the ring on saffron surfaces) so it isn't saffron-on-saffron. |
| Touch targets | **48×48px** min for anything a rural user taps in the field (above the 44px WCAG floor). No exceptions for the submit arrow or close `X`. Spacing ≥8px between targets. |
| Base font | Body **≥16px** (already true on inputs); allow a user text-scale up to 200% without clipping (`indic-text` line-height already generous — verify no fixed heights truncate). |

---

## 4. Accessible AI generate → result flow

The generate→result moment is where SRs and low-vision users fall off today.

1. **Announce state changes via a live region.** Wrap the status zone in `aria-live="polite"` (`aria-busy` while thinking). "Thinking…" and the arrival of `answer`/generated content should be spoken by the SR automatically — currently silent.
2. **Errors as `role="alert"`.** Toasts for "No speech detected", quota, connection errors should be assertive live regions, not visual-only.
3. **Read-aloud on every result.** Generalize the existing `PageAudio` pattern into a `<ReadAloudButton text=…>` (Volume2 icon, browser TTS first → cloud for Indic voices). Ship it on lesson-plan, quiz, worksheet, exam-paper, and the dashboard `answer` panel. `stripMarkdown` in `tts.ts` already exists for clean playback. `assessment-result.tsx` is the reference implementation.
4. **Readable output.** Result body ≥16px, generous line-height, high-contrast text, honor reduced-motion (no slide-in on the result if the user opted out). Keep the "Sahayak can make mistakes" note — but give it 4.5:1, not muted-on-muted.
5. **Focus + scroll management.** On result render, move focus to the result heading so keyboard and SR users land on the answer, not stranded at the mic.
6. **Generated-image alt.** Feed the AI's own one-line description into `alt` for visual-aid output.

---

## 5. "Simple / Assist Mode" concept

A single, persistent, per-account toggle (in profile + a one-tap chip on the dashboard) — **not** buried in settings — that flips the app into a high-support layout for low-literacy / low-vision / first-time users:

- **Bigger everything:** text-scale ~1.25×, all targets 56px, one-column layout, fewer cards per screen.
- **Voice + icon forward:** mic and read-aloud become the default path; dense secondary panels (Quick Templates, sample output) collapse.
- **High-contrast palette:** swaps saffron accents for saffron-700-grade tokens automatically, disables glassmorphism/blur, forces solid backgrounds.
- **Reduced motion:** hard-off for ping/pulse/bounce.
- **Plain-language labels** and spoken hints on first tap.

This reuses tokens and the `force-light` class mechanism already in `globals.css` (a `.assist-mode` sibling), so it's a theming layer, not a rewrite. Respect OS signals as defaults: `prefers-reduced-motion`, `prefers-contrast`.

---

## 6. Quick wins vs big bets

**Quick wins (days):**
- Stop shipping saffron text on light and white-on-saffron labels; switch to saffron-700 / near-black. (Highest impact, pure token change.)
- Add `aria-live="polite"` around the dashboard status/answer zone; make error toasts `role="alert"`.
- Add `aria-label` to the ~28 icon-only buttons; add `alt` to generated images.
- Bump dashboard submit (40px) and close-X (24px) to 48px.
- Add a global `@media (prefers-reduced-motion: reduce)` block disabling ping/pulse/bounce.
- Strengthen focus ring to a non-saffron 2px outline + offset.

**Big bets (weeks):**
- Ship reusable `<ReadAloudButton>` across all generator results (round-trip voice).
- Build **Assist Mode** as an `.assist-mode` theming layer + profile toggle.
- Full SR audit of the generate→result flow on each tool (focus management, live regions, landmark roles).
- Automated a11y gate in CI (axe/Lighthouse) so contrast + label regressions can't merge — matches the "machine verifies" quality DNA.
