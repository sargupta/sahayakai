/**
 * Generic shadow-diff writer (Phase M.5).
 *
 * Replaces the 13 non-parent-call dispatchers' console.log shadow-mode
 * reporting with Firestore writes that the offline aggregator can roll
 * up. Before this lands, only the parent-call dispatcher persisted its
 * (genkit, sidecar) pairs to Firestore via `shadow-diff.ts`; the other
 * 13 dispatchers (vidya, quiz, lesson-plan, exam-paper, instant-answer,
 * rubric, teacher-training, video-storyteller, virtual-field-trip,
 * visual-aid, voice-to-text, worksheet, parent-message,
 * avatar-generator) only logged a single line to stdout. That meant
 * the FIRST canary flip for any of those 13 was effectively blind —
 * we had no offline parity score to gate the ramp on.
 *
 * Wire shape: `agent_shadow_diffs/{YYYY-MM-DD}/{agent}/{uid}__{ts}`
 *
 * Compatibility note: parent-call's existing writer at `shadow-diff.ts`
 * uses the subcollection `shadow_calls` with doc IDs
 * `{callSid}__{turnNumber:04d}`. This writer keeps those calls in
 * their own subcollection (`shadow_calls`) and segregates ALL other
 * agents under their own per-agent subcollections. The aggregator
 * iterates all subcollections under `{date}` and computes per-agent
 * rollups, so both layouts coexist.
 *
 * The writer is fail-soft — Firestore unavailability MUST NEVER break
 * the user-visible response. The dispatcher always treats this as
 * fire-and-forget (`void writeAgentShadowDiff(...)`).
 *
 * Phase M.5 §M.5.
 */

import { format } from 'date-fns';

import { getDb } from '@/lib/firebase-admin';

/**
 * Agent name used as the Firestore subcollection key. Keep this in
 * sync with the `agent` literal each dispatcher passes.
 */
export type AgentShadowAgent =
    | 'vidya'
    | 'quiz'
    | 'lesson-plan'
    | 'exam-paper'
    | 'instant-answer'
    | 'rubric'
    | 'teacher-training'
    | 'video-storyteller'
    | 'virtual-field-trip'
    | 'visual-aid'
    | 'voice-to-text'
    | 'worksheet'
    | 'parent-message'
    | 'avatar-generator';

/**
 * Genkit + sidecar payloads are typed independently — the dispatcher
 * shapes diverge slightly (e.g. sidecar exam-paper sections allow null
 * options where Genkit's union doesn't). Two type parameters keep
 * each side accurate without forcing a unified intermediate type.
 */
export interface AgentShadowSample<TGenkit = unknown, TSidecar = TGenkit> {
    /** Subcollection name. Stable agent identifier. */
    agent: AgentShadowAgent;
    /** Authenticated teacher uid. Used as the doc-id prefix. */
    uid: string;
    /** What Genkit returned. May be `null` if Genkit itself errored. */
    genkit: TGenkit | null;
    /** What the sidecar returned. May be `null` if the sidecar errored. */
    sidecar: TSidecar | null;
    /** Latency observed on the Genkit path (ms). */
    genkitLatencyMs: number;
    /** Latency observed on the sidecar path (ms). */
    sidecarLatencyMs: number;
    /** True if the sidecar attempt succeeded. */
    sidecarOk: boolean;
    /** Free-form error message when `sidecarOk === false`. */
    sidecarError?: string;
}

const COLLECTION_ROOT = 'agent_shadow_diffs';

/**
 * Fire-and-forget shadow-diff writer for all dispatchers other than
 * parent-call. Returns a promise the caller MAY `void` — failures are
 * caught, logged, and swallowed. Never throws.
 */
export async function writeAgentShadowDiff<TGenkit, TSidecar = TGenkit>(
    sample: AgentShadowSample<TGenkit, TSidecar>,
): Promise<void> {
    try {
        // YYYY-MM-DD bucket. Use UTC by piping through ISO-string slice
        // for symmetry with the parent-call writer (date-fns `format`
        // is local-tz; we want UTC so daily-rollup boundaries are
        // deterministic across regions).
        const date = format(new Date(), 'yyyy-MM-dd');
        const id = `${sample.uid}__${Date.now()}`;
        const db = await getDb();
        await db
            .collection(COLLECTION_ROOT)
            .doc(date)
            .collection(sample.agent)
            .doc(id)
            .set({
                ...sample,
                createdAt: new Date(),
            });
    } catch (err) {
        // Fail-soft: shadow logging must never break the user-visible
        // response. Same policy as the parent-call shadow-diff writer.
        // Emit a single structured warn line so the on-call can see
        // sustained Firestore failures in the dashboard.
        // eslint-disable-next-line no-console
        console.warn(
            JSON.stringify({
                event: 'shadow_diff_write_failed',
                agent: sample.agent,
                uid: sample.uid,
                error: err instanceof Error ? err.message : String(err),
            }),
        );
    }
}
