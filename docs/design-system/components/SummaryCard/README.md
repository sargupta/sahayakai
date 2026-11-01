One block of the call summary VIDYA writes back: what happened, what the parent said and agreed, what to do next.

**Use** stacked 9px apart, in this order, on the screen after a call:
- `done` (pass `headingAs="h1"`): "Call completed" with "2 min · 5 exchanges · parent was concerned". A 26px `leaf-500` disc with the check glyph on a 90% leaf row, `leaf-700` text.
- `neutral`: "Parent response", one or two sentences, on 84% white with `shadow-post`.
- `amber`: "Concerns raised", in `saffron-750` on a 92% amber row.
- `indigo`: "Parent commitments" as `items`, each with the check glyph, in #1E2A66 on a 7% indigo ground with `info-tint-border`.
- `action`: "Your action items" as `items` with the arrow glyph, on 90% white with a 1.5px `saffron-500` edge: the one block that asks something of the teacher.
- `red`: "Follow-up recommended", with when ("Call in 14 days, after the re-test"), in `red-700` on `red-row`.
- `link`: "Conversation transcript" with "5 messages" and a chevron, opening the full transcript.

**The consumer provides** `title`, then `children` (a sentence) or `items` (short lines), `meta` on done and link, and `onClick` or `href` on link.

**Layout:** `radius-tile`, 12px 14px padding (done 13px 14px, red 11px 14px); a 12px uppercase heading tracked .12em; 12px/1.6 text 4px below, items 12px/1.55 and 4px apart.

**Rules**
- Each block's heading names it in words; the tone only repeats the meaning. Every text pair holds 4.5:1.
- Commitments are what the parent said they would do, in their words; action items are the teacher's, written as verbs.
- The link row is a real button or link at least `target-min` tall.
- Glyphs, never text symbols: check for commitments, arrow for actions, chevron for the link.
