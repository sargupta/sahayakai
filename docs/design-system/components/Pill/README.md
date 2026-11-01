A small status tag on a tinted ground. It tells and is never pressed.

**Tones carry meaning, the same meaning everywhere:**

| Tone | Meaning |
| --- | --- |
| `leaf` | done, on, class facts ("Mic on", "Class 7") |
| `indigo` | curriculum and board ("CBSE · NCERT Ch 8", "ICSE", "Karnataka State Board (KSEEB)") and need-help |
| `amber` | language and tried-this |
| `saffron` | VIDYA, pending, preview |
| `red` | absent, alert |
| `solid-leaf` | a live state at a screen's top-right ("34 present", "On call · 1:12") |
| `glass` | the language switch on a screen header |
| `camera` | counts on the scanner ("12 / 34") |

**The consumer provides** one to three words, translated, and `lang` for text in another script.

**Rules**
- A pill is not a button. A tappable filter is a `Chip`.
- Status is always a word, never colour alone.
- At most four pills in a row, joined by meaning: class, length, board and book, language. At the phone's 360px width those four fit on one line under an output title; anything longer wraps, never truncates.
- Text sits at 12px/600 in every script, so matras survive.
