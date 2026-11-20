#!/usr/bin/env python3
"""
Synthetic Assessment Scanner fixtures — no real student data.

Every page carries:
  * a machine-readable PAGE MARKER: a band of 10 cells across the top of the page
    (start cell always dark, 8 data cells = page number in binary MSB-first, end
    cell always light). Positions are relative to the page, so the marker survives
    any render scale and JPEG compression; `decodePageMarker` in the verification
    harness reads it back from the rendered image.
  * human-readable text "SYNTHETIC ASSESSMENT - PAGE N of M" plus three short
    question/answer lines, so a real OCR run also shows which page is which.

Usage:  python3 make-synthetic-pdfs.py OUT_DIR
Writes: text-{1,3,4,5,10,11,20}p.pdf, scanned-{4,10}p.pdf, mixed-6p.pdf,
        empty-0p.pdf, zero-bytes.pdf, corrupt.pdf, encrypted-4p.pdf (password
        "synthetic"), scanned-heavy-20p.pdf (large: for the size limit),
        not-a-pdf.pdf (text bytes with a .pdf name), notes.txt (unsupported type),
        oversize-60mb.pdf (a valid 4-page PDF padded past the 50 MB PDF limit).
"""
import io
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pypdf import PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

MARKER_CELLS = 10
MARKER_Y0, MARKER_Y1 = 0.03, 0.07  # fraction of page height (from top)
MARKER_X0, MARKER_CELL_W = 0.06, 0.088  # fraction of page width


def marker_bits(page_no: int) -> list[int]:
    return [1] + [(page_no >> (7 - i)) & 1 for i in range(8)] + [0]


def question_lines(page_no: int) -> list[str]:
    return [
        f"Q{page_no}.1  What is {page_no} + {page_no}?   Answer: {page_no * 2}",
        f"Q{page_no}.2  Name a primary colour.   Answer: blue",
        f"Q{page_no}.3  Write the word SYNTH{page_no:02d}.   Answer: SYNTH{page_no:02d}",
    ]


def draw_text_page(c: canvas.Canvas, page_no: int, total: int) -> None:
    w, h = A4
    for i, bit in enumerate(marker_bits(page_no)):
        x = (MARKER_X0 + i * MARKER_CELL_W) * w
        y = h - MARKER_Y1 * h
        c.setFillGray(0.0 if bit else 0.92)
        c.rect(x, y, MARKER_CELL_W * w * 0.9, (MARKER_Y1 - MARKER_Y0) * h, stroke=0, fill=1)
    c.setFillGray(0)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(60, h - 0.13 * h, f"SYNTHETIC ASSESSMENT - PAGE {page_no} of {total}")
    c.setFont("Helvetica", 14)
    for j, line in enumerate(question_lines(page_no)):
        c.drawString(60, h - 0.20 * h - j * 30, line)


def scanned_page_image(page_no: int, total: int, heavy: bool = False) -> Image.Image:
    """A phone-scan look: off-white paper, noise, slight blur — then JPEG'd into the PDF."""
    W, H = (2480, 3508)  # A4 @ 300 dpi
    img = Image.new("RGB", (W, H), (236, 230, 214))
    d = ImageDraw.Draw(img)
    for i, bit in enumerate(marker_bits(page_no)):
        x0 = int((MARKER_X0 + i * MARKER_CELL_W) * W)
        y0 = int(MARKER_Y0 * H)
        x1 = x0 + int(MARKER_CELL_W * W * 0.9)
        y1 = int(MARKER_Y1 * H)
        d.rectangle([x0, y0, x1, y1], fill=(25, 25, 30) if bit else (225, 222, 210))
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 64)
        small = ImageFont.truetype("DejaVuSans.ttf", 48)
    except OSError:
        font = small = ImageFont.load_default()
    d.text((180, int(0.11 * H)), f"SYNTHETIC ASSESSMENT - PAGE {page_no} of {total}", fill=(20, 20, 60), font=font)
    for j, line in enumerate(question_lines(page_no)):
        d.text((180, int(0.19 * H) + j * 110), line, fill=(30, 30, 90), font=small)
    rnd = random.Random(page_no)
    # Ruled lines + scribbles to look like an answer sheet.
    for k in range(40):
        y = int(0.32 * H) + k * 70
        d.line([(150, y), (W - 150, y)], fill=(180, 190, 215), width=3)
    for _ in range(60 if heavy else 25):
        x, y = rnd.randint(200, W - 400), rnd.randint(int(0.33 * H), H - 200)
        d.line([(x, y), (x + rnd.randint(50, 350), y + rnd.randint(-20, 20))], fill=(35, 35, 110), width=5)
    noise = Image.effect_noise((W, H), 28 if heavy else 14).convert("L")
    img = Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.18 if heavy else 0.10)
    return img.filter(ImageFilter.GaussianBlur(0.6))


def write_text_pdf(path: str, pages: int) -> None:
    c = canvas.Canvas(path, pagesize=A4)
    for p in range(1, pages + 1):
        draw_text_page(c, p, pages)
        c.showPage()
    c.save()


def write_scanned_pdf(path: str, pages: int, heavy: bool = False, mixed: bool = False) -> None:
    c = canvas.Canvas(path, pagesize=A4)
    w, h = A4
    for p in range(1, pages + 1):
        if mixed and p % 2 == 1:
            draw_text_page(c, p, pages)
        else:
            buf = io.BytesIO()
            scanned_page_image(p, pages, heavy).save(buf, "JPEG", quality=92 if heavy else 80)
            buf.seek(0)
            c.drawImage(ImageReader(buf), 0, 0, width=w, height=h)
        c.showPage()
    c.save()


def main(out: str) -> None:
    os.makedirs(out, exist_ok=True)
    for n in (1, 3, 4, 5, 10, 11, 20):
        write_text_pdf(os.path.join(out, f"text-{n}p.pdf"), n)
    write_scanned_pdf(os.path.join(out, "scanned-4p.pdf"), 4)
    write_scanned_pdf(os.path.join(out, "scanned-10p.pdf"), 10)
    write_scanned_pdf(os.path.join(out, "scanned-heavy-20p.pdf"), 20, heavy=True)
    write_scanned_pdf(os.path.join(out, "mixed-6p.pdf"), 6, mixed=True)

    w = PdfWriter()
    with open(os.path.join(out, "empty-0p.pdf"), "wb") as f:
        w.write(f)
    open(os.path.join(out, "zero-bytes.pdf"), "wb").close()
    with open(os.path.join(out, "text-4p.pdf"), "rb") as f:
        data = f.read()
    with open(os.path.join(out, "corrupt.pdf"), "wb") as f:
        f.write(data[: len(data) // 3])
    with open(os.path.join(out, "oversize-60mb.pdf"), "wb") as f:
        f.write(data)
        f.write(b"\n%" + b"0" * (60 * 1024 * 1024))
    with open(os.path.join(out, "not-a-pdf.pdf"), "w") as f:
        f.write("This is plain text with a .pdf name.\n")
    with open(os.path.join(out, "notes.txt"), "w") as f:
        f.write("Unsupported file type for the scanner.\n")
    subprocess.run(
        ["qpdf", "--encrypt", "synthetic", "synthetic", "256", "--",
         os.path.join(out, "text-4p.pdf"), os.path.join(out, "encrypted-4p.pdf")],
        check=True,
    )


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "synthetic-pdfs")
