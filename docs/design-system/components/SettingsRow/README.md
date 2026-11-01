A setting on one line: its label and current value, with a text action, a status word or a control at the end.

**Use** in a `GlassCard` (padding 13px 14px, gap 8) whose title is an `h3` with the class `sk-settingsrow-title` ("Settings", 12px/600), and whose rows sit in a `<ul class="sk-settingsrow-list">` with `as="li"`.
- `action` + `onAction` when changing it opens a picker or sheet ("Change", "24 items").
- `status` when the row only reports a state here ("On"); `statusTone="off"` for an off state.
- `control` for a direct toggle (a `Switch`). Without a name of its own, the control is labelled by the row's label.

**The consumer provides** `label` with the current value joined by a middle dot ("Language · हिन्दी", "Board · CBSE"), and one of `action` + `onAction` (or `href`), `status`, or `control`.

**Rules**
- Label 12px/500 `text-body` (6.2:1 on glass); action 12px/600 `saffron-600`; status `leaf-700` for on, `text-body` for off. The status is a word, never a colour alone.
- The action's accessible name reads label then action ("Language · हिन्दी Change").
- Actions draw at text size; their touch area extends to 44px tall and at least 44px wide.
- One trailing element per row. Labels wrap in long languages; never truncate them.
