/**
 * A Riya call's synopsis: 3–6 short, factual bullets for staff, built from what the call record
 * and the provider actually hold (outcome, duration, collected answers, the transcript). It is
 * the ONLY account of the conversation the console shows; the transcript itself stays in the
 * database (opt-in, 7-day expiry) and is never sent to a browser.
 *
 * Two sources:
 *   - 'ai'    — written by the model from the transcript and answers (server/sampark/riya-synopsis.ts),
 *               then checked by `acceptSynopsis` (3–6 bullets, bounded length, no placeholders).
 *   - 'rules' — `rulesSynopsis`, deterministic, used when the model is unavailable or its output fails
 *               the checks. Never invents: every bullet restates a stored field.
 *
 * Lifecycle: a synopsis written before the provider's transcript is available (a status-only result,
 * an initiation failure, a post-call event with no turns) is 'provisional'. A synopsis written from a
 * real transcript is 'final'; a provisional one is replaced as soon as a transcript arrives (Check
 * status, auto-refresh or webhook), and a final one only by a more complete transcript (more spoken
 * turns) — never the other way round (`synopsisNeedsWrite`).
 * Pure: no I/O.
 */

import type { ConversationTranscriptTurn } from './types';

export const SYNOPSIS_MIN_BULLETS = 3;
export const SYNOPSIS_MAX_BULLETS = 6;
export const SYNOPSIS_MAX_BULLET_CHARS = 220;
export const CALLBACK_REQUEST_MAX_CHARS = 120;

export interface RiyaSynopsis {
    bullets: string[];
    /** The listener's own request to be called back, if they made one (bounded); null otherwise. */
    callbackRequest: string | null;
    source: 'ai' | 'rules';
    generatedAt: string;
    /** 'final' once written from the provider's transcript; 'provisional' while none was available. Absent on early records. */
    status?: 'provisional' | 'final';
    /** Spoken turns in the transcript it was written from (0: none). */
    transcriptTurns?: number;
}

/** Early records carry no status: a model-written one had a transcript; a rules one may not have. */
export function isFinalSynopsis(s: RiyaSynopsis | null | undefined): boolean {
    if (!s) return false;
    return s.status ? s.status === 'final' : s.source === 'ai';
}

/**
 * Whether a synopsis should be (re)written from a transcript with `turns` spoken turns: when there is
 * none yet; a provisional one once any transcript arrives; a final one only when a later delivery is
 * more complete (more spoken turns) than the one it was written from, so a partial transcript never
 * locks in an incomplete summary and an equal or poorer delivery never costs another model call.
 * Early final records (no turn count) are kept as they are.
 */
export function synopsisNeedsWrite(s: RiyaSynopsis | null | undefined, turns: number): boolean {
    if (!s) return true;
    if (!isFinalSynopsis(s)) return turns > 0;
    return typeof s.transcriptTurns === 'number' && turns > s.transcriptTurns;
}

/** Spoken (non-empty) turns. */
export function spokenTurns(transcript: readonly ConversationTranscriptTurn[]): number {
    return transcript.filter((t) => t.message.trim()).length;
}

export interface SynopsisInput {
    /** Human label of the workflow, e.g. "PTM invitation". */
    purposeLabel: string;
    /** The line Riya was given to deliver (staff-confirmed). */
    announcement: string | null;
    outcome: 'completed' | 'no_answer' | 'busy' | 'failed' | 'unknown';
    durationSeconds: number | null;
    /** Collected answers, known keys only; 'not_applicable' and empty values are ignored. */
    answers: Record<string, string | null>;
    stopRequested: boolean;
    transcript: ConversationTranscriptTurn[];
}

const NOTHING = new Set(['', 'not_applicable', 'n/a', 'none', 'null', 'no answer', 'unknown']);

function clean(text: string, max = SYNOPSIS_MAX_BULLET_CHARS): string {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Meaningful collected answers, in a stable order. */
export function meaningfulAnswers(answers: Record<string, string | null>): [string, string][] {
    return Object.entries(answers)
        .filter((e): e is [string, string] => typeof e[1] === 'string' && !NOTHING.has(e[1].trim().toLowerCase()))
        .sort(([a], [b]) => a.localeCompare(b));
}

/** The listener's callback request as collected by the agent, if any. */
export function collectedCallbackRequest(answers: Record<string, string | null>): string | null {
    const raw = answers.callback_requested_time;
    if (typeof raw !== 'string' || NOTHING.has(raw.trim().toLowerCase()) || raw.trim().toLowerCase() === 'no') return null;
    return clean(raw, CALLBACK_REQUEST_MAX_CHARS);
}

const OUTCOME_TEXT: Record<SynopsisInput['outcome'], string> = {
    completed: 'the call connected and ended normally',
    no_answer: 'nobody answered',
    busy: 'the line was busy',
    failed: 'the call could not be placed',
    unknown: 'the outcome could not be confirmed',
};

/** Deterministic synopsis: only restates stored facts. Always 3–6 bullets. */
export function rulesSynopsis(input: SynopsisInput, nowIso: string): RiyaSynopsis {
    const bullets: string[] = [];
    const spoken = input.transcript.filter((t) => t.message.trim());
    const listenerTurns = spoken.filter((t) => t.role === 'user').length;
    const duration = input.durationSeconds !== null ? `, ${Math.round(input.durationSeconds)} s` : '';
    bullets.push(clean(`${input.purposeLabel} call: ${OUTCOME_TEXT[input.outcome]}${duration}.`));
    const opening = spoken.find((t) => t.role === 'agent')?.message ?? '';
    if (input.outcome === 'completed') {
        // Each claim only when the opening line actually says it.
        const ai = /\bAI assistant\b/i.test(opening);
        const transcribed = /\btranscri/i.test(opening);
        bullets.push(ai && transcribed
            ? 'Riya introduced herself as an AI assistant and said the call is transcribed.'
            : ai ? 'Riya introduced herself as an AI assistant.'
            : spoken.length > 0 ? 'Riya opened the call.' : 'No conversation was recorded.');
        bullets.push(listenerTurns === 0 ? 'The listener did not speak.' : `The listener replied ${listenerTurns} time${listenerTurns === 1 ? '' : 's'}.`);
    }
    // The answers themselves are shown beside the synopsis (their own stored field); only count them here.
    const answered = meaningfulAnswers(input.answers).filter(([k]) => k !== 'callback_requested_time' && k !== 'stop_requested').length;
    if (answered > 0) bullets.push(`Riya collected ${answered} answer${answered === 1 ? '' : 's'} from the listener.`);
    const callback = collectedCallbackRequest(input.answers);
    if (callback) bullets.push(clean(`Asked to be called back: "${callback}".`));
    if (input.stopRequested) bullets.push('Asked not to be called again; the office should confirm.');
    if (input.outcome === 'completed' && meaningfulAnswers(input.answers).length === 0) bullets.push('Riya collected no answers on this call.');
    while (bullets.length < SYNOPSIS_MIN_BULLETS) bullets.push(bullets.length === 1 ? 'Riya did not reach anyone.' : 'No further details were recorded.');
    return { bullets: bullets.slice(0, SYNOPSIS_MAX_BULLETS), callbackRequest: callback, source: 'rules', generatedAt: nowIso };
}

/**
 * Accepts a model-written synopsis only if it is well formed: 3–6 non-empty bullets, each bounded,
 * none with leftover placeholders or the word "null". Returns null to fall back to the rules.
 */
export function acceptSynopsis(raw: { bullets?: unknown; callbackRequest?: unknown } | null | undefined, nowIso: string): RiyaSynopsis | null {
    if (!raw || !Array.isArray(raw.bullets)) return null;
    const bullets = raw.bullets
        .filter((b): b is string => typeof b === 'string')
        .map((b) => clean(b.replace(/^[-•*\s]+/, '')))
        .filter((b) => b.length > 0);
    if (bullets.length < SYNOPSIS_MIN_BULLETS || bullets.length > SYNOPSIS_MAX_BULLETS) return null;
    if (bullets.some((b) => /\{\{|\}\}|\bnull\b|\bundefined\b/i.test(b))) return null;
    // Only a person scheduling it in the calendar makes a callback scheduled; the model cannot know that.
    if (bullets.some((b) => /\bcall(?:ed)?[\s-]?back\b.*\b(?:scheduled|booked|arranged|confirmed)\b|\b(?:scheduled|booked|arranged)\b.*\bcall[\s-]?back\b/i.test(b))) return null;
    const cb = typeof raw.callbackRequest === 'string' && !NOTHING.has(raw.callbackRequest.trim().toLowerCase())
        ? clean(raw.callbackRequest, CALLBACK_REQUEST_MAX_CHARS)
        : null;
    return { bullets, callbackRequest: cb, source: 'ai', generatedAt: nowIso };
}
