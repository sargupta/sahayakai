"""
Call Intelligence Store — SQLite-backed persistence for parent call data.

Design principles:
  1. Normalized where it enables queries, denormalized where it saves joins
  2. Transcript turns are rows, not a JSON blob — enables per-turn analysis
  3. Parent concerns have lifecycle (raised → acknowledged → resolved)
  4. Students and parents are separate entities — one parent, multiple children
  5. Follow-ups have workflow state, not just a boolean
  6. Call metrics tracked for pipeline quality monitoring
  7. Everything syncs to Firestore eventually — local store is source of truth

Entity model:
  parents          ← keyed by phone, accumulated intelligence
  students         ← keyed by (name, class, school), linked to parent
  calls            ← one per outreach attempt
  transcript_turns ← individual conversation turns within a call
  call_insights    ← AI-generated analysis per call
  parent_concerns  ← lifecycle-tracked concerns across calls
  follow_ups       ← actionable follow-up tasks from calls
  call_metrics     ← pipeline quality data (latency, noise, STT quality)

Migration path: SQLite now → Postgres or Firestore later.
Schema uses TEXT dates (ISO 8601), TEXT enums, INTEGER booleans.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger


_DEFAULT_DB_PATH = os.environ.get(
    "CALL_STORE_DB",
    str(Path(__file__).parent.parent / "data" / "calls.db"),
)

# ── Schema version — bump on breaking changes ──
_SCHEMA_VERSION = 2


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════════════════════════════════════════════════
# Schema DDL
# ═══════════════════════════════════════════════════════════════════════════════

_SCHEMA_DDL = """
-- ── schema_version ──────────────────────────────────────────────────────────
-- Tracks migrations. Single row.
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER NOT NULL,
    migrated_at TEXT    NOT NULL
);

-- ── parents ─────────────────────────────────────────────────────────────────
-- One row per unique phone number. Accumulated intelligence across all calls.
-- Phone is the natural key — in India, parents rarely change numbers.
CREATE TABLE IF NOT EXISTS parents (
    phone               TEXT PRIMARY KEY,
    name                TEXT,                -- best-known name (updated each call)
    language            TEXT DEFAULT 'Hindi',

    -- Accumulated intelligence (updated after each call analysis)
    total_calls         INTEGER DEFAULT 0,
    calls_answered      INTEGER DEFAULT 0,
    calls_productive    INTEGER DEFAULT 0,
    last_call_at        TEXT,
    last_sentiment      TEXT,                -- from most recent call
    dominant_sentiment  TEXT,                -- most frequent across calls
    communication_style TEXT,                -- defensive/cooperative/emotional/brief/talkative

    -- Best contact patterns
    best_call_time      TEXT,                -- morning/afternoon/evening (learned)
    avg_call_duration_s INTEGER,

    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- ── students ────────────────────────────────────────────────────────────────
-- One row per student. Linked to parent by phone.
-- Composite natural key: (name, class, school) since we don't always have IDs.
CREATE TABLE IF NOT EXISTS students (
    id              TEXT PRIMARY KEY,        -- student_id from backend, or generated
    parent_phone    TEXT NOT NULL REFERENCES parents(phone),
    name            TEXT NOT NULL,
    class_name      TEXT,                    -- "Class 5", "Class 8"
    school_name     TEXT,
    teacher_name    TEXT,                    -- current/last known teacher

    -- Accumulated from calls
    total_outreach  INTEGER DEFAULT 0,
    issue_history   TEXT DEFAULT '[]',       -- JSON: [{reason, date, resolved}]
    last_reason     TEXT,
    last_outreach_at TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ── calls ───────────────────────────────────────────────────────────────────
-- One row per outreach attempt. Core fact table.
CREATE TABLE IF NOT EXISTS calls (
    outreach_id     TEXT PRIMARY KEY,
    call_sid        TEXT,                    -- Twilio call SID
    parent_phone    TEXT REFERENCES parents(phone),
    student_id      TEXT REFERENCES students(id),

    -- Denormalized for quick access (avoids join for common queries)
    student_name    TEXT NOT NULL,
    class_name      TEXT,
    teacher_name    TEXT,
    school_name     TEXT,
    parent_language TEXT DEFAULT 'Hindi',

    -- Call setup
    reason          TEXT NOT NULL,           -- why the teacher called
    reason_category TEXT,                    -- consecutive_absences/poor_performance/behavioral_concern/positive_feedback
    generated_message TEXT,                  -- greeting/opening message
    pipeline_mode   TEXT DEFAULT 'streaming',-- streaming/batch

    -- Call outcome
    call_status     TEXT DEFAULT 'initiated',-- initiated/ringing/connected/completed/failed/no_answer/busy
    answered_by     TEXT,                    -- parent/spouse/child/other/voicemail
    turn_count      INTEGER DEFAULT 0,
    call_duration_s INTEGER,
    started_at      TEXT,                    -- when call connected (not initiated)
    ended_at        TEXT,

    -- Sync state
    synced_to_backend   INTEGER DEFAULT 0,  -- 0=pending, 1=synced, 2=sync_failed
    last_sync_attempt   TEXT,
    sync_error          TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ── transcript_turns ────────────────────────────────────────────────────────
-- Individual conversation turns. Normalized — enables per-turn queries.
-- "How many words does the average parent speak?" "Which turns have 1-word responses?"
CREATE TABLE IF NOT EXISTS transcript_turns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    outreach_id     TEXT NOT NULL REFERENCES calls(outreach_id),
    turn_number     INTEGER NOT NULL,       -- 0-based within the call
    role            TEXT NOT NULL,           -- agent/parent
    text            TEXT NOT NULL,
    word_count      INTEGER,                -- precomputed for analytics
    language_detected TEXT,                  -- what STT detected (may differ from expected)
    timestamp       TEXT,                    -- when this turn occurred
    created_at      TEXT NOT NULL
);

-- ── call_insights ───────────────────────────────────────────────────────────
-- AI-generated analysis per completed call. One row per call.
-- Produced by call_analyzer.py using Gemini after call ends.
CREATE TABLE IF NOT EXISTS call_insights (
    outreach_id         TEXT PRIMARY KEY REFERENCES calls(outreach_id),

    -- Overall assessment
    parent_sentiment    TEXT,    -- cooperative/concerned/grateful/upset/indifferent/confused
    call_quality        TEXT,    -- productive/brief/difficult/unanswered
    parent_response     TEXT,    -- 1-2 sentence summary of parent's position
    communication_style TEXT,    -- defensive/cooperative/emotional/brief/talkative/aggressive

    -- What happened
    topics_discussed    TEXT DEFAULT '[]',   -- JSON: ["academics", "fees", "health", "behavior", ...]
    guidance_given      TEXT DEFAULT '[]',   -- JSON: ["extra class offered", "principal will discuss fees"]
    parent_commitments  TEXT DEFAULT '[]',   -- JSON: ["will send child tomorrow", "will check homework"]

    -- What works
    effective_approach  TEXT,    -- empathy/practical_suggestion/reassurance/listening/de_escalation
    approach_details    TEXT,    -- free text: what specifically worked or didn't

    -- Action items
    action_items        TEXT DEFAULT '[]',   -- JSON: [{description, owner: "teacher"/"school"/"parent", priority}]

    -- Conversation quality
    agent_stayed_in_character INTEGER DEFAULT 1,  -- did agent maintain teacher identity?
    conversation_natural      INTEGER DEFAULT 1,  -- did it feel like a real call?
    parent_engaged            INTEGER DEFAULT 1,  -- did parent actively participate?

    generated_at        TEXT NOT NULL
);

-- ── parent_concerns ─────────────────────────────────────────────────────────
-- Lifecycle-tracked concerns. Not a JSON blob — queryable, trackable.
-- "Fees" raised in Call 1 → acknowledged in Call 2 → resolved in Call 3.
CREATE TABLE IF NOT EXISTS parent_concerns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_phone    TEXT NOT NULL REFERENCES parents(phone),
    student_id      TEXT REFERENCES students(id),

    concern_text    TEXT NOT NULL,           -- "Can't afford fees this quarter"
    category        TEXT NOT NULL,           -- fees/health/academics/behavior/logistics/family/other
    severity        TEXT DEFAULT 'medium',   -- low/medium/high/critical

    -- Lifecycle
    status          TEXT DEFAULT 'raised',   -- raised/acknowledged/in_progress/resolved/recurring
    raised_in_call  TEXT REFERENCES calls(outreach_id),   -- when first mentioned
    resolved_in_call TEXT REFERENCES calls(outreach_id),  -- when resolved (if ever)
    times_raised    INTEGER DEFAULT 1,       -- how many calls this came up in
    last_raised_at  TEXT NOT NULL,

    -- Resolution
    resolution_note TEXT,                    -- "Principal approved fee waiver"
    resolved_at     TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ── follow_ups ──────────────────────────────────────────────────────────────
-- Actionable tasks from calls. Workflow: pending → in_progress → done/skipped.
CREATE TABLE IF NOT EXISTS follow_ups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    outreach_id     TEXT NOT NULL REFERENCES calls(outreach_id),
    parent_phone    TEXT REFERENCES parents(phone),
    student_id      TEXT REFERENCES students(id),

    description     TEXT NOT NULL,           -- "Talk to principal about fee waiver"
    owner           TEXT DEFAULT 'teacher',  -- teacher/school/parent
    priority        TEXT DEFAULT 'medium',   -- low/medium/high/urgent
    due_by          TEXT,                    -- suggested deadline

    -- Workflow
    status          TEXT DEFAULT 'pending',  -- pending/in_progress/done/skipped
    completed_at    TEXT,
    completion_note TEXT,

    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ── call_metrics ────────────────────────────────────────────────────────────
-- Pipeline quality data per call. Monitors STT/TTS/LLM performance.
-- "Are we dropping calls?" "Is latency acceptable?" "How noisy are calls?"
CREATE TABLE IF NOT EXISTS call_metrics (
    outreach_id             TEXT PRIMARY KEY REFERENCES calls(outreach_id),

    -- Latency
    greeting_latency_ms     INTEGER,    -- time from connect to first audio out
    avg_response_latency_ms INTEGER,    -- average time from parent stop speaking to agent audio
    max_response_latency_ms INTEGER,

    -- STT quality
    stt_transcriptions_total    INTEGER DEFAULT 0,
    stt_transcriptions_filtered INTEGER DEFAULT 0,  -- dropped by STTConfidenceFilter
    stt_filter_rate             REAL,               -- filtered/total ratio
    noise_environment_detected  INTEGER DEFAULT 0,  -- was rapid-fire noise detected?

    -- Interruptions
    interruptions_count     INTEGER DEFAULT 0,  -- how many times parent interrupted agent
    barge_in_count          INTEGER DEFAULT 0,  -- how many times agent was cut off

    -- Pipeline
    pipeline_errors         INTEGER DEFAULT 0,
    tts_failures            INTEGER DEFAULT 0,
    llm_failures            INTEGER DEFAULT 0,

    created_at              TEXT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- Parent lookups
CREATE INDEX IF NOT EXISTS idx_parents_sentiment  ON parents(dominant_sentiment);
CREATE INDEX IF NOT EXISTS idx_parents_last_call  ON parents(last_call_at);

-- Student lookups
CREATE INDEX IF NOT EXISTS idx_students_parent    ON students(parent_phone);
CREATE INDEX IF NOT EXISTS idx_students_school    ON students(school_name);

-- Call queries
CREATE INDEX IF NOT EXISTS idx_calls_parent       ON calls(parent_phone);
CREATE INDEX IF NOT EXISTS idx_calls_student       ON calls(student_id);
CREATE INDEX IF NOT EXISTS idx_calls_status        ON calls(call_status);
CREATE INDEX IF NOT EXISTS idx_calls_reason        ON calls(reason_category);
CREATE INDEX IF NOT EXISTS idx_calls_created       ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_unsynced      ON calls(synced_to_backend)
                                                   WHERE synced_to_backend = 0;

-- Transcript queries
CREATE INDEX IF NOT EXISTS idx_turns_call          ON transcript_turns(outreach_id);
CREATE INDEX IF NOT EXISTS idx_turns_role           ON transcript_turns(outreach_id, role);

-- Concern lifecycle
CREATE INDEX IF NOT EXISTS idx_concerns_parent     ON parent_concerns(parent_phone);
CREATE INDEX IF NOT EXISTS idx_concerns_status      ON parent_concerns(status)
                                                    WHERE status != 'resolved';
CREATE INDEX IF NOT EXISTS idx_concerns_category    ON parent_concerns(category);

-- Follow-up workflow
CREATE INDEX IF NOT EXISTS idx_followups_status     ON follow_ups(status)
                                                    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_followups_parent     ON follow_ups(parent_phone);
CREATE INDEX IF NOT EXISTS idx_followups_owner       ON follow_ups(owner, status);
"""


# ═══════════════════════════════════════════════════════════════════════════════
# CallStore
# ═══════════════════════════════════════════════════════════════════════════════

class CallStore:
    """SQLite-backed local store for call data and parent intelligence.

    Usage:
      store = CallStore()                         # init at server start
      store.create_call(outreach_id, context)      # when call starts
      store.add_turn(outreach_id, 1, "agent", ..)  # per turn
      store.complete_call(outreach_id, ...)         # when call ends
      store.save_insights(outreach_id, insights)    # after AI analysis
      context = store.build_parent_context(phone)   # for next call
    """

    def __init__(self, db_path: str = _DEFAULT_DB_PATH):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._db_path = db_path
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()
        logger.info(f"Call store initialized: {db_path}")

    def _init_schema(self):
        self._conn.executescript(_SCHEMA_DDL)
        # Check/set schema version
        row = self._conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ).fetchone()
        if not row:
            self._conn.execute(
                "INSERT INTO schema_version (version, migrated_at) VALUES (?, ?)",
                (_SCHEMA_VERSION, _now_iso()),
            )
        self._conn.commit()

    # ── Parents ──────────────────────────────────────────────────────────────

    def _ensure_parent(self, phone: str, call_context: dict) -> None:
        """Create parent record if not exists, or update name/language."""
        if not phone:
            return
        now = _now_iso()
        existing = self._conn.execute(
            "SELECT 1 FROM parents WHERE phone = ?", (phone,)
        ).fetchone()
        if existing:
            self._conn.execute(
                "UPDATE parents SET name = COALESCE(?, name), language = ?, updated_at = ? WHERE phone = ?",
                (call_context.get("parentName"), call_context.get("parentLanguage", "Hindi"), now, phone),
            )
        else:
            self._conn.execute(
                "INSERT INTO parents (phone, name, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (phone, call_context.get("parentName"), call_context.get("parentLanguage", "Hindi"), now, now),
            )

    def _ensure_student(self, call_context: dict) -> str | None:
        """Create student record if not exists. Returns student_id or None."""
        student_name = call_context.get("studentName", "")
        if not student_name:
            return None

        class_name = call_context.get("className", "")
        school_name = call_context.get("schoolName", "")
        parent_phone = call_context.get("parentPhone", "")

        # Can't create student without a parent (FK constraint)
        if not parent_phone:
            return None

        # Generate deterministic ID from name+class+school
        student_id = call_context.get("studentId", "")
        if not student_id:
            student_id = f"{student_name}_{class_name}_{school_name}".lower().replace(" ", "_")

        now = _now_iso()
        existing = self._conn.execute(
            "SELECT 1 FROM students WHERE id = ?", (student_id,)
        ).fetchone()
        if not existing:
            self._conn.execute(
                """INSERT INTO students
                   (id, parent_phone, name, class_name, school_name, teacher_name, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (student_id, parent_phone, student_name, class_name, school_name,
                 call_context.get("teacherName", ""), now, now),
            )
        return student_id

    # ── Calls ────────────────────────────────────────────────────────────────

    def create_call(self, outreach_id: str, call_context: dict) -> None:
        """Create a new call record when call starts."""
        now = _now_iso()
        parent_phone = call_context.get("parentPhone", "") or None

        # Ensure parent and student exist (skips gracefully if no phone)
        if parent_phone:
            self._ensure_parent(parent_phone, call_context)
        student_id = self._ensure_student(call_context)

        # Map reason text to category
        reason = call_context.get("reason", "")
        reason_category = _classify_reason(reason)

        self._conn.execute(
            """INSERT OR REPLACE INTO calls
               (outreach_id, parent_phone, student_id,
                student_name, class_name, teacher_name, school_name, parent_language,
                reason, reason_category, generated_message, started_at,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                outreach_id, parent_phone, student_id,
                call_context.get("studentName", ""),
                call_context.get("className", ""),
                call_context.get("teacherName", ""),
                call_context.get("schoolName", ""),
                call_context.get("parentLanguage", "Hindi"),
                reason, reason_category,
                call_context.get("generatedMessage", ""),
                now, now, now,
            ),
        )
        self._conn.commit()
        logger.debug(f"Call record created: {outreach_id}")

    def add_turn(
        self,
        outreach_id: str,
        turn_number: int,
        role: str,
        text: str,
        language_detected: str | None = None,
    ) -> None:
        """Add a single transcript turn."""
        now = _now_iso()
        word_count = len(text.split()) if text else 0
        self._conn.execute(
            """INSERT INTO transcript_turns
               (outreach_id, turn_number, role, text, word_count, language_detected, timestamp, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (outreach_id, turn_number, role, text, word_count, language_detected, now, now),
        )
        self._conn.execute(
            "UPDATE calls SET turn_count = ?, updated_at = ? WHERE outreach_id = ?",
            (turn_number, now, outreach_id),
        )
        self._conn.commit()

    def update_transcript(
        self,
        outreach_id: str,
        transcript: list[dict],
        turn_count: int,
    ) -> None:
        """Bulk upsert transcript turns from a list. Used during live call sync."""
        now = _now_iso()
        # Delete existing turns and re-insert (simpler than diffing)
        self._conn.execute(
            "DELETE FROM transcript_turns WHERE outreach_id = ?", (outreach_id,)
        )
        for i, turn in enumerate(transcript):
            text = turn.get("text", "")
            self._conn.execute(
                """INSERT INTO transcript_turns
                   (outreach_id, turn_number, role, text, word_count, timestamp, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (outreach_id, i, turn.get("role", "agent"), text,
                 len(text.split()) if text else 0,
                 turn.get("timestamp", now), now),
            )
        self._conn.execute(
            "UPDATE calls SET turn_count = ?, updated_at = ? WHERE outreach_id = ?",
            (turn_count, now, outreach_id),
        )
        self._conn.commit()

    def complete_call(
        self,
        outreach_id: str,
        transcript: list[dict],
        turn_count: int,
        call_status: str = "completed",
        call_duration_s: int | None = None,
        call_sid: str | None = None,
    ) -> None:
        """Mark call as completed with final transcript."""
        now = _now_iso()

        # Upsert transcript turns
        self.update_transcript(outreach_id, transcript, turn_count)

        # Update call record
        params: list[Any] = [call_status, now, now]
        sql = "UPDATE calls SET call_status = ?, ended_at = ?, updated_at = ?"
        if call_duration_s is not None:
            sql += ", call_duration_s = ?"
            params.append(call_duration_s)
        if call_sid:
            sql += ", call_sid = ?"
            params.append(call_sid)
        sql += " WHERE outreach_id = ?"
        params.append(outreach_id)
        self._conn.execute(sql, params)

        # Update parent stats
        parent_phone = self._conn.execute(
            "SELECT parent_phone FROM calls WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        if parent_phone and parent_phone[0]:
            phone = parent_phone[0]
            self._conn.execute(
                """UPDATE parents SET
                   total_calls = total_calls + 1,
                   calls_answered = calls_answered + CASE WHEN ? = 'completed' THEN 1 ELSE 0 END,
                   last_call_at = ?,
                   updated_at = ?
                   WHERE phone = ?""",
                (call_status, now, now, phone),
            )

        # Update student outreach count
        student_id = self._conn.execute(
            "SELECT student_id FROM calls WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        if student_id and student_id[0]:
            self._conn.execute(
                """UPDATE students SET
                   total_outreach = total_outreach + 1,
                   last_reason = (SELECT reason FROM calls WHERE outreach_id = ?),
                   last_outreach_at = ?,
                   updated_at = ?
                   WHERE id = ?""",
                (outreach_id, now, now, student_id[0]),
            )

        self._conn.commit()
        logger.info(f"Call completed: {outreach_id} — {turn_count} turns, status={call_status}")

    def get_call(self, outreach_id: str) -> dict | None:
        """Get a single call record with its transcript turns."""
        row = self._conn.execute(
            "SELECT * FROM calls WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        # Attach transcript as list of dicts
        turns = self._conn.execute(
            """SELECT role, text, word_count, timestamp
               FROM transcript_turns WHERE outreach_id = ?
               ORDER BY turn_number""",
            (outreach_id,),
        ).fetchall()
        d["transcript"] = [dict(t) for t in turns]
        return d

    def has_insights(self, outreach_id: str) -> bool:
        """Check if AI-generated insights already exist for a call."""
        row = self._conn.execute(
            "SELECT 1 FROM call_insights WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        return row is not None

    # ── Call Insights ────────────────────────────────────────────────────────

    def save_insights(self, outreach_id: str, insights: dict) -> None:
        """Save AI-generated insights for a completed call."""
        now = _now_iso()
        self._conn.execute(
            """INSERT OR REPLACE INTO call_insights
               (outreach_id, parent_sentiment, call_quality, parent_response,
                communication_style, topics_discussed, guidance_given,
                parent_commitments, effective_approach, approach_details,
                action_items, agent_stayed_in_character, conversation_natural,
                parent_engaged, generated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                outreach_id,
                insights.get("parentSentiment", ""),
                insights.get("callQuality", ""),
                insights.get("parentResponse", ""),
                insights.get("communicationStyle", ""),
                json.dumps(insights.get("topicsRaised", []), ensure_ascii=False),
                json.dumps(insights.get("guidanceGiven", []), ensure_ascii=False),
                json.dumps(insights.get("parentCommitments", []), ensure_ascii=False),
                insights.get("effectiveApproach", ""),
                insights.get("approachDetails", ""),
                json.dumps(insights.get("actionItemsForTeacher", []), ensure_ascii=False),
                1 if insights.get("agentStayedInCharacter", True) else 0,
                1 if insights.get("conversationNatural", True) else 0,
                1 if insights.get("parentEngaged", True) else 0,
                now,
            ),
        )

        # Update parent sentiment + style
        phone_row = self._conn.execute(
            "SELECT parent_phone FROM calls WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        if phone_row and phone_row[0]:
            phone = phone_row[0]
            sentiment = insights.get("parentSentiment", "")
            style = insights.get("communicationStyle", "")

            # Compute dominant sentiment from all calls for this parent
            all_sentiments = self._conn.execute(
                """SELECT ci.parent_sentiment FROM call_insights ci
                   JOIN calls c ON c.outreach_id = ci.outreach_id
                   WHERE c.parent_phone = ? AND ci.parent_sentiment != ''""",
                (phone,),
            ).fetchall()
            sentiments = [r[0] for r in all_sentiments]
            dominant = max(set(sentiments), key=sentiments.count) if sentiments else sentiment

            # Count productive calls
            productive = self._conn.execute(
                """SELECT COUNT(*) FROM call_insights ci
                   JOIN calls c ON c.outreach_id = ci.outreach_id
                   WHERE c.parent_phone = ? AND ci.call_quality = 'productive'""",
                (phone,),
            ).fetchone()[0]

            self._conn.execute(
                """UPDATE parents SET
                   last_sentiment = ?, dominant_sentiment = ?,
                   communication_style = ?, calls_productive = ?,
                   updated_at = ?
                   WHERE phone = ?""",
                (sentiment, dominant, style, productive, now, phone),
            )

        self._conn.commit()
        logger.info(f"Insights saved: {outreach_id} — sentiment={insights.get('parentSentiment')}")

    # ── Parent Concerns ──────────────────────────────────────────────────────

    def record_concerns(
        self,
        outreach_id: str,
        parent_phone: str,
        concerns: list[dict],
    ) -> None:
        """Record parent concerns with lifecycle tracking.

        concerns: [{"text": "...", "category": "fees", "severity": "high"}, ...]

        If an existing concern in the same category exists and is unresolved,
        increments times_raised instead of creating a duplicate.
        """
        if not parent_phone or not concerns:
            return
        now = _now_iso()
        student_row = self._conn.execute(
            "SELECT student_id FROM calls WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        student_id = student_row[0] if student_row else None

        for concern in concerns:
            category = concern.get("category", "other")
            text = concern.get("text", "")
            severity = concern.get("severity", "medium")

            # Check for existing unresolved concern in same category
            existing = self._conn.execute(
                """SELECT id, times_raised FROM parent_concerns
                   WHERE parent_phone = ? AND category = ? AND status != 'resolved'
                   ORDER BY last_raised_at DESC LIMIT 1""",
                (parent_phone, category),
            ).fetchone()

            if existing:
                self._conn.execute(
                    """UPDATE parent_concerns SET
                       times_raised = times_raised + 1,
                       last_raised_at = ?, severity = ?,
                       status = CASE WHEN status = 'acknowledged' THEN 'recurring' ELSE status END,
                       updated_at = ?
                       WHERE id = ?""",
                    (now, severity, now, existing[0]),
                )
            else:
                self._conn.execute(
                    """INSERT INTO parent_concerns
                       (parent_phone, student_id, concern_text, category, severity,
                        raised_in_call, last_raised_at, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (parent_phone, student_id, text, category, severity,
                     outreach_id, now, now, now),
                )

        self._conn.commit()

    # ── Follow-ups ───────────────────────────────────────────────────────────

    def create_follow_ups(
        self,
        outreach_id: str,
        parent_phone: str,
        follow_ups: list[dict],
    ) -> None:
        """Create follow-up tasks from call insights.

        follow_ups: [{"description": "...", "owner": "teacher", "priority": "high"}, ...]
        """
        if not follow_ups:
            return
        now = _now_iso()
        student_row = self._conn.execute(
            "SELECT student_id FROM calls WHERE outreach_id = ?", (outreach_id,)
        ).fetchone()
        student_id = student_row[0] if student_row else None

        for fu in follow_ups:
            self._conn.execute(
                """INSERT INTO follow_ups
                   (outreach_id, parent_phone, student_id,
                    description, owner, priority, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (outreach_id, parent_phone, student_id,
                 fu.get("description", ""), fu.get("owner", "teacher"),
                 fu.get("priority", "medium"), now, now),
            )
        self._conn.commit()

    # ── Call Metrics ─────────────────────────────────────────────────────────

    def save_metrics(self, outreach_id: str, metrics: dict) -> None:
        """Save pipeline quality metrics for a call."""
        self._conn.execute(
            """INSERT OR REPLACE INTO call_metrics
               (outreach_id, greeting_latency_ms, avg_response_latency_ms,
                max_response_latency_ms, stt_transcriptions_total,
                stt_transcriptions_filtered, stt_filter_rate,
                noise_environment_detected, interruptions_count,
                barge_in_count, pipeline_errors, tts_failures,
                llm_failures, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                outreach_id,
                metrics.get("greeting_latency_ms"),
                metrics.get("avg_response_latency_ms"),
                metrics.get("max_response_latency_ms"),
                metrics.get("stt_transcriptions_total", 0),
                metrics.get("stt_transcriptions_filtered", 0),
                metrics.get("stt_filter_rate"),
                1 if metrics.get("noise_environment_detected") else 0,
                metrics.get("interruptions_count", 0),
                metrics.get("barge_in_count", 0),
                metrics.get("pipeline_errors", 0),
                metrics.get("tts_failures", 0),
                metrics.get("llm_failures", 0),
                _now_iso(),
            ),
        )
        self._conn.commit()

    # ── Parent Intelligence (for LLM context) ────────────────────────────────

    def build_parent_context(self, parent_phone: str) -> str | None:
        """Build a text summary of parent history for LLM system prompt injection.

        Queries across normalized tables to build a rich picture:
          - Call history and sentiment trends
          - Open concerns
          - Communication style
          - What approaches worked before
          - Pending follow-ups

        Returns None for first-time parents (no history).
        """
        if not parent_phone:
            return None

        parent = self._conn.execute(
            "SELECT * FROM parents WHERE phone = ?", (parent_phone,)
        ).fetchone()
        if not parent or parent["total_calls"] == 0:
            return None

        parts = [f"PARENT HISTORY ({parent['total_calls']} previous calls):"]

        # Sentiment and style
        if parent["dominant_sentiment"]:
            parts.append(f"- Usually {parent['dominant_sentiment']} on calls")
        if parent["communication_style"]:
            parts.append(f"- Communication style: {parent['communication_style']}")
        if parent["calls_productive"] and parent["total_calls"] > 0:
            rate = parent["calls_productive"] / parent["total_calls"]
            if rate < 0.5:
                parts.append(f"- Only {parent['calls_productive']}/{parent['total_calls']} calls were productive — approach carefully")

        # Open concerns (unresolved)
        concerns = self._conn.execute(
            """SELECT concern_text, category, severity, times_raised
               FROM parent_concerns
               WHERE parent_phone = ? AND status != 'resolved'
               ORDER BY severity DESC, times_raised DESC
               LIMIT 5""",
            (parent_phone,),
        ).fetchall()
        if concerns:
            concern_strs = []
            for c in concerns:
                s = f"{c['category']}: {c['concern_text']}"
                if c["times_raised"] > 1:
                    s += f" (raised {c['times_raised']}x)"
                if c["severity"] == "high" or c["severity"] == "critical":
                    s += " [SENSITIVE]"
                concern_strs.append(s)
            parts.append(f"- Open concerns: {'; '.join(concern_strs)}")

        # What worked before
        approaches = self._conn.execute(
            """SELECT DISTINCT ci.effective_approach
               FROM call_insights ci
               JOIN calls c ON c.outreach_id = ci.outreach_id
               WHERE c.parent_phone = ? AND ci.effective_approach != ''
               AND ci.call_quality = 'productive'
               ORDER BY ci.generated_at DESC LIMIT 3""",
            (parent_phone,),
        ).fetchall()
        if approaches:
            parts.append(f"- What worked before: {', '.join(a[0] for a in approaches)}")

        # Pending follow-ups
        pending = self._conn.execute(
            """SELECT description FROM follow_ups
               WHERE parent_phone = ? AND status = 'pending'
               ORDER BY priority DESC LIMIT 3""",
            (parent_phone,),
        ).fetchall()
        if pending:
            parts.append(f"- Pending follow-ups: {'; '.join(p[0] for p in pending)}")

        # Last call summary
        last_insight = self._conn.execute(
            """SELECT ci.parent_response, ci.parent_sentiment, ci.call_quality, c.reason
               FROM call_insights ci
               JOIN calls c ON c.outreach_id = ci.outreach_id
               WHERE c.parent_phone = ?
               ORDER BY c.created_at DESC LIMIT 1""",
            (parent_phone,),
        ).fetchone()
        if last_insight:
            parts.append(
                f"- Last call ({last_insight['reason']}): "
                f"parent was {last_insight['parent_sentiment']}, "
                f"call was {last_insight['call_quality']}"
            )
            if last_insight["parent_response"]:
                parts.append(f"  Summary: {last_insight['parent_response']}")

        parts.append("Use this history to personalize your approach. Don't mention you know their history explicitly.")
        return "\n".join(parts)

    # ── Sync tracking ────────────────────────────────────────────────────────

    def get_unsynced_calls(self, limit: int = 50) -> list[dict]:
        """Get completed calls not yet synced to backend, with insights."""
        rows = self._conn.execute(
            """SELECT c.*, ci.parent_sentiment, ci.call_quality, ci.parent_response,
                      ci.action_items
               FROM calls c
               LEFT JOIN call_insights ci ON c.outreach_id = ci.outreach_id
               WHERE c.synced_to_backend = 0 AND c.call_status = 'completed'
               ORDER BY c.created_at
               LIMIT ?""",
            (limit,),
        ).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            # Attach transcript
            call = self.get_call(d["outreach_id"])
            if call:
                d["transcript"] = call["transcript"]
            result.append(d)
        return result

    def mark_synced(self, outreach_id: str) -> None:
        self._conn.execute(
            "UPDATE calls SET synced_to_backend = 1, updated_at = ? WHERE outreach_id = ?",
            (_now_iso(), outreach_id),
        )
        self._conn.commit()

    def mark_sync_failed(self, outreach_id: str, error: str) -> None:
        self._conn.execute(
            """UPDATE calls SET synced_to_backend = 2, sync_error = ?,
               last_sync_attempt = ?, updated_at = ? WHERE outreach_id = ?""",
            (error, _now_iso(), _now_iso(), outreach_id),
        )
        self._conn.commit()

    # ── Stats ────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        """Summary stats for health check / dashboard."""
        def _count(sql: str) -> int:
            return self._conn.execute(sql).fetchone()[0]

        return {
            "total_calls": _count("SELECT COUNT(*) FROM calls"),
            "completed_calls": _count("SELECT COUNT(*) FROM calls WHERE call_status = 'completed'"),
            "unsynced_calls": _count("SELECT COUNT(*) FROM calls WHERE synced_to_backend = 0"),
            "total_parents": _count("SELECT COUNT(*) FROM parents"),
            "total_students": _count("SELECT COUNT(*) FROM students"),
            "open_concerns": _count("SELECT COUNT(*) FROM parent_concerns WHERE status != 'resolved'"),
            "pending_followups": _count("SELECT COUNT(*) FROM follow_ups WHERE status = 'pending'"),
            "schema_version": _SCHEMA_VERSION,
        }

    # ── Queries for dashboard / analytics ─────────────────────────────────────

    def get_parent_history(self, parent_phone: str) -> dict | None:
        """Full parent dossier — profile + all calls + concerns + follow-ups."""
        parent = self._conn.execute(
            "SELECT * FROM parents WHERE phone = ?", (parent_phone,)
        ).fetchone()
        if not parent:
            return None

        d = dict(parent)
        d["students"] = [
            dict(r) for r in self._conn.execute(
                "SELECT * FROM students WHERE parent_phone = ?", (parent_phone,)
            ).fetchall()
        ]
        d["calls"] = [
            dict(r) for r in self._conn.execute(
                """SELECT c.outreach_id, c.student_name, c.reason, c.call_status,
                          c.turn_count, c.call_duration_s, c.created_at,
                          ci.parent_sentiment, ci.call_quality, ci.parent_response
                   FROM calls c
                   LEFT JOIN call_insights ci ON c.outreach_id = ci.outreach_id
                   WHERE c.parent_phone = ?
                   ORDER BY c.created_at DESC""",
                (parent_phone,),
            ).fetchall()
        ]
        d["open_concerns"] = [
            dict(r) for r in self._conn.execute(
                """SELECT * FROM parent_concerns
                   WHERE parent_phone = ? AND status != 'resolved'
                   ORDER BY severity DESC, times_raised DESC""",
                (parent_phone,),
            ).fetchall()
        ]
        d["pending_followups"] = [
            dict(r) for r in self._conn.execute(
                "SELECT * FROM follow_ups WHERE parent_phone = ? AND status = 'pending'",
                (parent_phone,),
            ).fetchall()
        ]
        return d

    def get_sentiment_distribution(self) -> dict:
        """Sentiment breakdown across all analyzed calls."""
        rows = self._conn.execute(
            """SELECT parent_sentiment, COUNT(*) as count
               FROM call_insights WHERE parent_sentiment != ''
               GROUP BY parent_sentiment ORDER BY count DESC"""
        ).fetchall()
        return {r["parent_sentiment"]: r["count"] for r in rows}

    def get_concern_summary(self) -> list[dict]:
        """Top unresolved concerns across all parents, by frequency."""
        rows = self._conn.execute(
            """SELECT category, COUNT(*) as count,
                      SUM(CASE WHEN severity IN ('high', 'critical') THEN 1 ELSE 0 END) as high_severity
               FROM parent_concerns
               WHERE status != 'resolved'
               GROUP BY category
               ORDER BY count DESC"""
        ).fetchall()
        return [dict(r) for r in rows]

    def close(self):
        self._conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _classify_reason(reason: str) -> str:
    """Map free-text reason to category enum."""
    reason_lower = reason.lower()
    if any(w in reason_lower for w in ("absent", "attendance", "not coming", "nahi aa")):
        return "consecutive_absences"
    if any(w in reason_lower for w in ("exam", "marks", "score", "performance", "padhai", "result")):
        return "poor_performance"
    if any(w in reason_lower for w in ("behav", "fight", "discipline", "bully", "vyavhar")):
        return "behavioral_concern"
    if any(w in reason_lower for w in ("good", "improv", "excellent", "positive", "proud")):
        return "positive_feedback"
    return "other"
