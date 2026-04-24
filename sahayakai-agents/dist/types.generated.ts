// GENERATED FROM sahayakai-agents/src/sahayakai_agents/agents/parent_call/schemas.py
// DO NOT EDIT. Regenerate via `python scripts/codegen_ts.py`.
//
// Source of truth: the Pydantic models in schemas.py. TypeScript types
// are generated from those models for consumption by the Next.js
// sidecar client.

// ---- Enums and literal unions --------------------------------------
export type ParentLanguage = 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'pa' | 'ml' | 'or';
export type ParentSentiment = 'cooperative' | 'concerned' | 'grateful' | 'upset' | 'indifferent' | 'confused';
export type CallQuality = 'productive' | 'brief' | 'difficult' | 'unanswered';

// ---- Transcript turn -----------------------------------------------
export interface TranscriptTurn {
  role: 'agent' | 'parent';
  text: string;
}

// ---- Reply (per-turn) ----------------------------------------------
export interface AgentReplyRequest {
  callSid: string;
  turnNumber: number;
  studentName: string;
  className: string;
  subject: string;
  reason: string;
  teacherMessage: string;
  teacherName?: string | null;
  schoolName?: string | null;
  parentLanguage: 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'pa' | 'ml' | 'or';
  parentSpeech: string;
  performanceSummary?: string | null;
  transcript?: TranscriptTurn[] | null;
}

export interface AgentReplyResponse {
  reply: string;
  shouldEndCall: boolean;
  followUpQuestion?: string | null;
  sessionId: string;
  turnNumber: number;
  latencyMs: number;
  modelUsed: string;
  cacheHitRatio?: number | null;
}

// ---- Summary (post-call) -------------------------------------------
export interface CallSummaryRequest {
  callSid: string;
  studentName: string;
  className: string;
  subject: string;
  reason: string;
  teacherMessage: string;
  teacherName?: string | null;
  schoolName?: string | null;
  parentLanguage: 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'pa' | 'ml' | 'or';
  transcript: TranscriptTurn[];
  callDurationSeconds?: number | null;
}

export interface CallSummaryResponse {
  parentResponse: string;
  parentConcerns: string[];
  parentCommitments: string[];
  actionItemsForTeacher: string[];
  guidanceGiven: string[];
  parentSentiment: 'cooperative' | 'concerned' | 'grateful' | 'upset' | 'indifferent' | 'confused';
  callQuality: 'productive' | 'brief' | 'difficult' | 'unanswered';
  followUpNeeded: boolean;
  followUpSuggestion?: string | null;
  sessionId: string;
  latencyMs: number;
  modelUsed: string;
  cacheHitRatio?: number | null;
}

// ---- Error envelope ------------------------------------------------
export interface WireError {
  code: string;
  message: string;
  retryAfterSeconds?: number | null;
  traceId?: string | null;
}

export interface WireErrorEnvelope {
  error: WireError;
}
