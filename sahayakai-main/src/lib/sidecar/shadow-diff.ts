/**
 * Shadow-mode parity capture for parent-call-agent.
 *
 * In `shadow` mode the dispatcher (Track A4) calls Genkit AND the
 * sidecar in parallel, returns the Genkit reply to Twilio, and writes a
 * paired (genkit, sidecar) sample to Firestore at:
 *
 *   agent_shadow_diffs/{YYYY-MM-DD}/shadow_calls/{callSid}__{turnNumber:04d}
 *
 * The offline parity comparator (`sahayakai-agents/scripts/compare_parity.py`,
 * once wired) scores these pairs with IndicSBERT cosine + Gemini-2.5-Pro
 * LLM-judge before any traffic ramp. The dispatcher must NEVER await
 * this writer — it is fire-and-forget and lives behind a try/catch so a
 * Firestore outage cannot affect the parent-call response.
 *
 * Document TTL is 14 days via `expireAt` (Firestore TTL policy applied
 * at deploy time on the `expireAt` field). 14 days is a deliberate
 * compromise between (a) keeping enough rolling history to detect a
 * weekly regression and (b) DPDP-style data minimisation — no shadow
 * sample lives longer than two weekly review cycles.
 *
 * Round-2 audit reference: P1 PARITY-1 (shadow capture must be
 * non-blocking), DPDP-1 (TTL on user-derived parity samples).
 */

import { getDb } from '@/lib/firebase-admin';

const SHADOW_TTL_HOURS = 14 * 24; // 14 days
const COLLECTION_ROOT = 'agent_shadow_diffs';
const MAX_REPLY_BYTES = 4_000;

export interface ShadowDiffSample {
  callSid: string;
  turnNumber: number;
  parentLanguage: string;
  /** What Genkit returned (the reply Twilio actually spoke). */
  genkitReply: string;
  /**
   * What the sidecar returned for the same input. May be `null` if the
   * sidecar errored — we still want the row so the comparator can
   * see the failure mode in aggregate.
   */
  sidecarReply: string | null;
  /** Set when the sidecar threw; used to bucket errors per-language. */
  sidecarError?: {
    type: string; // SidecarHttpError | SidecarTimeoutError | etc.
    message: string;
    elapsedMs?: number;
  };
  /** Latency observed on the sidecar path (ms). Useful for p95/p99. */
  sidecarLatencyMs?: number;
}

function todayUtc(): string {
  // YYYY-MM-DD in UTC; the rollup query is daily so timezone boundaries
  // matter. UTC keeps it deterministic across regions.
  return new Date().toISOString().slice(0, 10);
}

function clipReply(text: string | null): string | null {
  if (text === null) return null;
  if (text.length <= MAX_REPLY_BYTES) return text;
  return text.slice(0, MAX_REPLY_BYTES) + '…';
}

function docId(callSid: string, turnNumber: number): string {
  // Match the Python sidecar's composite-key pattern so a manual cross-
  // reference between agent_sessions and agent_shadow_diffs reads the
  // same way. Zero-pad to 4 for lex-order across the call.
  return `${callSid}__${String(turnNumber).padStart(4, '0')}`;
}

/**
 * Fire-and-forget shadow-diff writer. Returns a promise the caller MAY
 * `void` — failures are caught, logged, and swallowed. Never throws.
 */
export async function writeShadowDiff(sample: ShadowDiffSample): Promise<void> {
  try {
    const db = await getDb();
    const expireAt = new Date(Date.now() + SHADOW_TTL_HOURS * 60 * 60 * 1000);
    const dayDoc = todayUtc();

    await db
      .collection(COLLECTION_ROOT)
      .doc(dayDoc)
      .collection('shadow_calls')
      .doc(docId(sample.callSid, sample.turnNumber))
      .set({
        callSid: sample.callSid,
        turnNumber: sample.turnNumber,
        parentLanguage: sample.parentLanguage,
        genkitReply: clipReply(sample.genkitReply),
        sidecarReply: clipReply(sample.sidecarReply),
        sidecarError: sample.sidecarError ?? null,
        sidecarLatencyMs: sample.sidecarLatencyMs ?? null,
        capturedAt: new Date().toISOString(),
        expireAt, // Firestore TTL policy purges after this timestamp.
      });
  } catch (err) {
    // Swallow. The shadow-diff writer is best-effort and any error here
    // would already be logged by the wider request handler if it
    // mattered for the response. Crucially: do not rethrow — the
    // dispatcher does not await this.
    console.warn('[sidecar.shadow-diff] write failed (suppressed)', {
      callSid: sample.callSid,
      turnNumber: sample.turnNumber,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
