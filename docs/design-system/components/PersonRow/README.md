A teacher you may know, or a group you may join: initials, name, one line of context and one action pill.

**Use**
- People you may know, connection requests and suggested groups in Community. Stack rows 6px apart under a muted `Eyebrow` ("People you may know").
- `action="connect"` for a teacher you are not connected to. Make the one best suggestion `emphasis="solid"` and the rest `outline`.
- `action="join"` with `avatar={false}` for a suggested group ("9 Mathematics · CBSE", "8 Science · KSEEB"). Again, at most one solid.
- `action="accept"` for an incoming request: the small leaf pill.
- `pending`, `connected` and `joined` are the quiet after-states: a grey pill with a clock ("Pending"), or a leaf tick with the word ("Connected", "Joined").
- `PersonAction` is the pill on its own. `PostCard` (Connect on a post) and `MessageRow` (Accept) use it.

**The consumer provides**
- `name`, a `meta` line (subject · class · how you know them, or "4 members"), `initials` if the defaults are wrong, and an `avatarTone`.
- `action`, `emphasis` and `onAction`. Move the row from `connect` to `pending` when the request is sent, and from `join` to `joined`.
- Translated `actionLabel` and `actionA11yLabel` on non-English screens.

**States**
- Connect, Join: solid `saffron-600` with white text, or a `accent-outline` hairline with `saffron-600` text.
- Accept: solid `leaf-500` with white text.
- Pending: `fill-quiet` ground, `text-body` text and a clock. Connected and Joined: `leaf-700` text and a tick.

**Rules**
- The pill is one `<button>` through every state, so focus stays on it when Connect turns to Pending. Pending, Connected and Joined are `aria-disabled` unless they do something (such as withdraw).
- Its accessible name always names the person or group: "Connect with Rakesh Singh", "Join 9 Mathematics · CBSE", "Accept request from Suresh Reddy". A translated `actionA11yLabel` must contain the visible word.
- The pill draws 24px tall; its touch area extends to 44px.
- White text sits on `saffron-600` (5.4:1), never on `saffron-500`: the label is only 12px.
- Messaging opens only after a request is accepted. Never put a Message action on a row that is not `connected`.
- Every person in samples is illustrative.
