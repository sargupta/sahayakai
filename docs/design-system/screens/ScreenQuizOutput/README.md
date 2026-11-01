Quiz output: difficulty in one control, lettered questions, the answer key on a toggle, feedback beside the orb.

Built from the following:
- the output title (`ScreenHeader`, `output`) and fact `Pill`s, the book named with its board ("CBSE · Curiosity 6, Ch 8");
- a `SegmentedControl` for Easy · Medium · Hard;
- an `ActionBar` that leads with the "Answer key" toggle, then Edit · Regenerate · Download · Share;
- `QuizQuestion`s: a lettered 2×2 grid and a short answer with its answer area, both collapsible;
- a `FeedbackRow` aligned to the start, beside the orb parked right;
- Deliver as the one primary action, Share to Community beside it, and the `TabBar` on Library.
