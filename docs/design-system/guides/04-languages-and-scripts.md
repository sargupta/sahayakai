# Languages and scripts

SahayakAI works in 11 languages. Every one of them is a first-class interface and output language, never a translation layer over English.

| Code | Native name | Script | Font family token |
| --- | --- | --- | --- |
| en | English | Latin | `--font-display`, `--font-ui` |
| hi | हिन्दी | Devanagari | `--font-devanagari` |
| mr | मराठी | Devanagari | `--font-devanagari` |
| bn | বাংলা | Bengali | `--font-bengali` |
| ta | தமிழ் | Tamil | `--font-tamil` |
| te | తెలుగు | Telugu | `--font-telugu` |
| kn | ಕನ್ನಡ | Kannada | `--font-kannada` |
| ml | മലയാളം | Malayalam | `--font-malayalam` |
| gu | ગુજરાતી | Gujarati | `--font-gujarati` |
| pa | ਪੰਜਾਬੀ | Gurmukhi | `--font-gurmukhi` |
| or | ଓଡ଼ିଆ | Odia | `--font-oriya` |

## Typography rules

- **Fallback chain.** `--font-display` and `--font-ui` fall back through the Noto Sans family of every Indian script, so a mixed line like "Script in हिन्दी" shapes correctly with no per-string work. Use the single-script families (`indic-*` styles) for long passages in one script.
- **Never uppercase or letter-space Indic text.** Tracking breaks conjuncts and matras, and case does not exist. Components detect Indic text and drop the uppercase and tracking automatically (`.sk-indic`).
- **Size floor.** Nothing is smaller than 12px in any script (decided 26 Oct 2026). Indic text also takes a 1.5 to 1.7 line height, so matras clear the line above.
- **Line height.** Reading text in Indic scripts uses a 1.7 line height (`indic-*` styles) so matras above and below the line never collide.
- **Never truncate Indic reading text.** Let it wrap. Truncation can cut a syllable in half. Single-line rows may ellipsize only Latin metadata.
- **Numerals.** Use the digits the teacher's school uses. Most use Western digits in print; follow the output language setting, never mix systems in one line.

## Language in the interface

- **Native script, always.** Language choices show the language's own script (`LanguagePicker`), with the English name as secondary text in the full list.
- **Set `lang`** on any element whose language differs from the page, so screen readers switch voices and fonts switch shaping.
- **Two settings.** The interface language and each output's language are separate settings. A teacher may use the app in English and generate a worksheet in ಕನ್ನಡ. Show the output language as an amber pill on every output.
- **Code-mixing is natural.** "इससे एक worksheet बना दो" is a valid request, and VIDYA's interpretations may mix scripts the same way. Don't "correct" a teacher's language choice.
- **Layout room.** Translations of short English labels can be 30–60% longer (Tamil and Malayalam especially). Buttons wrap to two lines rather than truncate, and chips wrap to a new row.
