# AI Flow: Agent Router (VIDYA Assistant)

**Files:**
- `src/ai/flows/agent-router.ts` — intent classification + routing
- `src/ai/flows/agent-definitions.ts` — intent schema and tool definitions

**API Route:** `POST /api/assistant`

---

## Purpose

The brain of the VIDYA assistant (OmniOrb). Classifies user intent into one of 9 action types, then either routes to a tool page with pre-filled parameters OR responds conversationally.

---

## Intent Types

```ts
type Intent =
  | 'GENERATE_LESSON_PLAN'
  | 'GENERATE_QUIZ'
  | 'GENERATE_WORKSHEET'
  | 'GENERATE_VISUAL_AID'
  | 'GENERATE_RUBRIC'
  | 'GENERATE_FIELD_TRIP'
  | 'TEACHER_COACHING'
  | 'NAVIGATE_AND_FILL'    // navigate to a tool page + pre-fill params
  | 'CHAT_RESPONSE'        // just reply conversationally
```

---

## Processing Flow

```
/api/assistant:
  1. Read x-user-id header
  2. Load session from Firestore (L2 cache) or memory (L1 cache)
  3. Add user message to history
  4. Call agent-router.ts with { message, history, teacherProfile }
  5. Agent returns { intent, params, responseText }
  6. Stream responseText via SSE
  7. If intent === NAVIGATE_AND_FILL: include { action: 'navigate', url, params } in stream
  8. Save updated session to Firestore
```

---

## Caching (2-tier)

| Tier | Storage | Lifetime |
|---|---|---|
| L1 | Node.js in-memory Map | Process lifetime |
| L2 | Firestore `assistant_sessions/{userId}` | Persists across requests |

L1 is checked first. Miss → L2. L2 miss → new session.

---

## NAVIGATE_AND_FILL Action

When teacher says "Make a quiz on fractions for Class 5":
1. Intent = `GENERATE_QUIZ`
2. Router extracts: `{ grade: 'Class 5', topic: 'fractions', subject: 'Mathematics' }`
3. Builds URL: `/quiz-generator?grade=Class+5&topic=fractions&subject=Mathematics`
4. Response includes navigation instruction
5. OmniOrb component executes the navigation + pre-fills form

---

## Teacher Profile Learning

When teacher mentions their grade/subject/language in conversation:
- Stored in `teacherProfile` object in session
- Used to pre-fill future requests (e.g., "always Class 6 Hindi")
- Persisted to `users/{uid}` in Firestore via profile action

---

## Conversation History

Stored as array in session:
```ts
[
  { role: 'user', content: string },
  { role: 'assistant', content: string },
  ...
]
```

Last N messages (window size configured in session) sent to Gemini for multi-turn context.

---

## Streaming

`/api/assistant` returns Server-Sent Events:
- Each chunk: `data: {"text": "partial response"}\n\n`
- End: `data: {"done": true, "action": {...}}\n\n` (with optional navigation action)
- OmniOrb consumes the stream and types out the response progressively
