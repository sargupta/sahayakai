How a class's marks spread after a scan: one bar per band, red for the lowest band through leaf for the highest.

**Use**
- Scan results, between the summary `StatTile`s and the mistake pattern.
- Five bands for a test out of 25 ("0–4" … "20–25"); up to ten for short quizzes. `showCounts` prints each count above its bar.

**The consumer provides** `bands` (lowest first: `label`, `count`, optional `tone`), the `caption` that names the test and the scale ("…, 34 sheets marked out of 25"), and translated `title`, `unit`, `rangeLabel`.

**Rules**
- The counts add up to the sheets marked (unreadable sheets are not in the chart), and the summary stats must agree with them: "7 below 5" is the 0–4 bar.
- Colour repeats the range, never replaces it: every bar has its range label underneath.
- The bars are hidden from assistive tech; a visually hidden table carries the same numbers.
- Bars 62px tall, 5px apart, radius 4px on top; labels 12px `text-body`. Bar colours: `red-500`, `amber-500`, `saffron-500`, `leaf-500`.
