Add a photo or file: a dashed saffron dropzone, or a compact optional row, with required, error and filled states.

**Use**
- `variant="zone"` (default) when the tool needs the file to work: the worksheet's textbook page, a stack of answer sheets. Set `required`; the label reads "Textbook page · Required".
- `variant="row"` when the file only adds context: "Add a context image · Optional · Browse" in a composer.

**The consumer provides** `label`, `onFile(file)`, and once a file is in, `file` (`name`, `meta`, optional `thumb`) plus `onRemove`. Give `error` to show the blocked state, and `hint`, `accept` or `capture` as needed. Override `prompt`, `requiredLabel`, `optionalLabel`, `actionLabel`, `replaceLabel` and `removeLabel` to translate.

**States**
- Empty: 1.5px dashed `accent-outline` on `accent-tint-soft`, the 26px upload glyph and "Take a photo or browse" in `saffron-600`. A file dragged over turns the edge solid `saffron-500`.
- Required and missing: the label, edge, glyph and prompt turn `red-700` on a pale red ground, and the message says what to do ("Add a photo of the textbook page to continue.") with `role="alert"`; the input is `aria-invalid`.
- Filled: a strong-glass row with the thumbnail (or a drawn page), the file name, one line of meta, Replace and Remove.
- Disabled: 55% opacity.

**Rules**
- A real file input covers the zone invisibly: tap opens the camera or files, keyboard focus outlines the zone, and a dropped file lands in it. Replace reopens the same input.
- The error shows only while no file is in. Pair it with a disabled primary action whose reason is visible nearby.
- Prompt 12px/600; message 12px/500; Indic text takes 12px and wraps instead of truncating.
- The glyph is the system upload glyph, never a text arrow. Remove is a 32px button with a 44px touch area.
