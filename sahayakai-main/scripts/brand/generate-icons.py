#!/usr/bin/env python3
"""
Regenerate every SahayakAI icon from one source mark.

WHY THIS EXISTS

On 2026-09-11 the founder noticed the browser-tab icon and the in-page header
logo were two different logos. They were:

  - src/app/favicon.ico was committed in the 2026-01-15 squash and never
    touched again. public/icons/* were rebranded on 2026-04-11 in da9d51713.
    Nothing tied the two together, so the favicon silently kept the old mark
    for five months.
  - public/icons/icon-192x192.png carried the wordmark "SahayakAI" baked into
    the artwork, and both landing-nav.tsx and logo.tsx render it immediately
    beside the text "SahayakAI". At 32px the baked wordmark is unreadable and
    the name appears twice.
  - icon-192x192.png was actually 1024x1024, as were icon-512x512 and both
    maskable icons - four copies of the same oversized file, while the
    manifest declared them as 192 and 512.

Every icon is now derived from assets/brand/sahayakai-mark-source.png by this
script, so they cannot drift apart again. Regenerate with:

    python3 scripts/brand/generate-icons.py

scripts/ci/check-icon-consistency.mjs is the gate: it re-derives the icons and
fails if any committed file differs, if a filename disagrees with its own pixel
dimensions, or if the favicon stops matching the mark.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/brand/sahayakai-mark-source.png"
ICONS = ROOT / "public/icons"
FAVICON = ROOT / "src/app/favicon.ico"

TILE_BG = (255, 255, 255, 255)


def mark(size: int, pad_ratio: float) -> Image.Image:
    """The bare mark, trimmed and centred on a transparent square."""
    im = Image.open(SRC).convert("RGBA")
    im = im.crop(im.split()[3].getbbox())          # trim the source's uneven margins
    inner = max(1, round(size * (1 - 2 * pad_ratio)))
    scale = min(inner / im.width, inner / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return canvas


def tile(size: int, pad_ratio: float, radius_ratio: float | None) -> Image.Image:
    """The mark on an opaque white tile, optionally rounded."""
    # Supersample so the rounded corner stays clean at 48px.
    ss = 4
    big = size * ss
    bg = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    plate = Image.new("RGBA", (big, big), TILE_BG)
    if radius_ratio is None:
        bg = plate
    else:
        m = Image.new("L", (big, big), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, big - 1, big - 1], radius=round(big * radius_ratio), fill=255)
        bg.paste(plate, (0, 0), m)
    art = mark(big, pad_ratio)
    bg.alpha_composite(art)
    return bg.resize((size, size), Image.LANCZOS)


def save(im: Image.Image, path: Path) -> None:
    """
    Write a palette PNG. The mark is a handful of orange tones, so 256 indexed
    colours are visually identical to full RGBA at roughly a seventh of the
    bytes (mark.png: 153KB -> 21KB). Alpha survives quantisation, which matters
    because the header logo sits on a translucent nav.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    # An icon with no transparent pixel is flattened to RGB before quantising, so
    # it carries no tRNS chunk at all. Quantising RGBA leaves a tRNS table covering
    # unused palette indices, which makes the file *claim* transparency it never
    # uses — enough to fail an honest byte-level check and, more importantly, to
    # leave a launcher guessing. Opaque means opaque, in the bytes.
    flat = im if im.split()[3].getextrema()[0] < 255 else im.convert("RGB")
    flat.quantize(colors=256, method=Image.FASTOCTREE).save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  {im.width}x{im.height}  {path.stat().st_size // 1024}KB")


def main() -> None:
    # Square, NOT rounded. A `purpose: "any"` icon is composited by the launcher
    # onto its own backing plate, so transparent corners produce a rounded square
    # sitting inside a second launcher-drawn square — a visible double frame on
    # Android. The platform applies the corner radius; we must not bake one in.
    # (The pre-2026-09 icons were opaque JPEGs and so never hit this.)
    print("any-purpose icons (opaque square tile; the launcher rounds it):")
    for s in (48, 72, 96, 144, 192, 512):
        save(tile(s, 0.17, None), ICONS / f"icon-{s}x{s}.png")

    print("apple-touch (square; iOS applies its own mask):")
    save(tile(180, 0.17, None), ICONS / "apple-touch-icon.png")

    # Maskable icons are cropped to a circle by the launcher, so the mark has
    # to sit inside the middle 80% or Android clips the book's corners.
    print("maskable (content inside the 80% safe zone):")
    for s in (192, 512):
        save(tile(s, 0.28, None), ICONS / "maskable-{}x{}.png".format(s, s))

    print("in-page mark (transparent, used by the header logo):")
    save(mark(512, 0.02), ICONS / "mark.png")

    # Multi-resolution .ico so the tab, bookmarks bar and Windows shortcuts
    # each get a size rendered for them instead of a browser downscale.
    print("favicon.ico (16/32/48, transparent):")
    frames = [mark(s, 0.02) for s in (16, 32, 48)]
    frames[-1].save(FAVICON, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"  {FAVICON.relative_to(ROOT)}  16+32+48")

    write_lock()


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_lock() -> None:
    """
    Record the source hash and every derived file's hash.

    The CI gate reads this instead of re-running Pillow, so it can prove the
    committed icons all came from the current source mark without needing a
    Python toolchain on the runner.
    """
    outputs = sorted(ICONS.glob("*.png")) + [FAVICON]
    lock = {
        "source": str(SRC.relative_to(ROOT)),
        "sourceSha256": sha(SRC),
        "generator": "scripts/brand/generate-icons.py",
        "files": {str(p.relative_to(ROOT)): sha(p) for p in outputs},
    }
    path = ROOT / "public/icons/icons.lock.json"
    path.write_text(json.dumps(lock, indent=2) + "\n")
    print(f"  {path.relative_to(ROOT)}  {len(lock['files'])} files locked")


if __name__ == "__main__":
    main()
