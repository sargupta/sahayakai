# Accessibility and quality gates

SahayakAI is used on mid-range phones, in bright classrooms, by teachers of every age, in 11 languages. Accessibility here is the product working at all, not a compliance layer.

## The floor (every component meets it)

- **Text contrast** 4.5:1 on the grounds its token note names, measured on composited glass over the wash:
  - `ink-900` 15:1+
  - `ink-600` 6.2:1+
  - `ink-500` 4.7:1+
  - `saffron-600` 4.7:1+ (4.4 on leaf tints, so it is never placed there)
  - `saffron-700` 5.6:1+
  - `leaf-700` 8.2:1+
  - `indigo-500` 8.1:1+
  - `red-500` 4.5:1+ on cards and glass
- **Focus.** A 2px `saffron-600` outline offset 2px, at 4.9:1 or better on every ground and `on-camera` on the scanner. It is never a shadow, survives forced-colors mode, and is never removed. Composite controls (Field, Composer) show a 2px `saffron-500` edge on the whole control instead.
- **Touch.** 44 × 44 minimum. Where v3 draws smaller (42px tabs, 40px mic, 34px field mic, 36px chips, compact prompt buttons), the visual stays exact and `.sk-hit` extends the touch area.
- **Semantics.**
  - Real buttons, links and inputs. Labels are tied with `for`/`id`, and errors with `aria-describedby` and `aria-invalid`.
  - `aria-current="page"` on the active tab; switches use `role="switch"`, segments `radiogroup`.
  - Sheets are dialogs that take focus and close on Escape.
  - Progress and results are announced through polite live regions.
- **Colour is never alone.** Every status has a word, a number or a glyph. The rubric's four levels are numbered badges. Outcome segments differ in lightness and pattern, not hue.
- **Motion.** `prefers-reduced-motion` stops every float, pulse, breathe and shimmer, and the state stays visible.
- **Scripts.** `lang` on mixed-language text. Indic text is never uppercased, tracked or truncated, and gets a 1.7 line height in reading text.

## Decided and applied

Two items this guide used to flag were decided 26 Oct 2026, and every component now follows them:
- **White text on saffron.** It sits on `accent-fill` (`saffron-600`, 5.28:1), never on `saffron-500` (3.77:1). `saffron-500` stays for the orb, dots, bars, icon-only discs and focus edges, where 3:1 is the bar.
- **Small text.** Nothing is smaller than 12px, in any script. The apps follow the phone's and the browser's own text-size settings, so a teacher who enlarges text on her phone gets it here too.

## Flagged: kept exact to the design

| Item | Today | Measured | Recommended fix |
| --- | --- | --- | --- |
| `text-faint` (`ink-400`) on the website | 13px footer links, 12px card eyebrows | 3.2–3.9:1 | Use `ink-500` (4.7:1+) |
| Glass card and Composer resting edges | Luminous `border-glass`, `border-strong` | 1.1–1.3:1 against the wash | Fields are identified by label and fill, and their focused edge meets 3:1; for a high-contrast mode, add `border-row` edges |
| Pending checklist step (`stone-500`) | 12px | 3.1–3.8:1 | Paired with the word "not started" for screen readers; use `ink-500` if it must be read |

## Gates before anything ships

1. **Tokens only.** No raw hex, Tailwind palette classes or ad-hoc shadows in product code; the repo's adopt-on-touch law applies.
2. **Render check** at 360px and 1280px, with no horizontal scroll and no clipped text.
3. **Contrast check** for every new text/ground pair, on the composited ground.
4. **Keyboard pass:** focus visible on every control, logical order, Escape closes sheets.
5. **TalkBack or VoiceOver pass:** every control is named, states are announced.
6. **Script pass:** the screen in हिन्दी, தமிழ் and മലയാളം at 130% font scale.
7. **Reduced-motion pass.**
8. **Content pass:** board, textbook and chapter verified against the curriculum data; no invented numbers or people.
