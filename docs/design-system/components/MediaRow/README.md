A piece of media VIDYA recommends: a glyph tile, a title that names the platform in words, and one line of meta.

**Use** under an answer or output for a video, audio clip or reading VIDYA suggests. Pass `eyebrow` ("Recommended video") to give it its own soft glass card; leave it out to place rows inside a card you already have.

**The consumer provides** `title` naming the platform in words ("Watch on YouTube"), `meta` saying what it is and for whom ("Photosynthesis for Class 6"), `kind` (video, audio, document), and `href` (external by default) or `onClick`.

**Anatomy:** a 34px tile, radius 10 (`radius-option`), on `accent-tint-strong` with a 15px `saffron-600` glyph (a filled play for video). The title is 600 12px; the meta is 400 12px `text-body`, one line. With `eyebrow`, the card is `GlassCard` soft, radius 16, padding 13px 14px, with a muted tight `Eyebrow` 9px above the row.

**Rules**
- No platform logos or brand colours: the platform is named in words, and the tile is saffron because VIDYA recommends it.
- The whole row is one link or button. It draws 34px tall; its touch area extends to 44px.
- External links open in a new tab and say so to assistive tech (", opens in a new tab").
- Indic titles and meta wrap at 12px instead of truncating.
