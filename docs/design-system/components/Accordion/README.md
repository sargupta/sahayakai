One section of a generated output as a card that opens and closes: a heading button, then the region it controls.

**Use**
- `density="compact"` (default) for tool outputs: "Objectives · 3", "Materials needed", "Activities · 4", "Assessment". Give a closed section a `summary` line so the teacher sees what is inside.
- `items` for timed activities: each is a saffron-ruled entry, "The Mystery of Plant Food · 7 min", with its description. An item with `collapsed` starts as one line with a chevron and opens on tap.
- `density="comfortable"` for the lesson plan's timed sections: `time="05–18"` and `title="The four stages"`, a 14px body, and "Open" on a closed section.
- `current` marks the section VIDYA is reading back: a leaf edge and a leaf label. Pair it with `ReadbackBar`.
- Stack sections in a column with an 8 to 10px gap.

**The consumer provides** `title`, `count` or `time`, the body as `children` (a string becomes one paragraph) or `items`, and either `expanded` with `onToggle` or `defaultExpanded`. On non-English screens, translated `openLabel`, `minLabel` and `currentLabel`.

**States**
- Compact closed: `surface-glass-soft`, title and chevron, an optional one-line summary.
- Compact open: `surface-glass-chip` with `shadow-post`; the chevron turns up.
- Comfortable open: the label in `saffron-600`, the body in `text-strong`.
- Comfortable closed: the label in `text-body`, "Open" in `saffron-600`.
- Current: `surface-glass-strong`, a leaf edge at 35%, the label in `leaf-500`, and a hidden "now reading".

**Rules**
- The header is a real `<button>` inside a heading, with `aria-expanded` and `aria-controls`; the open region is a `region` labelled by it.
- The whole header row is the touch area (44px or more); the summary line toggles too.
- A closed Latin summary ends in an ellipsis; an Indic summary wraps and is never truncated.
- Colour never carries the state alone: open and closed differ in chevron, words and content.
