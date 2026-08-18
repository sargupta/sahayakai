#!/usr/bin/env python3
"""SPIKE ONLY — delete with the spike.

Builds docs/flutter/spike/pdf_indic/comparison.png: for each of the eleven
sample lines, the Dart `pdf` package's rendering stacked directly above
Flutter's rendering of the identical string in the identical face.

Stacked, not side-by-side, on purpose. Side-by-side halves the type size and
asks the reader to saccade across 800px to compare two conjuncts; stacked puts
the same word 40px apart and the difference is unmissable.

Run from the package root, after both renders exist:
    dart run tool/spike/pdf_indic_spike.dart
    pdftoppm -png -r 144 -singlefile \
        docs/flutter/spike/pdf_indic/pdf_package_render.pdf \
        docs/flutter/spike/pdf_indic/pdf_package_render
    flutter test test/golden/pdf_indic_spike_render_test.dart \
        --tags golden --update-goldens
    python3 tool/spike/make_comparison.py
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SPIKE = "docs/flutter/spike/pdf_indic"
INTER = "assets/fonts/Inter-Variable.ttf"

INK = (17, 17, 17)
MUTED = (120, 120, 120)
BAD = (168, 32, 26)
GOOD = (23, 99, 58)
RULE = (222, 222, 222)


def text_bands(path):
    """Vertical runs of non-white pixels: one per line of type."""
    im = Image.open(path).convert("L")
    w, h = im.size
    px = im.load()
    runs, start = [], None
    for y in range(h):
        inked = any(px[x, y] < 200 for x in range(0, w, 4))
        if inked and start is None:
            start = y
        elif not inked and start is not None:
            if y - start > 6:
                runs.append([start, y])
            start = None
    # A matra hanging clear of its baseline (Bengali, Gurmukhi, Odia) shows up
    # as its own run and has to be folded back into the line above it.
    #
    # The threshold is 3px, not "a comfortable 12": in the PDF render the gap
    # between a 10pt label and the 22pt sample under it is as little as 4px,
    # because that render is unshaped and therefore unusually short. Anything
    # looser silently glues each label to its own sample and the pairing below
    # then finds two rows instead of eleven. Observed gaps — detached matra 1-2,
    # label-to-sample 4+.
    merged = [runs[0]]
    for a, b in runs[1:]:
        if a - merged[-1][1] <= 3:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return merged


def sample_rows(path):
    """The eleven (label_band, sample_band) pairs, past the page heading.

    A 10pt Inter label is never taller than ~21px and a 22pt Indic sample is
    never shorter than ~40px, so height alone separates them. The count is
    asserted rather than assumed: silently pairing ten rows would produce a
    comparison image that quietly omits a script.
    """
    bands = text_bands(path)[2:]  # drop title + subtitle
    pairs, i = [], 0
    while i < len(bands) - 1:
        label, sample = bands[i], bands[i + 1]
        if (label[1] - label[0]) < 30 <= (sample[1] - sample[0]):
            pairs.append((label, sample))
            i += 2
        else:
            i += 1
    if len(pairs) != 11:
        sys.exit(f"{path}: found {len(pairs)} sample rows, expected 11")
    return pairs


def main():
    if not os.path.isdir(SPIKE):
        sys.exit("run from the Flutter package root")

    samples = json.load(open(f"{SPIKE}/samples.json"))["samples"]
    pdf_img = Image.open(f"{SPIKE}/pdf_package_render.png").convert("RGB")
    flt_img = Image.open(f"{SPIKE}/flutter_reference_render.png").convert("RGB")
    pdf_rows = sample_rows(f"{SPIKE}/pdf_package_render.png")
    flt_rows = sample_rows(f"{SPIKE}/flutter_reference_render.png")

    h1 = ImageFont.truetype(INTER, 40)
    h2 = ImageFont.truetype(INTER, 26)
    small = ImageFont.truetype(INTER, 20)
    tag = ImageFont.truetype(INTER, 22)

    gutter, pad, width = 230, 40, 2000
    # Clamp to the source: PIL pads an out-of-bounds crop with black rather
    # than erroring, which paints a solid bar down the right of every row and
    # reads as if the renderer produced it.
    crop_x = 70
    crop_w = min(width - gutter - pad, pdf_img.width - crop_x,
                 flt_img.width - crop_x)

    blocks = []
    for idx, sample in enumerate(samples):
        broken = sample["code"] != "en"
        blocks.append(
            {
                "sample": sample,
                "broken": broken,
                "pdf": pdf_img.crop((crop_x, pdf_rows[idx][1][0] - 6,
                                     crop_x + crop_w, pdf_rows[idx][1][1] + 6)),
                "flt": flt_img.crop((crop_x, flt_rows[idx][1][0] - 6,
                                     crop_x + crop_w, flt_rows[idx][1][1] + 6)),
            }
        )

    head = 190
    block_h = [56 + b["pdf"].height + 16 + b["flt"].height + 46 for b in blocks]
    canvas = Image.new("RGB", (width, head + sum(block_h) + 40), "white")
    d = ImageDraw.Draw(canvas)

    d.text((pad, 40), "Dart pdf package vs Flutter — same string, same font file",
           font=h1, fill=INK)
    d.text((pad, 96),
           "Top row of each pair: PDF written by package:pdf. Bottom row: the "
           "same line rendered by Flutter (HarfBuzz).", font=small, fill=MUTED)
    d.text((pad, 126),
           "Both read docs/flutter/spike/pdf_indic/samples.json and embed the "
           "same assets/fonts/ TTF. Nothing was fetched.", font=small, fill=MUTED)

    y = head
    for block in blocks:
        s = block["sample"]
        d.line([(pad, y - 14), (width - pad, y - 14)], fill=RULE, width=2)
        d.text((pad, y), f"{s['code']}  {s['language']}  ({s['script']})",
               font=h2, fill=INK)
        verdict = "UNSHAPED" if block["broken"] else "correct"
        d.text((width - pad - 170, y + 4), verdict, font=tag,
               fill=BAD if block["broken"] else GOOD)
        y += 56
        d.text((pad, y + 8), "pdf", font=tag, fill=BAD)
        canvas.paste(block["pdf"], (gutter, y))
        y += block["pdf"].height + 16
        d.text((pad, y + 8), "flutter", font=tag, fill=GOOD)
        canvas.paste(block["flt"], (gutter, y))
        y += block["flt"].height + 46

    out = f"{SPIKE}/comparison.png"
    canvas.save(out)
    print(f"wrote {out} ({canvas.width}x{canvas.height})")


if __name__ == "__main__":
    main()
