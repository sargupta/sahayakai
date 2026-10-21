# SPEC — Pillar 04 Staffroom + Pillar 05 Pro Inbox (Premium Flutter)

**Status:** DRAFT for the autonomous build loop · **Design system:** reuses
`docs/flutter/design/PREMIUM_DESIGN_SPEC.md` (Ledger · Ivory & Ink). Every widget
named here (`AppCard`, `DocumentSheet`, `EditorialSectionHeader`, `IconWell`,
`AppSegmented`, `ScoreRing`, `EmptyView`, `PressableScale`, `AppSkeleton`,
`AppBadge`, `LibraryItemRow`, `SecondaryButton`, `PrimaryButton`, the ivory-ink
tokens, Fraunces+Inter, `AppMotion`) already exists in
`lib/shared/widgets/` + `lib/core/theme/` and must be reused, not reinvented.

> Scope of this file: the two "network" pillars — **Staffroom** (the structured
> teacher network: groups, posts, connections, activity/persona-pulse) and the
> **Pro Inbox** (structured professional messaging: conversations, messages,
> notifications). Voice-first Home, VIDYA, and the Parent Hotline are other specs.

---

## 0. THE ONE ARCHITECTURAL DECISION THAT GATES EVERYTHING (read first)

The web implements both pillars with **two transports that the current Flutter
app cannot speak**:

1. **Next.js server actions** (`"use server"` in `src/app/actions/{community,
   connections,groups,messages,notifications}.ts`). These are RPC over an
   internal protocol, **not** REST — they are invoked by the React bundle via the
   Next server-action wire format. There is **no** `/api/...` route for send-message,
   connect, join-group, like, mark-read, etc. The only REST routes that exist for
   these pillars are `POST /api/community/persona-pulse`, `POST /api/teacher-activity`,
   `POST /api/feedback`.
2. **Direct client Firestore `onSnapshot` listeners + one RTDB `onValue`** for the
   *realtime* surfaces (inbox list, message thread, staff-room chat, notification
   badge, presence). The React client holds a Firebase Web SDK session and reads
   Firestore directly under `firestore.rules`.

The Flutter app (`pubspec.yaml`) has **Dio + Riverpod and ZERO Firebase
packages**. Its repositories hit `https://sahayakai.com/api/ai/*` with
`Authorization: Bearer <Firebase ID token>`; middleware verifies the token and
injects `x-user-id`. It has no `cloud_firestore`, no `firebase_database`, no
`firebase_messaging`, no `firebase_auth`.

**Therefore the build loop MUST resolve a transport split before any screen is
built.** Recommended (matches the web's realtime soul and the brief's "flag what
is realtime + Firebase-gated"):

| Concern | Transport in Flutter | Why |
|---|---|---|
| **Reads that must be live** (inbox list, thread messages, staff-room chat, unread badges, presence) | **Add `firebase_core` + `cloud_firestore` + `firebase_database` and mirror the web's `onSnapshot`/`onValue` listeners** as Riverpod `StreamProvider`s | These are `onSnapshot`-driven on web; polling a REST wrapper would feel dead and 10× the reads. `firestore.rules` already authorizes the exact same queries per-participant. |
| **Every write + every server-derived read** (send message, get-or-create conversation, connect/accept/decline, join/leave group, create/like post, mark-read, recommendations, directory, unified feed, notifications list) | **New thin REST routes** `POST/GET /api/community/*`, `/api/messages/*`, `/api/connections/*`, `/api/notifications/*` that each call the existing server-action body, OR call the server action's extracted core. Flutter reaches them via the existing `ApiClient` (Dio+Bearer) | Server actions can't be invoked from Dio. The *logic* (auth, validation, transactions, rate-limits, PII-stripping) is already written in the action files and must be reused verbatim by the route handler — do not reimplement authz in Flutter. |

`firebase_messaging` (FCM) is additionally needed if push parity with the web is
wanted (`sendPushToUser` fires on every message). That is **Firebase-gated** and
handoff-walled behind `google-services.json` / APNs keys — treat as a later unit.

**Backend work is OUT OF SCOPE for this repo (READ-ONLY on backend).** This spec
*names* the routes/shapes the build loop must request from the backend team (or a
sibling task) and designs the Flutter side against them. Where a route does not
yet exist, the Flutter repository is written against the documented shape and
guarded behind a feature flag so the screen degrades to an `EmptyView`/`ErrorView`
until the route ships.

Everything below is **Firebase-gated** end-to-end: with no Firebase project wired
into the Flutter app, both pillars render their `EmptyView` "coming soon" state.
Gate them behind `kStaffroomEnabled` / `kProInboxEnabled` compile flags.

---

# PART A — PILLAR 04: STAFFROOM (the structured teacher network)

## A1. What it is (feature summary)

The Staffroom is SahayakAI's professional teacher network. It is **not** a generic
social feed — it is structured around four backbones:

1. **Groups** (`src/types/community.ts::Group`) — auto-created and auto-joined by
   the server from the teacher's own profile. `ensureUserGroupsAction` provisions,
   on first `/community` visit, up to four kinds keyed off the user doc:
   - a **subject_grade** group, a **school** group, a **region/state** group, a
     **daily-briefing** group, and a global **community** group.
   Each is `groups/{id}` with a `members` sub-collection (`{uid}: {joinedAt, role}`),
   a `posts` sub-collection, a `chat` sub-collection, `memberCount`, `type`,
   `coverColor` (a CSS gradient string), `autoJoinRules`, `lastActivityAt`.
   Membership is also denormalized onto `users/{uid}.groupIds`.
2. **Posts** (`GroupPost`) — inside a group, `postType ∈ {share, ask_help,
   celebrate, resource}` (the four `SHARE_TEMPLATES`), `content` (≤2000 chars),
   `attachments[]` (≤5), `likesCount`, `commentsCount`, optional `translations`
   map (multilingual). Likes are an idempotent `posts/{id}/likes/{uid}` doc +
   transactional counter. Every like doc carries `uid` so one
   `collectionGroup('likes').where('uid','==',me)` hydrates all filled hearts.
3. **Connections** (the professional graph). TWO parallel graphs exist:
   - **Follow** graph (`connections/{followerId}_{followingId}`, directed) via
     `followTeacherAction` — a lightweight one-way follow.
   - **Connection request** graph (`connection_requests/{sortedPair}` →
     `connections/{sortedPair}` with `uids:[a,b]`) via
     `sendConnectionRequestAction`/`accept`/`decline`/`disconnect` — a mutual,
     accepted connection with a 30-day request expiry. **This mutual connection is
     the gate that unlocks the Pro Inbox DM** and email visibility.
   *(Both live in the `connections` collection but with different doc shapes — the
   follow graph uses `{followerId,followingId}` docs, the mutual graph uses
   `{uids,initiatedBy,connectedAt}` docs. The Flutter models must keep them
   distinct.)*
4. **Activity / discovery** — `getRecommendedTeachersAction` ("People You May
   Know", multi-tier scored by same-school/district/subject/grade + impact,
   60s server cache), `getAllTeachersAction` (the searchable directory, PII-
   stripped to a public allowlist, rate-limited), and the **persona-pulse**: a
   demo-only `POST /api/community/persona-pulse` that writes an AI teacher message
   to `community_chat` every 3–5 min so the Staff Room feels alive (flag
   `communityPersonas`, returns 503 to stop polling).

The **Staff Room chat** itself (`community_chat` collection, one global room, live
via `onSnapshot(limitToLast(100))`) and the **Unified Feed** (`getUnifiedFeedAction`
merges recent group posts + resource shares + connection suggestions into a
`FeedItem[]` with cursor pagination) are the two aggregate surfaces.

**Realtime map (Staffroom):**
- `community_chat` staff-room messages → **Firestore `onSnapshot`** (live).
- Groups-sidebar "latest staff-room message" preview → `onSnapshot(limit 1)` (live).
- Unified feed → **NOT realtime**; assembled from Firestore queries server-side,
  refreshed on focus + every 45 s (poll). Optimistic insert on own post.
- Recommendations / directory / connection data → one-shot server reads.

## A2. Exact backend surface (Staffroom)

Server actions in `src/app/actions/`. Flutter must reach the write/derived-read
ones through REST wrappers (see §0). Auth is `x-user-id` from the verified Bearer
token; the client never supplies identity.

**`groups.ts`**
| Action | Signature → return | Notes |
|---|---|---|
| `ensureUserGroupsAction()` | `→ string[]` (groupIds) | Idempotent provisioning. Call once on Staffroom first-open. |
| `getMyGroupsAction()` | `→ Group[]` | Reads `users/{uid}.groupIds`, fetches group docs. |
| `getGroupAction(groupId)` | `→ Group | null` | |
| `joinGroupAction(groupId)` | `→ {joined:boolean}` | Writes member doc + `memberCount++` + `users.groupIds`. |
| `leaveGroupAction(groupId)` | `→ void` | |
| `getGroupPostsAction(groupId, limit=20, startAfter?)` | `→ GroupPost[]` | **Member-gated** (throws Forbidden if not a member). Cursor = last postId. |
| `createGroupPostAction(groupId, content, postType, attachments=[])` | `→ string` (postId) | Rate-limited; member-gated; content ≤2000; ≤5 attachments. |
| `likeGroupPostAction(groupId, postId)` | `→ {isLiked, newCount}` | Transactional toggle. |
| `sendGroupChatMessageAction(groupId, text, audioUrl?)` | `→ string` (msgId) | Member-gated; text ≤500; audioUrl must be Firebase Storage https. |
| `getUnifiedFeedAction(limit=20, startAfterTimestamp?)` | `→ FeedItem[]` | Merged feed; empty if no groups. |
| `discoverGroupsAction()` | `→ Group[]` | Suggested (not-yet-joined) groups. |

**`community.ts`**
| Action | Signature → return | Notes |
|---|---|---|
| `getRecommendedTeachersAction(userId?)` | `→ TeacherSuggestion[]` | Ignores param, uses session uid; 60s cache; max 5. |
| `getAllTeachersAction(currentUserId?)` | `→ TeacherSuggestion[]` | Directory; PII-stripped; rate-limited. |
| `getProfilesAction(uids[])` | `→ public-profile[]` | Allowlist strip (no email/phone/tokens). |
| `followTeacherAction(followingId)` | `→ void` | Directed follow toggle. |
| `getFollowingIdsAction()` / `getFollowingPosts()` | `→ string[]` / posts | |
| `getLibraryResources(filters)` | `→ resource[]` | Shared-resources feed (Staffroom "Shared Resources"). |
| `likeResourceAction(id)` / `saveResourceToLibraryAction(res)` / `trackDownloadAction(id)` | engagement | Also cross-links to Library pillar. |
| `getLikedItemIdsAction()` | `→ {groupPostIds[], resourceIds[]}` | Hydrate filled hearts on mount. |
| `sendChatMessageAction(text, audioUrl?)` | `→ void` | Writes to global `community_chat`; triggers AI reactive reply. |

**`connections.ts`**
| Action | Signature → return |
|---|---|
| `sendConnectionRequestAction(toUid)` | `→ {status:'sent'|'already_connected'|'already_pending'}` |
| `acceptConnectionRequestAction(requestId)` | `→ void` (recipient only) |
| `declineConnectionRequestAction(requestId)` | `→ void` (either party) |
| `disconnectAction(otherUid)` | `→ void` |
| `getMyConnectionDataAction()` | `→ {connectedUids[], sentRequestUids[], receivedRequests:[{uid,requestId}]}` |

**REST routes that already exist (call directly via `ApiClient`):**
- `POST /api/community/persona-pulse` → `{message, personaName, personaState,
  personaSubject}` (503 when flag off — treat as stop). Body `{recentMessages?,
  personaId?, mode?}`. **Demo infra only.**
- `POST /api/teacher-activity` → `{success}` — analytics event batch (allowlisted
  keys). Use for Staffroom engagement analytics.
- `POST /api/feedback` → `{success}`.

**Firestore collections (client-listen, realtime):**
- `community_chat` — global Staff Room. `onSnapshot(orderBy createdAt asc,
  limitToLast(100))`. Doc: `{text, authorId, authorName, authorPhotoURL,
  audioUrl?, createdAt, isDemoPersona?}`.
- `groups/{id}/chat` — per-group chat (same shape). Web reuses the
  `CommunityChat` component with `collectionPath` override.

## A3. Premium Flutter treatment (Staffroom)

New feature module: `lib/features/staffroom/`. Screens compose the Ledger system;
the register is "the faculty room of a heritage school."

### A3.1 Staffroom Home — `staffroom_screen.dart`
A scroll of editorial registers, not a card grid:

- **Page hero (the Almanac register).** Reuse the dashboard hero grammar: saffron
  `eyebrow` = `STAFFROOM · {school or district}`, Fraunces `displayMedium`
  greeting ("The Staffroom"), a `lead` deck ("Teachers across Bharat, in one
  room"), a 2px×48dp saffron rule. No centered stack.
- **Two entry tiles** (mirrors web's Staff-Room + Find-Teachers tiles) as **one
  feature `AppCard(elevated)` + one flat `AppCard`**, each with a 48dp `IconWell`
  (Lucide `MessagesSquare` for Staff Room chat, `UserSearch` for Find Teachers),
  `titleLarge` + `bodyMedium` muted + circular chevron. The feature tile carries
  the 3px saffron `accentBar`.
- **`EditorialSectionHeader("YOUR GROUPS")`** → horizontal `AppCard(flat)` chips
  (one per `Group`, `coverColor` gradient mapped to an `IconWell` tint spine),
  tap → Group Detail. `EmptyView` (halo `Users` glyph, "Join your first group",
  `SecondaryButton "Browse groups"`) when `myGroups` empty — reuse the web's
  cold-start copy.
- **`EditorialSectionHeader("FROM YOUR GROUPS")`** → the Unified Feed as a column
  of `AppCard`s (see A3.4). Pull-to-refresh + 45s focus refresh replicate the web
  poll (feed is **not** realtime). Cursor "load more" via a `SecondaryButton`
  footer.
- **`EditorialSectionHeader("PEOPLE YOU MAY KNOW")`** → `TeacherSuggestion` rows
  (avatar `IconWell`/photo, name `titleMedium`, `recommendationReason` as an
  `overline`/`AppBadge`, `SecondaryButton "Connect"`). Connect calls
  `sendConnectionRequestAction`; branch the toast on the returned `status`
  (sent / already_pending / already_connected) exactly like the web handler.
- **`EditorialSectionHeader("SHARED RESOURCES")`** → reuse `LibraryItemRow` for
  `getLibraryResources` items with like/save affordances.

Entrance: `AnimatedEntrance.staggeredItem` (cap 8), ink-settle. Mobile FAB (bottom-
left to avoid the mic orb) = `Plus` → create-post sheet.

### A3.2 Staff Room chat — `staff_room_chat_screen.dart` (REALTIME, Firebase-gated)
The one-room global chat. This is a **`StreamProvider`** over
`FirebaseFirestore.instance.collection('community_chat').orderBy('createdAt')
.limitToLast(100).snapshots()`.

- Messages as **document-style blocks**, NOT chat bubbles (per the Ledger soul):
  each message is an `AppCard(inset)` — avatar `IconWell` + author `titleSmall` +
  saffron `overline` timestamp on the masthead line, `AiText` body (Indic matra-
  safe, line-height 1.7). AI persona messages get a small pine `AppBadge("AI
  teacher")` (map `isDemoPersona`). Own messages right-align the masthead, keep the
  block form.
- Composer: `LabeledField` (filled, 500-char cap mirrored client-side) + a
  `PrimaryButton` send (glow). Optional voice attach (reuse `lib/shared/media`).
- Send → REST wrapper of `sendChatMessageAction`; optimistic append; the
  `onSnapshot` reconciles.
- Persona pulse: a Riverpod timer (3–5 min jitter) POSTs `/api/community/persona-
  pulse` **only while the screen is mounted and visible**; a 503 permanently
  disarms the timer for the session (web parity). Gate behind
  `kDemoPersonasEnabled`.

### A3.3 Group Detail — `group_detail_screen.dart`
Header = group `coverColor` gradient wash (respect the §2.4 "barely-there"
gradient ban — use it as a thin `IconWell`/masthead tint, not a full bleed),
Fraunces group name, `dataMedium` member count, join/leave `PrimaryButton`/
`SecondaryButton` (member-gated posts: non-members see a locked `EmptyView`
preview, matching `getGroupPostsAction`'s Forbidden).
- Segmented `AppSegmented[Posts · Chat]`.
- **Posts tab**: `getGroupPostsAction` list, each post an `AppCard(flat)`:
  `postType` → saffron `overline` label + Lucide glyph (`Lightbulb` share,
  `HelpCircle` ask_help, `Trophy` celebrate, `FileUp` resource), author line,
  `AiText` content, like row (`Heart`, `likesCount` `dataMedium`, filled from
  `getLikedItemIdsAction`). Optimistic like via `likeGroupPostAction` with
  server-count reconcile + rollback (copy the web's exact optimistic pattern).
- **Chat tab**: same realtime `StreamProvider` as A3.2 but `collectionPath =
  groups/{id}/chat`; send via `sendGroupChatMessageAction`.
- Create post = `DocumentSheet`-style bottom sheet with an `AppSegmented`
  template picker (the four `SHARE_TEMPLATES`, with their prompt/placeholder copy),
  `LabeledField`, attachments.

### A3.4 Unified-feed card grammar
`FeedItem` is polymorphic (`group_post | resource_share | connection_suggestion |
chat_highlight | group_suggestion`). One `AppCard` per item, switch on `type`:
- `group_post` → post card (as A3.3) + group name `overline`.
- `resource_share` → `LibraryItemRow` variant + like.
- `connection_suggestion` → teacher row + Connect.
- `group_suggestion` → group chip + Join.
- `chat_highlight` → staff-room teaser → opens A3.2.

### A3.5 Teacher Directory + Profile — `teacher_directory_screen.dart`, `teacher_profile_screen.dart`
- Directory: `getAllTeachersAction` list, search field (`LabeledField` +
  `Search` glyph), `TeacherSuggestion` rows, connection-state chip driven by
  `getMyConnectionDataAction` (`none/pending_sent/pending_received/connected` →
  `AppBadge` + action). ≥48dp rows.
- Profile: `getPublicProfileAction(uid)` (PII-safe; **email only if mutually
  connected**). Masthead = Fraunces name + `overline` school/subjects, bio in
  `AiText`, connect/message actions. The **Message** button is disabled with a
  hint unless `connectedUids.contains(uid)` — this is the gate into Pillar 05.

---

# PART B — PILLAR 05: PRO INBOX (structured professional messaging)

## B1. What it is (feature summary)

The Pro Inbox is 1:1 and small-group **professional** messaging between *connected*
teachers — structured and searchable, not a firehose. Three collections:

1. **`conversations`** (`src/types/messages.ts::Conversation`). `type ∈
   {direct, group}`. Direct convo id is **deterministic**:
   `buildDirectConversationId(a,b) = [a,b].sort().join('_')` — so a DM is
   idempotent. Each doc denormalizes: `participantIds[]` (drives
   `array-contains` queries), `participants{uid:{displayName,photoURL,
   preferredLanguage}}`, an **inbox preview** (`lastMessage`, `lastMessageAt`,
   `lastMessageSenderId`), and **per-participant `unreadCount{uid:n}}`**. Group
   convos add `name`, `createdBy` (2–50 members).
2. **`conversations/{id}/messages`** (`Message`). `type ∈ {text, resource,
   audio}`. `text` ≤1000 chars. **`resource`** carries a `SharedResource` card
   (a lesson-plan/quiz/worksheet/etc shared into the thread with a `route` to
   re-open it in its tool — this is the Inbox↔Prep-desk bridge). **`audio`**
   carries `audioUrl` (Firebase Storage only) + `audioDuration` (0–600s). Read
   receipts via `readBy[]`; delivery via `deliveredTo[]`; `clientMessageId` makes
   sends idempotent (transactional dedup).
3. **`notifications`** (`src/types/index.ts::Notification`). Typed:
   `MESSAGE, FOLLOW, LIKE, RESOURCE_SAVED, CONNECT_REQUEST, CONNECT_ACCEPTED,
   NEW_GROUP_POST, GROUP_POST_LIKE, …`. `MESSAGE` notifs stamp
   `metadata.conversationId` + `link=/messages?open={id}` so opening/reading a
   thread clears both the conversation `unreadCount` **and** the Bell badge.

**The DM gate:** the Inbox empty state literally says "Connect with teachers in the
Community to start messaging" — a DM is only reachable once a **mutual connection**
exists (Pillar 04). Deep links: `/messages?with={uid}` (get-or-create DM) and
`/messages?open={conversationId}`.

**Realtime map (Pro Inbox) — all Firestore `onSnapshot`, Firebase-gated:**
- **Inbox list** → `onSnapshot(conversations where participantIds array-contains
  me orderBy lastMessageAt desc)` (live; missing-index/permission errors surface an
  error state, don't hang).
- **Thread messages** → `usePaginatedMessages`: a live
  `onSnapshot(messages orderBy createdAt asc limitToLast(30))` for the tail + a
  static `getDocs(endBefore cursor)` for older pages, merged/deduped by id.
- **Unread badges** (sidebar) → live `onSnapshot` over conversations + over
  `notifications where recipientId==me && isRead==false`.
- **Presence dot** → **RTDB** `onValue(rtdb, presence/{uid}/online)` (the only
  Realtime-Database dependency; separate from Firestore).
- **FCM push** → `sendPushToUser` fires server-side on every message
  (Firebase-gated, handoff-walled).

## B2. Exact backend surface (Pro Inbox)

**`messages.ts`** (server actions → need REST wrappers):
| Action | Signature → return | Notes |
|---|---|---|
| `getOrCreateDirectConversationAction(myUid, otherUid)` | `→ {conversationId}` | Rejects self; verifies caller==myUid; creates denormalized doc if absent. |
| `createGroupConversationAction(creatorUid, participantUids[], name)` | `→ {conversationId}` | 2–50 members; name required. |
| `sendMessageAction({conversationId, text, type, resource?, audioUrl?, audioDuration?, clientMessageId?})` | `→ {messageId}` | Participant-gated; transactional add + preview + `unreadCount++`; idempotent on `clientMessageId`; fans out notif + FCM. text ≤1000; audio Storage-only, 0–600s. |
| `markConversationReadAction(conversationId, userId)` | `→ void` | Participant-gated; resets `unreadCount[me]=0`; `arrayUnion(readBy)` on last 50; pages notifications to clear the Bell badge. |
| `getTotalUnreadCountAction(userId)` | `→ number` | Sidebar badge (capped 500 convos). |
| `acknowledgeDeliveryAction(conversationId, messageIds[])` | `→ void` | Stamps `deliveredTo` (≤50/batch). |

**`notifications.ts`:**
| Action | → | Notes |
|---|---|---|
| `getNotificationsAction()` | `Notification[]` (≤50, in-mem sorted) | |
| `markNotificationAsReadAction(id)` | `void` | Recipient-verified. |
| `markAllAsReadAction()` | `void` | Chunked ≤500/batch. |

**Types the Flutter DTOs must mirror:** `Conversation`, `Message`, `MessageType`,
`SharedResource`, `ParticipantSnapshot`, `Notification`, `NotificationType`. Keep
`buildDirectConversationId` in Dart identical (`[a,b]..sort()` join `_`) so a DM
opened from Flutter and from web collide on the same doc.

## B3. Premium Flutter treatment (Pro Inbox)

New module `lib/features/inbox/`. Two-pane on tablet (≥600dp), single-pane push on
phone — mirror the web's list↔thread mobile toggle.

### B3.1 Inbox list — `inbox_screen.dart` (REALTIME)
- `StreamProvider` over the conversations query above. Each row = **`AppCard(flat)`
  register row**, not a chat-app row: avatar `IconWell`/photo with a **presence
  dot** overlay (RTDB stream, B3.4), conversation label `titleMedium` (group name
  or the *other* participant's denormalized `displayName`), `lastMessage` preview
  `bodyMedium` muted (single line, ellipsis), `lastMessageAt` as a right-aligned
  `overline` relative time, and an unread `AppBadge` (saffron pill, `dataMedium`
  tabular count) when `unreadCount[me] > 0`. Unread rows get slightly heavier
  weight, never a colored fill.
- `EditorialSectionHeader("MESSAGES")` masthead; search `LabeledField` filters by
  label in-memory (web parity).
- **`EmptyView`** (halo `MessageCircle`, "Your Messages", the exact web copy:
  "Connect with teachers in the Community to start messaging…", `SecondaryButton
  "Find Teachers"` → Staffroom directory). This is the DM-gate surface.
- **Error state** (missing index / permission-denied) → `ErrorView` with retry —
  never an infinite spinner (the web learned this the hard way).
- `AppSkeleton` list while first snapshot resolves.
- New-DM flow: from a teacher profile (`/messages?with=uid` equivalent) →
  `getOrCreateDirectConversationAction` → open thread.

### B3.2 Conversation thread — `conversation_thread_screen.dart` (REALTIME)
The **document-style thread** — the premium payoff. Messages are **not** iMessage
bubbles; they are **ruled ledger entries**:

- Provider = a Dart port of `usePaginatedMessages`: live tail
  `onSnapshot(limitToLast(30))` + `getDocs(endBefore)` older pages, merged/deduped
  by id, referentially stable (so the auto-scroll effect doesn't thrash).
- Each message renders by `type`:
  - **text** → a register line: a hairline `outlineVariant` left rule (saffron for
    own messages, neutral for others), sender `overline` + timestamp on the meta
    line, `AiText` body (Indic-safe, 1.7 line-height, soft-wrap). Group threads show
    the sender name; direct threads omit it.
  - **resource** → an `AppCard(inset)` **`SharedResource` card**: doc-type saffron
    `overline` (`LESSON PLAN`, `QUIZ`…), title `titleMedium`, grade/subject
    `AppBadge`s, and an **"Open"** `SecondaryButton` that routes into the matching
    tool via `route` (the Inbox→Prep-desk bridge). Reuse `DocumentSheet`'s masthead
    grammar in miniature.
  - **audio** → a voice-note row: `Play` `IconWell`, a waveform/scrubber, and
    `audioDuration` as `dataMedium` (reuse `lib/shared/media`).
- **Read/delivery ticks**: derive from `readBy`/`deliveredTo` → a subtle
  `Check`/`CheckCheck` glyph in `mutedForeground`; "read" tick in saffron
  `primaryText`. `deliveryStatus` (`sending/sent/delivered/read/failed`) drives an
  optimistic state; failed → inline retry.
- **Composer**: `LabeledField` (1000-char client cap), attach affordances
  (resource picker → sends `type:'resource'`; mic → `type:'audio'` after Storage
  upload). Send = `PrimaryButton` with glow; generate a `clientMessageId` (UUID)
  for idempotent, offline-safe sends (mirror `OutboxMessage`; queue in local
  storage when offline, reconcile on reconnect).
- **On open**: fire the REST wrapper of `markConversationReadAction` (clears
  unread + Bell). Auto-scroll to bottom on new tail message; "Load older" =
  `SecondaryButton` header.
- Motion: new inbound message inks in (fade + moveY 8→0, ink-settle stagger); own
  sent message appends optimistically.

### B3.3 Notifications — `notifications_screen.dart`
- List from `getNotificationsAction` (poll/refresh; badge itself is live via the
  `onSnapshot` in B3.4). Each = `AppCard(flat)` row: type → Lucide glyph in an
  `IconWell` (`Heart` LIKE, `UserPlus` CONNECT_REQUEST, `MessageCircle` MESSAGE,
  `Bookmark` RESOURCE_SAVED, `MessagesSquare` NEW_GROUP_POST…), `title`
  `titleSmall`, `message` `bodyMedium`, relative time `overline`, unread → faint
  saffron `primaryContainer` left tick.
- `CONNECT_REQUEST` rows carry `metadata.requestId` → inline Accept
  (`PrimaryButton`) / Decline (`SecondaryButton`) calling the connection actions.
- Tap → route by `link` (e.g. `/messages?open=…` → thread). Mark-read on tap;
  "Mark all read" header action.
- `EmptyView` (halo `Bell`, dignified "You're all caught up").

### B3.4 Realtime badges + presence — shared providers
- `unreadConversationsProvider` (StreamProvider): `onSnapshot(conversations
  array-contains me)` → sum `unreadCount[me]` → app-shell tab badge on Inbox.
- `unreadNotificationsProvider` (StreamProvider): `onSnapshot(notifications
  recipientId==me && isRead==false)` → count → Bell badge.
- `presenceProvider.family(uid)` (StreamProvider): **RTDB** `onValue(presence/
  {uid}/online)` → the green presence dot. This is the sole `firebase_database`
  use; gate it separately so the rest of the Inbox works without RTDB.

---

## C. Realtime + Firebase-gating summary (for the loop)

| Surface | Realtime? | Mechanism | Firebase pkg |
|---|---|---|---|
| Inbox list | ✅ live | Firestore `onSnapshot` (array-contains) | `cloud_firestore` |
| Thread tail | ✅ live | Firestore `onSnapshot(limitToLast 30)` | `cloud_firestore` |
| Thread older pages | ❌ static | Firestore `getDocs(endBefore)` | `cloud_firestore` |
| Staff Room / group chat | ✅ live | Firestore `onSnapshot(limitToLast 100)` | `cloud_firestore` |
| Unread convo + notif badges | ✅ live | Firestore `onSnapshot` | `cloud_firestore` |
| Presence dot | ✅ live | **RTDB** `onValue` | `firebase_database` |
| Unified feed | ❌ poll | server read, focus + 45s refresh | REST wrapper |
| Recommendations / directory / connection data | ❌ one-shot | server read | REST wrapper |
| All writes (send/connect/join/like/mark-read/post) | ❌ | server-action logic | REST wrapper |
| Persona pulse | ❌ timer | `POST /api/community/persona-pulse` (503=stop) | REST (exists) |
| Push | server-side | `sendPushToUser` FCM | `firebase_messaging` (handoff-walled) |

Every listed Firebase dependency is **absent from the current `pubspec.yaml`** —
both pillars are fully Firebase-gated. With no Firebase project wired, ship the
`EmptyView` states behind `kStaffroomEnabled` / `kProInboxEnabled = false`.

## D. Build-loop ordering (proposed)

1. **U-SI0 (transport spike, blocks all):** decide + land the transport split —
   add `firebase_core`/`cloud_firestore`/`firebase_database` + init from the
   Flutter app's Firebase config; request the REST wrappers for the server actions
   (backend task). Port `buildDirectConversationId`, all DTOs
   (`conversation_dtos`, `message_dtos`, `notification_dtos`, `group_dtos`,
   `connection_dtos`, `teacher_suggestion_dto`) with `json_serializable`.
2. **U-SI1 Pro Inbox realtime core:** `inbox_screen` + `conversation_thread_screen`
   + paginated-messages provider + mark-read + unread badges. (Highest value,
   cleanest realtime story.)
3. **U-SI2 Staffroom home + Group detail + Unified feed + optimistic likes.**
4. **U-SI3 Staff Room chat (realtime) + persona-pulse timer + group chat.**
5. **U-SI4 Directory + Profile + connection-request lifecycle (the DM gate).**
6. **U-SI5 Notifications screen + connect-request inline actions + deep links.**
7. **U-SI6 (Firebase-gated tail):** presence (RTDB) + FCM push parity.

Per-unit acceptance: `flutter analyze` = 0, `token_guard` PASS, behavior tests
green, goldens re-baselined at 360/800 light+dark with the Bengali/Tamil/Malayalam
probe strings (thread + inbox rows + chat blocks must show zero clipped matra at
textScale 1.3), saffron surface < 10%, every list has skeleton/empty/error states,
DM-gate copy present, `clientMessageId` idempotency verified.

## E. Risks / things to flag to the founder

- **Transport gap is the real cost**, not the UI. Server actions ≠ REST; the loop
  needs backend REST wrappers (or accept adding the Firebase SDK for reads and a
  small set of wrappers for writes). This is a cross-repo dependency — surface it
  before starting.
- **Two connection graphs** (`follow` vs mutual `connection_requests`→`connections`)
  share a collection name with different doc shapes. Keep them distinct in Dart or
  the DM-gate logic breaks.
- **PII rules are enforced server-side** (`stripToPublicProfile`, email-only-if-
  connected). Do NOT let Flutter read `users/*` directly for directory/profile —
  go through the wrapped `getAllTeachersAction`/`getPublicProfileAction`, or the
  bulk-harvest hole reopens.
- **Missing-index errors** on the inbox/notif `onSnapshot` must render `ErrorView`,
  never hang — the web shipped a bug here twice.
- **FCM / RTDB presence** are hard handoff walls (google-services.json, APNs,
  RTDB rules). Ship the pillars without them first.

---

**File:** `docs/flutter/pillars/SPEC_staffroom_inbox.md`
