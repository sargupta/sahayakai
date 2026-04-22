# Community — SahayakAI (recon 2026-04-21)

## Discover tab
- Populates from shared content (lesson plans, quizzes, etc.) sorted by `stats.likes` (trending)
- Type-filter chips: lesson-plan, quiz, worksheet, rubric, visual-aid, etc. — filter client-side post-fetch (no composite index)
- Voice search: Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`)
- No time-decay on trending → old viral items dominate

## Connect tab
- Teacher directory: avatar, name, school, bio, subjects (first 2), followers, impact score
- Client-side search over name/school/subjects/bio (case-insensitive)
- **Hard limit: 200 teachers in directory** — breaks at scale
- Connection formula: `pairId = [uid1,uid2].sort().join('_')`
- Paths: `connection_requests/{pairId}`, `connections/{pairId}`
- Admin SDK server-side for `connections/` writes; client SDK can delete

## Chat tab
- Firestore `onSnapshot` on last 100 messages of community chat
- 1:1 DM is separate at `/messages`
- Message schema: `{ type: 'text'|'resource'|'audio', text, audioUrl?, audioDuration?, authorId, name, photo, createdAt }`
- Voice upload path: `voice-messages/{uid}/{timestamp}.webm` (or `.mp4` Safari fallback)
- Codec detection via `MediaRecorder.isTypeSupported()`
- **GOTCHA: signed URLs expire ~7 days**, no refresh mechanism → archived voice messages unplayable

## CreatePostDialog (ShareComposer)
- 4 templates: "I Tried This", "Share Resource", "Ask for Help", "Celebrate"
- Writes to `groups/{groupId}/posts/{postId}`
- **"Add Image" button is a stub** — attachment schema exists but UI not wired

## Mobile FAB
- Fixed bottom-right, visible <640px
- Scrolls ShareComposer into view (no modal)
- z-index 50

## Known gotchas
1. Voice URL expiry (MODERATE) — affects archived chats
2. Image upload stub (LOW)
3. No trending time-decay (LOW)
4. Group dropdown no outside-click close (UX nit)
5. Directory 200-cap (SCALE)
6. Composite index risk on filtered resources (PERF)
7. Voice MIME fallback weak (COMPAT)
8. Attachment schema vs UI mismatch (LOW)
