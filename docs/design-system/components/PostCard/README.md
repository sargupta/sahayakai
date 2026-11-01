A Community post: who posted, the kind of post, the words, a source line or shared file, and like, comment, translate and Connect.

**Use**
- One card per post in the Community feed, stacked 10px apart. `size="room"` in the Staff room: a 22px-round reading card with a 30px avatar, 14px text and 12px actions.
- `automated` for posts the app makes, such as the Daily Briefing: a saffron edge (`accent-tint-border`), a soft shadow (`shadow-post`) and a square saffron mark instead of a face. At most one, at the top of the feed.
- `type` tags the post: `resource` saffron, `tried` (Tried this) amber, `celebrate` leaf, `help` (Need help) indigo. Omit it for an untagged post.
- `onReadMore` adds an inline "Read more" after a cut post.
- `source` adds the board-aware source line under the post: the board, then what it is ("CBSE · Capacity building for Office Procedures"). With `href` or `onClick` it opens the circular.
- `attachment` shows a shared file (title, one line, Save).
- `onConnect` adds the Connect pill (`PersonAction`) on a post by a teacher the reader is not connected to; `connect="pending"` once sent.
- `onTranslate` adds Translate; set `translated` while the translation shows (the action then reads "Show original").

**The consumer provides**
- `author`, a `meta` line ("Maths · Class 7 · 11 hours ago"), and `body`.
- `initials` (or they are taken from `author`) and an `avatarTone`.
- `likes`, `liked` and `onLike`; `comments` and `onComments` (`commentsLabel="12 replies"` in the Staff room). Leave counts and actions out to show no footer.
- Translated `typeLabel`, `commentsLabel`, `likeLabel`, `likesLabel`, `readMoreLabel`, `translateLabel` and `connectLabel` on non-English screens.

**States**
- Not liked: an outline heart in `text-body`. Liked: a filled heart in `saffron-600`, `aria-pressed="true"`. At 0 the word shows ("0 likes"); otherwise only the count.
- Connect: an outline saffron pill; Pending: grey with a clock; Connected: a leaf tick.
- Attachment saved: a tick and "Saved" in `leaf-700`.

**Rules**
- Like, comments, Read more, Translate, the source line and Save are real buttons. They draw as 10-12px text; their touch areas extend to 44px. The like button's name is "Like, 38 likes"; Read more and Translate are described by the author's name.
- Grounding is board-aware: the source line names the board ("CBSE", "KSEEB") before the item. A CBSE circular stays CBSE.
- Latin tags are uppercased; Indic tags, names and posts are not, and render at 12px or more. Post text in Indic scripts takes a 1.7 line height.
- The avatar is decorative (the name is beside it). Draw initials on a 14% tint of their tone, never a stock photo.
- Sample posts are illustrative. Never present one as a real teacher's testimonial. Write sample posts without em dashes.
