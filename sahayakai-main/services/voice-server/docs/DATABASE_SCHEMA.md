# Call Intelligence Store — Database Schema

**Version:** 2
**Engine:** SQLite (WAL mode) — migrates to Postgres/Firestore later
**Location:** `data/calls.db`
**Code:** `src/call_store.py`

---

## Entity Relationship

```
parents (phone)
  │
  ├──< students (parent_phone FK)
  │      │
  │      ├──< calls (student_id FK, parent_phone FK)
  │      │      │
  │      │      ├──< transcript_turns (outreach_id FK)
  │      │      ├──── call_insights (outreach_id PK/FK)
  │      │      ├──── call_metrics (outreach_id PK/FK)
  │      │      ├──< follow_ups (outreach_id FK)
  │      │      └──< parent_concerns (raised_in_call FK)
  │      │
  │      └──< parent_concerns (student_id FK)
  │
  └──< parent_concerns (parent_phone FK)
       follow_ups (parent_phone FK)
```

---

## Tables

### 1. `parents` — One row per unique phone number

The central entity. Indian parents rarely change numbers. All intelligence accumulates here.

| Column | Type | Description |
|--------|------|-------------|
| `phone` | TEXT PK | E.164 format: +919876543210 |
| `name` | TEXT | Best-known name (updated each call) |
| `language` | TEXT | Preferred language: Hindi, Kannada, etc. |
| `total_calls` | INTEGER | All call attempts (including unanswered) |
| `calls_answered` | INTEGER | Calls where parent picked up |
| `calls_productive` | INTEGER | Calls rated "productive" by analysis |
| `last_call_at` | TEXT | ISO timestamp of most recent call |
| `last_sentiment` | TEXT | Sentiment from most recent call |
| `dominant_sentiment` | TEXT | Most frequent sentiment across all calls |
| `communication_style` | TEXT | Learned: defensive/cooperative/emotional/brief/talkative |
| `best_call_time` | TEXT | Learned: morning/afternoon/evening |
| `avg_call_duration_s` | INTEGER | Average call duration |
| `created_at` | TEXT | First interaction |
| `updated_at` | TEXT | Last update |

**Indexes:** `dominant_sentiment`, `last_call_at`

**Why phone is PK:** In Indian schools, parent phone is the universal identifier. Teachers don't have parent UIDs. One phone may link to multiple students (siblings).

---

### 2. `students` — One row per student

Linked to parent. Tracks outreach history per child.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | Backend student_id, or generated: `name_class_school` |
| `parent_phone` | TEXT FK → parents | Parent's phone number |
| `name` | TEXT | Student name |
| `class_name` | TEXT | "Class 5", "Class 8" |
| `school_name` | TEXT | School name |
| `teacher_name` | TEXT | Current/last known teacher |
| `total_outreach` | INTEGER | Total call attempts about this student |
| `issue_history` | TEXT (JSON) | `[{reason, date, resolved}]` — chronological |
| `last_reason` | TEXT | Most recent outreach reason |
| `last_outreach_at` | TEXT | When last called about this student |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**Indexes:** `parent_phone`, `school_name`

**Design note:** One parent can have multiple students (siblings). One student belongs to one parent phone. If parents share a phone (common in villages), both children appear under the same phone.

---

### 3. `calls` — One row per outreach attempt

Core fact table. Every call attempt gets a row, whether answered or not.

| Column | Type | Description |
|--------|------|-------------|
| `outreach_id` | TEXT PK | From backend, or `__test__001` for test scenarios |
| `call_sid` | TEXT | Twilio Call SID |
| `parent_phone` | TEXT FK → parents | |
| `student_id` | TEXT FK → students | |
| `student_name` | TEXT | Denormalized — avoids join for common queries |
| `class_name` | TEXT | Denormalized |
| `teacher_name` | TEXT | Denormalized |
| `school_name` | TEXT | Denormalized |
| `parent_language` | TEXT | Hindi, Kannada, etc. |
| `reason` | TEXT | Free text: "fighting with classmates, not listening" |
| `reason_category` | TEXT | Auto-classified: `consecutive_absences` / `poor_performance` / `behavioral_concern` / `positive_feedback` / `other` |
| `generated_message` | TEXT | Opening greeting sent to parent |
| `pipeline_mode` | TEXT | `streaming` (Pipecat) or `batch` (legacy Twilio) |
| `call_status` | TEXT | Lifecycle: `initiated` → `ringing` → `connected` → `completed` / `failed` / `no_answer` / `busy` |
| `answered_by` | TEXT | parent / spouse / child / other / voicemail |
| `turn_count` | INTEGER | Total conversation turns |
| `call_duration_s` | INTEGER | Duration in seconds |
| `started_at` | TEXT | When call connected (not initiated) |
| `ended_at` | TEXT | When call ended |
| `synced_to_backend` | INTEGER | `0` = pending, `1` = synced, `2` = sync failed |
| `last_sync_attempt` | TEXT | |
| `sync_error` | TEXT | Error message if sync failed |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**Indexes:** `parent_phone`, `student_id`, `call_status`, `reason_category`, `created_at`, partial on `synced_to_backend = 0`

**Why denormalize student/teacher/school?** These fields appear in 90% of queries. Joining students + parents every time wastes cycles for data that changes rarely.

**Why auto-classify reason?** Teachers write free text ("Rohit is fighting with classmates"). `_classify_reason()` maps this to enum for filtering: "show me all behavioral calls this month."

---

### 4. `transcript_turns` — Individual conversation turns

**NOT a JSON blob.** Each turn is a row. Enables per-turn analytics.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `outreach_id` | TEXT FK → calls | Which call |
| `turn_number` | INTEGER | 0-based position in conversation |
| `role` | TEXT | `agent` or `parent` |
| `text` | TEXT | What was said |
| `word_count` | INTEGER | Precomputed: `len(text.split())` |
| `language_detected` | TEXT | What STT actually detected (may differ from expected) |
| `timestamp` | TEXT | When this turn occurred |
| `created_at` | TEXT | |

**Indexes:** `outreach_id`, composite `(outreach_id, role)`

**Why rows not JSON?**
- Query: "Average parent words per turn across all behavioral calls" — impossible with JSON blob
- Query: "Show me all Turn 1 responses to exam performance calls" — trivial with rows
- Query: "Which calls had the parent speak fewer than 3 words in any turn?" — one SQL statement
- Per-turn language detection catches code-switching mid-call

**Example queries:**
```sql
-- Average parent verbosity by call reason
SELECT c.reason_category, AVG(tt.word_count) as avg_words
FROM transcript_turns tt
JOIN calls c ON tt.outreach_id = c.outreach_id
WHERE tt.role = 'parent'
GROUP BY c.reason_category;

-- Calls where parent gave 1-word responses (disengaged)
SELECT DISTINCT c.outreach_id, c.student_name
FROM transcript_turns tt
JOIN calls c ON tt.outreach_id = c.outreach_id
WHERE tt.role = 'parent' AND tt.word_count <= 1
GROUP BY c.outreach_id
HAVING COUNT(*) >= 3;  -- 3+ one-word responses = disengaged
```

---

### 5. `call_insights` — AI-generated analysis per call

One row per completed call. Produced by `call_analyzer.py` using Gemini after call ends.

| Column | Type | Description |
|--------|------|-------------|
| `outreach_id` | TEXT PK/FK → calls | |
| `parent_sentiment` | TEXT | `cooperative` / `concerned` / `grateful` / `upset` / `indifferent` / `confused` |
| `call_quality` | TEXT | `productive` / `brief` / `difficult` / `unanswered` |
| `parent_response` | TEXT | 1-2 sentence summary of parent's position |
| `communication_style` | TEXT | `defensive` / `cooperative` / `emotional` / `brief` / `talkative` / `aggressive` |
| `topics_discussed` | TEXT (JSON) | `["academics", "fees", "health"]` |
| `guidance_given` | TEXT (JSON) | `["extra class offered", "will talk to principal"]` |
| `parent_commitments` | TEXT (JSON) | `["will send child tomorrow"]` |
| `effective_approach` | TEXT | `empathy` / `practical_suggestion` / `reassurance` / `listening` / `de_escalation` / `none` |
| `approach_details` | TEXT | What specifically worked or didn't |
| `action_items` | TEXT (JSON) | `[{description, owner, priority}]` |
| `agent_stayed_in_character` | INTEGER | 1=yes, 0=broke character |
| `conversation_natural` | INTEGER | 1=felt real, 0=robotic |
| `parent_engaged` | INTEGER | 1=participated, 0=disengaged |
| `generated_at` | TEXT | When analysis was run |

**Why some columns are JSON, others aren't?**
- `parent_sentiment`, `call_quality`, `effective_approach` → TEXT enum: filtered and aggregated constantly
- `topics_discussed`, `guidance_given` → JSON array: variable length, rarely filtered individually
- Rule: if you GROUP BY or WHERE on it, it's a column. If you just display it, JSON is fine.

---

### 6. `parent_concerns` — Lifecycle-tracked concerns

**Not a JSON array on the parent.** Separate table with state machine.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `parent_phone` | TEXT FK → parents | |
| `student_id` | TEXT FK → students | Which child this concerns |
| `concern_text` | TEXT | In parent's words: "fees nahi de paa rahe" |
| `category` | TEXT | `fees` / `health` / `academics` / `behavior` / `logistics` / `family` / `other` |
| `severity` | TEXT | `low` / `medium` / `high` / `critical` |
| `status` | TEXT | Lifecycle: `raised` → `acknowledged` → `in_progress` → `resolved` / `recurring` |
| `raised_in_call` | TEXT FK → calls | Which call it first came up in |
| `resolved_in_call` | TEXT FK → calls | Which call it was resolved in (if ever) |
| `times_raised` | INTEGER | Incremented when same category concern repeats (no duplicates) |
| `last_raised_at` | TEXT | When most recently mentioned |
| `resolution_note` | TEXT | "Principal approved fee waiver" |
| `resolved_at` | TEXT | |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**Indexes:** `parent_phone`, partial `status != 'resolved'`, `category`

**Lifecycle rules:**
1. New concern in category → INSERT with `status = 'raised'`
2. Same category concern in next call → `times_raised += 1`, status stays or becomes `recurring`
3. Teacher/school addresses it → manual update to `in_progress`
4. Resolved → `status = 'resolved'`, `resolved_in_call` set, `resolution_note` filled

**Why not just a JSON array?**
- "Which concerns have been raised 3+ times?" — one query
- "Show all unresolved fee concerns across the school" — one query
- "What percentage of concerns get resolved within 2 calls?" — one query
- Dashboard: "17 open concerns, 5 critical" — computed live, not stale

---

### 7. `follow_ups` — Actionable tasks from calls

Workflow tracking: pending → done. Not just a boolean.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | |
| `outreach_id` | TEXT FK → calls | Which call generated this |
| `parent_phone` | TEXT FK → parents | |
| `student_id` | TEXT FK → students | |
| `description` | TEXT | "Talk to principal about fee waiver" |
| `owner` | TEXT | `teacher` / `school` / `parent` |
| `priority` | TEXT | `low` / `medium` / `high` / `urgent` |
| `due_by` | TEXT | Suggested deadline |
| `status` | TEXT | `pending` → `in_progress` → `done` / `skipped` |
| `completed_at` | TEXT | |
| `completion_note` | TEXT | What was done |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

**Indexes:** partial `status = 'pending'`, `parent_phone`, composite `(owner, status)`

**Example queries:**
```sql
-- All pending high-priority follow-ups for a teacher
SELECT f.*, c.student_name FROM follow_ups f
JOIN calls c ON f.outreach_id = c.outreach_id
WHERE f.owner = 'teacher' AND f.status = 'pending'
AND f.priority IN ('high', 'urgent')
ORDER BY f.priority DESC, f.created_at;

-- Follow-up completion rate
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) as rate
FROM follow_ups;
```

---

### 8. `call_metrics` — Pipeline quality monitoring

Technical data. Monitors STT/TTS/LLM performance per call.

| Column | Type | Description |
|--------|------|-------------|
| `outreach_id` | TEXT PK/FK → calls | |
| `greeting_latency_ms` | INTEGER | Connect → first audio out |
| `avg_response_latency_ms` | INTEGER | Parent stops speaking → agent audio starts |
| `max_response_latency_ms` | INTEGER | Worst-case response time |
| `stt_transcriptions_total` | INTEGER | Total STT outputs |
| `stt_transcriptions_filtered` | INTEGER | Dropped by STTConfidenceFilter |
| `stt_filter_rate` | REAL | filtered/total ratio (>0.5 = very noisy) |
| `noise_environment_detected` | INTEGER | 1 if rapid-fire noise detected |
| `interruptions_count` | INTEGER | Parent interrupted agent |
| `barge_in_count` | INTEGER | Agent was cut off mid-sentence |
| `pipeline_errors` | INTEGER | Any pipeline-level errors |
| `tts_failures` | INTEGER | TTS synthesis failures |
| `llm_failures` | INTEGER | LLM inference failures |
| `created_at` | TEXT | |

**Example queries:**
```sql
-- Average response latency by language
SELECT c.parent_language, AVG(cm.avg_response_latency_ms) as avg_latency
FROM call_metrics cm
JOIN calls c ON cm.outreach_id = c.outreach_id
GROUP BY c.parent_language;

-- Calls with high noise (might need follow-up)
SELECT c.outreach_id, c.student_name, cm.stt_filter_rate
FROM call_metrics cm
JOIN calls c ON cm.outreach_id = c.outreach_id
WHERE cm.stt_filter_rate > 0.5
ORDER BY cm.stt_filter_rate DESC;
```

---

### 9. `schema_version` — Migration tracking

| Column | Type | Description |
|--------|------|-------------|
| `version` | INTEGER | Current schema version |
| `migrated_at` | TEXT | When this version was applied |

---

## Design Decisions

### Why SQLite?
- Voice server runs as a single process — no concurrent writers needed
- WAL mode handles read concurrency from health checks / analytics
- Zero ops — no separate database process to manage
- Migrates to Postgres with identical SQL (TEXT→VARCHAR, INTEGER→INT)

### Why not Firestore directly?
- Firestore is the Next.js app's DB. Voice server syncs to it asynchronously.
- If backend is down, local store keeps working (zero data loss)
- SQLite enables complex analytical queries Firestore can't do

### Normalization strategy
- **Normalized:** transcript_turns, parent_concerns, follow_ups — need individual queries
- **Denormalized:** student_name/teacher_name on calls — join avoidance for hot path
- **JSON for variable-length lists:** topics_discussed, guidance_given — displayed, not filtered

### Sync to Firestore
- `synced_to_backend`: 0=pending, 1=synced, 2=failed
- Partial index on `synced_to_backend = 0` — fast batch sync queries
- Backend sync runs periodically or on demand
- Firestore schema in `src/types/attendance.ts` — `ParentOutreach` interface

### Parent context injection
`build_parent_context(phone)` queries across all tables live:
1. Parent aggregate stats (sentiment, style, productive rate)
2. Open concerns (unresolved, with severity and repeat count)
3. Effective approaches from past productive calls
4. Pending follow-ups
5. Last call summary

Returns a text block injected into the LLM system prompt. The agent then naturally adjusts its approach based on history without explicitly saying "I know from last time."

---

## Aligns with Firestore Schema

| SQLite | Firestore (`ParentOutreach`) |
|--------|----------------------------|
| `calls.outreach_id` | `id` |
| `calls.call_sid` | `callSid` |
| `calls.call_status` | `callStatus` |
| `calls.turn_count` | `turnCount` |
| `calls.call_duration_s` | `callDurationSeconds` |
| `transcript_turns` → assembled | `transcript: TranscriptTurn[]` |
| `call_insights` → assembled | `callSummary: CallSummary` |
| `calls.pipeline_mode` | `voicePipelineMode` |
