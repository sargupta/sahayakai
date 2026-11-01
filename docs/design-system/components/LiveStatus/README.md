The VIDYA Live status pill: the state in words and in its tone, with the conversation's language after a middle dot.

**Use** at the end of the `LiveHeader` on the phone, and through `VidyaPresence` on the web (`size="web"`). One per screen.

**States**
| State | Tone | Words (defaults, or specific) |
|---|---|---|
| `resting` | glass, `saffron-600` | "Tap to talk" |
| `connecting` | `indigo-500` on an indigo tint | "Connecting" |
| `listening` | `saffron-600` on `accent-tint` | "Listening · हिन्दी" |
| `working` | solid `indigo-500`, white, `shadow-pill-working` | "Checking CBSE source" |
| `speaking` | solid `leaf-500`, white, `shadow-pill-speaking` | "Speaking · हिन्दी" |
| `paused` | `leaf-700` on `success-tint` | "Paused" |
| `failed` | solid `red-500`, white, `shadow-pill-failed` | "Couldn’t hear" |
| `offline` | `text-body` on `fill-quiet` | "No signal · typing works" |

**The consumer provides** `state`, a specific `label` where one helps (name the board while grounding: "Checking CBSE source", "Checking KSEEB source"), and `language` with `languageLang` while listening or speaking.

**Rules**
- It is `role="status"` with `aria-live="polite"`: keep the element mounted across states so each change is announced once. Never put a button inside it; End sits beside it.
- Every state has a word; the tone never carries meaning alone. Tints sit on solid card white, so contrast holds on any wash (listening, the lowest, is 4.7:1).
- The language name is never uppercased, renders at 12px (14px on the web) and gets `lang`, which raises the pill to its Indic line height.
- Sentence case, no exclamation marks, no trailing ellipsis.
