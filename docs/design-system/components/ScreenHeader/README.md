The title block at the top of a screen: an h1 in Bricolage, a subline, an optional status pill and back disc.

**Use**
- `level="screen"` (26/700, may run two lines) for Home, with `greeting` above it: avatar, today's date, the teacher's name and the language pill.
- `level="page"` (22/700, default) for tools and lists: "Make a lesson", "Class 7 · roll call".
- `level="output"` (20/700, line 1.22) for what VIDYA made or a live call: "Working with Fractions", "Dhruv’s father".
- `trailing` holds one live status `Pill` (`solid-leaf`, `md`): "34 present", "On call · 1:12". Use `align="end"` to sit it on the subline.
- `onBack` only on deep screens reached from inside a flow. Top-level destinations are reached from the tab bar and never show a back disc.

**The consumer provides** `title`, `subtitle`, the `level`, and translated text. For Home, `greeting` with `name`, `date`, `language` and `onLanguage` to open the `LanguagePicker`.

**Rules**
- The title is the page's only `<h1>`. Subtitles are facts joined by ` · `, in `text-body`, 11px at the font's normal line height (12px under a screen title); with `align="end"` the subline sits 3px under the title so the pill's foot lines up with it.
- At the phone's 360px width a long title wraps to a second line; it is never truncated. A trailing pill keeps its width and the title takes the rest.
- Indic titles are never uppercased and get a 1.4 line height; Indic sublines render at 12px with a 1.7 line height.
- The back disc is 38px glass (`border-glass`), its touch area 46px, named "Back" (translated with `backLabel`).
- The language pill is `glass`; as a button its touch area reaches 44px and its name says the language and that tapping changes it.
- On the scanner (`.sk-camera`) the title turns `on-camera` and the subline `on-camera-muted`.
