The parent message as the parent will read it, in their own script, with a line naming the marks it cites.

**Use**
- `tone="inset"` inside the review sheet, before the teacher sends or calls: the milk card (#F7F4EF, `border-hairline`, `radius-card`, 15px padding) with 14px text.
- `tone="glass"` (default) on a screen wash, with `eyebrow="What they'll read"`: a 78% white card, 22px corners, 16px padding, 15px text and a soft card shadow.
- Add `citation` whenever the message quotes a number from the teacher's records: "Cites 16/50, the mark you entered. Nothing invented." It sits 12px under the card as a leaf note (9% leaf, `radius-row`, 12px/1.5 `leaf-700`).
- Pass `cite` with the exact cited phrase to mark it in the body ("৫০ এর মধ্যে ১৬"): a `leaf-tint` highlight with a 1.5px `leaf-500` underline, so the teacher sees which words carry the number.

**The consumer provides**
- The `salutation` and body (`children`) as VIDYA wrote them, in the parent's language, with `lang` ("bn", "mr", "hi").
- `citation` from the marks the teacher entered, never from the model's own wording.
- `label` naming the recipient when there is no eyebrow ("Message to Hiren's mother, in Bengali").

**Rules**
- The message reads in Noto Sans for its script at a 1.7 line height and is never truncated or clamped; a blank line follows the salutation.
- The card is a quotation (`figure` > `blockquote`, citation in `figcaption`), not an editor. Regenerate or Edit change it; the preview never does.
- Every number in the message must come from the student's record. If VIDYA cannot cite one, the message says so in words instead of giving a figure.
- Names and marks stay on the phone until the teacher taps send or call; say so on the screen that sends it.
