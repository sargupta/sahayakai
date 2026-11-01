Who needs a call today, by reason: worded sections of tinted name tags under "Needs outreach today · 20".

**Use** on the register, right under the class tabs, once attendance and marks are in. It answers "who should I call?" before the teacher opens the outreach list. One card per class.

**The consumer provides** `title` and `count`, then `sections`, each with a `tone`, a worded `label`, a `count` and the `items` to name (most urgent first). An item is a `name` plus `facts` drawn with middle dots: `{ name: 'Omkar', facts: ['6 days', 'Malayalam'] }`. Optionally an `action` (a small `Button` that opens the list) and translated `moreText`.

**Tones**
- `red`: consecutive absences. `red-700` label and text on `red-tint`.
- `amber`: at risk academically. `saffron-700` on `accent-tint-strong`.
- `leaf`: something to celebrate. `leaf-700` on `success-tint`.

**Rules**
- The words carry the reason ("Consecutive absences · 6", "6 days", "28%"); the tint only repeats it.
- Name three students per section; that fits two lines on a phone. When the section's `count` is larger, a neutral "+3 more" tag ends the list.
- The card is a `section` named by its `h2` eyebrow; each reason is an `h3` with a list of tags. Screen readers hear "Omkar, 6 days, Malayalam": the middle dots are hidden and replaced by commas.
- Tags are status, not buttons. The class header's Outreach button and the Students view open the list.
- Tags are 12px/500 with 6px corners; in Indic scripts they and the labels render at 12px and are never uppercased or tracked.
- Names are first names only; facts come from the register and the mark book, never from VIDYA.
