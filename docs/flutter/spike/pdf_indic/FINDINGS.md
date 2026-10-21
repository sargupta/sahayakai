# Spike: can the Dart `pdf` package render India's scripts?

**Date:** 2026-08-18
**Status:** spike complete, artefacts produced, decision open
**Recommendation:** do not ship PDF export on `package:pdf`. Ten of the eleven
supported locales render wrongly, and the failures change what words say.

Look at **`comparison.png`** before reading anything below. Each script appears
twice: the PDF on top, Flutter's rendering of the identical string in the
identical font file underneath.

---

## 1. What was actually run

| Artefact | What it is |
|---|---|
| `samples.json` | The eleven sample lines. **Both** renderers read this file, so neither holds its own copy of the strings. |
| `pdf_package_render.pdf` | Written by `package:pdf` 3.12.0 via `tool/spike/pdf_indic_spike.dart`. |
| `pdf_package_render.png` | The above, rasterised at 144 dpi with `pdftoppm`. |
| `flutter_reference_render.png` | The same lines rendered by Flutter (HarfBuzz), via `test/golden/pdf_indic_spike_render_test.dart`. |
| `comparison.png` | The two, stacked per script. **This is the artefact to look at.** |

Both renderers embed the same `assets/fonts/NotoSans*-Variable.ttf` files that
ship in the APK. Nothing was fetched. The only variable between the top and
bottom row of each pair is the text engine.

Reproduce:

```bash
dart run tool/spike/pdf_indic_spike.dart
pdftoppm -png -r 144 -singlefile \
  docs/flutter/spike/pdf_indic/pdf_package_render.pdf \
  docs/flutter/spike/pdf_indic/pdf_package_render
flutter test test/golden/pdf_indic_spike_render_test.dart --tags golden --update-goldens
python3 tool/spike/make_comparison.py
python3 tool/spike/verify_no_shaping.py
```

---

## 2. The headline result

**Nothing rendered as boxes.** Every glyph in every script drew. That was the
expected failure and it is not what happened: the bundled Noto faces load fine
and `package:pdf` parsed all ten variable TTFs without complaint.

**The text is wrong anyway, and wrong in a worse way than boxes.** A box is
obviously broken; a teacher would not send it home. These pages look like
plausible Hindi until you read them, and then the vowels are attached to the
wrong consonants.

The cause, stated exactly: `package:pdf` performs a flat `cmap` lookup —
codepoint to glyph, left to right, in memory order. It runs no GSUB, no
reordering, no mark positioning.

That is not inferred from the picture. `tool/spike/verify_no_shaping.py` reads
the PDF's own content stream and compares the glyph ids emitted against the
codepoints supplied:

```
words checked            : 57
glyph substitutions      : 0   (any ligature, half-form, reph or chillu would appear here)
position-dependent glyphs: 0   (any reordering or contextual form would appear here)

VERDICT: package:pdf performed a flat cmap lookup in memory order.
         No GSUB, no reordering, no shaping of any kind.
```

Every word emitted exactly as many glyphs as it had codepoints. If a single
conjunct had formed, `क्ष` (3 codepoints) would have collapsed to 1 glyph and
that counter would be non-zero. It is zero across all 57 words in all 11 lines.

---

## 3. Per-script verdict

`correct` / `incorrect` / `boxes` as requested. There are no boxes.

| Locale | Script | PDF verdict | What specifically goes wrong |
|---|---|---|---|
| en | Latin | **correct** | Identical to Flutter. The harness works; this is the control. |
| hi | Devanagari | **incorrect** | i-matra never reorders: `कठिन` draws as `कठ` + `ि` + `न`, so the vowel reads as belonging to `न`. `शिक्षक` becomes `शक्षिक`. No conjuncts: `क्ष`, `द्य`, `प्र`, `श्न` all draw with a visible halant. `र्थ` draws ra + halant instead of a reph above. |
| mr | Devanagari | **incorrect** | Same as hi. The three-deep stack `र्थ्यां` in `विद्यार्थ्यांची` flattens into five separate marks in a row. |
| bn | Bengali | **incorrect** | `শি`, `বি`, `ণি` draw the i-matra after the consonant instead of before it. The `ক্ষ` ligature does not form. `শ্রে` loses both the ra-phala and the pre-base `ে`. |
| ta | Tamil | **incorrect** | The split vowel `ொ` in `கொடுத்தார்` draws both halves *after* `க` instead of straddling it. Pre-base `ே` in `கேள்வி` stays after `க`. The `க்கு` / `த்தா` ligatures do not form, so `களுக்குக்` renders as something closer to `களௗக்கௗக்`. |
| te | Telugu | **incorrect** | No below-base consonants. `ధ్యా`, `ద్యా`, `ప్ర`, `శ్న`, `చ్చా` all draw the second consonant full-size and inline with a visible virama, instead of shrunk and hung underneath. |
| kn | Kannada | **incorrect** | Same failure as te. `ಕ್ಷ` does not ligate; `ದ್ಯಾ` / `ಪ್ರ` / `ಶ್ನೆ` lose their below-base forms; `ರ್ಥಿ` loses its repha. |
| ml | Malayalam | **incorrect** | Split vowels `ചോ` and `ളോ` draw both halves after the consonant. The stacked conjuncts `ത്ഥ`, `ധ്യ`, `ദ്യ`, `ച്ചു` all flatten. (The chillu letters `ൻ` and `ർ` survive — they are pre-composed codepoints, so they need no shaping.) |
| gu | Gujarati | **incorrect** | i-matra never reorders in `શિ` / `વિ`. `ક્ષ`, `દ્યા`, `પ્ર`, `શ્ન` do not form; `ર્થી` loses its reph. |
| pa | Gurmukhi | **incorrect** | The closest of the ten, because Gurmukhi has few conjuncts — but still wrong where it matters. Every sihari misplaces: `ਅਧਿਆਪਕ` draws `ਅ ਧ ਿ ਆ`, hanging the vowel on `ਆ` rather than `ਧ`. Same in `ਵਿਦਿਆਰਥੀਆਂ` and `ਪੁੱਛਿਆ`. |
| or | Odia | **incorrect** | Worst-looking of the set. `ଶିକ୍ଷକ` spreads into six detached marks; `ଙ୍କୁ` in `ବିଦ୍ୟାର୍ଥୀମାନଙ୍କୁ` loses its fused below-base form; `ପ୍ର` and `ଶ୍ନ` break apart. |

Flutter's rendering (bottom row of every pair) is correct in all eleven. This
is expected — Flutter shapes through HarfBuzz — but it is worth stating that it
was verified rather than assumed, because it is what makes the top row's
failures attributable to the PDF writer and not to the fonts or the strings.

---

## 4. Why this is worse than boxes, in one example

`कठिन` means *difficult*.

* Correct: **क** **ठि** **न** — the `ि` belongs to `ठ`.
* This PDF: **क** **ठ** **ि** **न** — the `ि` now sits against `न`.

A teacher scanning a worksheet does not see a rendering bug. They see a word
that is misspelled, on a document with the school's name on it, that they
handed to thirty children. `[][][][]` would at least have told them not to
print it. The same applies to `ਅਧਿਆਪਕ` (*teacher*) in Punjabi and every
i-matra word in Bengali, Gujarati and Odia.

---

## 5. Recommendation

**Do not ship PDF export on `package:pdf`.** Not for Indic locales, and
therefore not at all: an export button that is correct only in English, in a
product whose entire premise is the other ten languages, is not a feature.

There is no configuration fix. The package has no shaping engine to enable —
this is an architectural gap, not a missing flag.

If PDF export is wanted, the routes that could actually work, cheapest first:

1. **Render to an image, then wrap the image in a PDF.** Flutter already shapes
   correctly, as the bottom rows prove. Capture the composed worksheet with
   `RenderRepaintBoundary.toImage` and embed the PNG as a full-page image via
   `package:pdf`. Loses selectable text and inflates file size; keeps the
   dependency already in this spike. Smallest change, and correct in all eleven
   scripts by construction.
2. **`package:printing`'s `Printing.convertHtml`.** Hands off to the platform
   WebView, which shapes properly. Adds a real dependency and a platform
   surface, and the output depends on the device's WebView.
3. **Server-side.** The web app already renders these scripts; generate the PDF
   there and download it. Correct by construction, costs a round trip, and the
   teacher this product is for is often offline.

Route 1 is the only one that keeps the offline promise. It is worth a follow-up
spike if the founder wants export at all.

---

## 6. Scope of the change this spike leaves behind

Nothing here is wired into the app. There is **no PDF export button on any
screen**, and nothing under `lib/` imports `pdf`.

* `pubspec.yaml` — `pdf: ^3.11.1` added under **`dev_dependencies`**, in a
  labelled SPIKE ONLY block. Dev-only is sufficient because `pdf` is pure Dart,
  so the spike runs under `dart run` and the package never enters an app build.
  Resolution was clean: four new transitive packages (`pdf`, `barcode`, `bidi`,
  `qr`), no version change to anything already locked.
* `tool/spike/` — three scripts (PDF generator, no-shaping proof, comparison
  image builder).
* `test/golden/pdf_indic_spike_render_test.dart` — the Flutter control render,
  tagged `golden` so the normal `flutter test --exclude-tags golden` ladder
  skips it.
* `docs/flutter/spike/pdf_indic/` — this file and the artefacts.

One `git revert` removes all of it.
