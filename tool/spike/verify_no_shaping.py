#!/usr/bin/env python3
"""SPIKE ONLY — delete with the spike.

Proves, without looking at a single pixel, that package:pdf applies no complex
text shaping.

Reading a render and saying "those conjuncts look wrong" is an opinion about a
picture. This reads the PDF's own content stream instead and compares the glyph
sequence package:pdf emitted against the raw codepoint sequence it was given:

  * If the shaper had run, a conjunct such as क्ष (3 codepoints) or a Tamil
    ligature such as க்கு (3 codepoints) would collapse to ONE glyph, and the
    counts would diverge. They do not, anywhere.
  * If reordering had run, a pre-base matra would move ahead of its base, so
    the same codepoint would land at different positions than its logical
    index. Instead each codepoint maps to one fixed glyph id, every time, in
    memory order.

Together those two checks say: codepoint -> cmap -> glyph, left to right. That
is what a Latin-only renderer does, and it is not how any Indic script works.

Run from the package root, after the PDF exists:
    dart run tool/spike/pdf_indic_spike.dart
    python3 tool/spike/verify_no_shaping.py
"""

import json
import re
import sys
import zlib

SPIKE = "docs/flutter/spike/pdf_indic"


def content_stream(path):
    """Every inflated stream in the PDF that draws text, concatenated."""
    raw = open(path, "rb").read()
    out = []
    for m in re.finditer(rb"stream\r?\n", raw):
        start = m.end()
        end = raw.find(b"endstream", start)
        try:
            out.append(zlib.decompress(raw[start:end]))
        except zlib.error:
            pass  # not a Flate stream (fonts, metadata) — irrelevant here
    return b"\n".join(s for s in out if b"TJ" in s).decode("latin-1")


def main():
    samples = json.load(open(f"{SPIKE}/samples.json"))["samples"]
    content = content_stream(f"{SPIKE}/pdf_package_render.pdf")

    # The sample lines are the only text set at 22pt; package:pdf emits one
    # show-text operator per whitespace-delimited word, with 2-hex-digit-pair
    # glyph ids under an Identity-H encoding.
    runs = [
        [m.group(1)[i:i + 4] for i in range(0, len(m.group(1)), 4)]
        for m in re.finditer(
            r"/F\d+ 22 Tf 0 Tc [\d.]+ [\d.]+ Td \[<([0-9a-fA-F]+)>\]TJ", content
        )
    ]

    expected = sum(len(s["text"].split(" ")) for s in samples)
    if len(runs) != expected:
        sys.exit(f"parsed {len(runs)} words from the PDF, expected {expected}")

    substitutions = 0
    inconsistencies = 0
    seen = {}
    i = 0
    for sample in samples:
        for word in sample["text"].split(" "):
            glyphs = runs[i]
            i += 1
            if len(glyphs) != len(word):
                substitutions += 1
                print(f"  SUBSTITUTION {sample['code']} {word}: "
                      f"{len(word)} codepoints -> {len(glyphs)} glyphs")
            for codepoint, glyph in zip(word, glyphs):
                key = (sample["font"], codepoint)
                if seen.get(key, glyph) != glyph:
                    inconsistencies += 1
                    print(f"  REORDER/VARIANT {sample['code']} "
                          f"U+{ord(codepoint):04X}: {seen[key]} vs {glyph}")
                seen[key] = glyph

    print(f"words checked            : {expected}")
    print(f"glyph substitutions      : {substitutions}   "
          f"(any ligature, half-form, reph or chillu would appear here)")
    print(f"position-dependent glyphs: {inconsistencies}   "
          f"(any reordering or contextual form would appear here)")
    print()
    if substitutions == 0 and inconsistencies == 0:
        print("VERDICT: package:pdf performed a flat cmap lookup in memory "
              "order. No GSUB, no reordering, no shaping of any kind.")
    else:
        print("VERDICT: some shaping was applied — re-read the numbers above.")


if __name__ == "__main__":
    main()
