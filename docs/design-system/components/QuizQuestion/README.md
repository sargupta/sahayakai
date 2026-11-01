One quiz or exam question as a tile: its header, the question, and options as the answer key or as radio buttons.

**Use**
- `mode="review"` (default) on the quiz VIDYA made: the teacher sees the answer key, the correct option tinted leaf with a check. Pass `reveal={false}` for the student's view of the same quiz (the "Answer key" toggle in `ActionBar` drives it).
- `mode="answer"` wherever someone picks an answer (a student on a shared phone, a teacher trying the quiz). Options become radio buttons; a short answer becomes a box to write in.
- `layout="grid"` for four options: a 2×2 grid lettered A–D. `layout="list"` (default) for two or three. 
- `type="short"` with `answerArea` for a short answer: a dashed "Student answer area" in review, a text box in answer mode. In review, `answer` shows the model answer instead.
- `collapsible` folds a quiz question to its header with a chevron ("Question 1 · multiple choice").
- `variant="exam"` on an exam paper: the header reads "Q31" with its `marks` ("3 marks") or an indigo `pyq` tag ("Past paper · 1 mark"); options sit inline as (a)–(d); `or` adds an internal-choice alternative after a saffron "OR"; `scheme` adds the marking-scheme line.
- Stack questions in a column with an 8 to 9px gap. Let the last one take the remaining height with `style={{ flex: 1 }}` when the screen has a fixed footer.

**The consumer provides**
- `question`, and `number` for the default eyebrow ("Question 1 · multiple choice") or exam label ("Q1"), or a translated `eyebrow` or `label`.
- `options` as strings or `{ label, correct }` objects, or `correct` as an index.
- In answer mode, `selected` with `onSelect` (controlled) or `defaultSelected`; for short answers, `answerValue` with `onAnswerChange`.
- Translated `correctLabel`, `answerLabel`, `orLabel`, `collapseLabel` and `expandLabel` on non-English screens.

**States**
- Review, correct: `leaf-tint` fill, a leaf edge (1.5px in the grid), `leaf-700` text, a check glyph and the visually hidden word "correct". In the grid the letter badge fills `leaf-500`.
- Review, other options: `fill-subtle` (list), `surface-card` with a `border-row` edge (grid), a 5% ink chip (inline).
- Answer, chosen: `accent-tint` fill with an `accent-tint-border` edge; the ring (list) or letter (grid) fills `accent-fill`.
- Answer, focused: a 2px `saffron-600` outline around the whole option.
- Folded: the header alone; the chevron points down and the button says "Show question 1".

**Rules**
- The correct answer is never shown by colour alone: it carries the check glyph and the word. Never a text tick.
- Answer options are real `<input type="radio">` in one named group, labelled by the question, at least `target-min` (44px) tall. Letters are read before each option ("C. Evaporation").
- The fold control is a button with `aria-expanded`; its touch area reaches 44px.
- The eyebrow is 12px, tracked .1em and uppercased in `text-eyebrow`; Indic eyebrows are not uppercased or tracked and render at 12px. Indic options render at 12px and Indic questions take a 1.7 line height.
- Exam marks and tags name the board's pattern; never invent a past-paper year.
