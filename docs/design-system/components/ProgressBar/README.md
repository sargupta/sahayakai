How far along something is: a pill track tinted by its tone and filled in that tone, with an optional label and value.

**Use** for work with a known end: VIDYA writing a lesson, sheets scanned, items saved for offline. Tone is meaning:
- `indigo` (default) while VIDYA is working, on a track of 12% indigo.
- `leaf` for progress toward done ("34 of 38 marked"), on `success-tint`.
- `saffron` for pending work waiting to send, on `accent-tint-strong`.

`size="md"` (10px) under a working sheet's steps; `size="sm"` (6px) inside rows and cards.

**The consumer provides** `value` (with `min` and `max` when it counts things), a `label` naming what progresses (always, even when it is not drawn) and, for counts, `valueText` ("12 of 34"). Set `showLabel` to draw the label and the value above the track at 12px.

**Rules**
- A `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext` when given. It is named by its drawn label, or by `aria-label`.
- The fill eases over .4s on the standard curve and jumps under reduced motion. Never animate it to fake progress.
- Pair the bar with words that say what is happening ("Writing board work in हिन्दी"). The bar never stands alone as status.
- Do not use it when the end is unknown. VIDYA's working orb and its step list carry that.
