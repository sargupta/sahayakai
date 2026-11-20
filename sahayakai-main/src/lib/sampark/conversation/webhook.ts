/**
 * ElevenLabs post-call webhooks — authenticity and a bounded, normalised parse.
 *
 * Signature (ElevenLabs docs, "Post-call webhooks", and the official SDKs'
 * constructEvent): header `ElevenLabs-Signature: t=<unix seconds>,v0=<hex>` where
 * hex = HMAC-SHA256(secret, `${t}.${rawBody}`). Several v0 values may be present
 * (secret rotation); any one matching is enough. Deliveries older than 30 minutes
 * (or more than 5 minutes in the future) are refused, so a captured request cannot
 * be replayed later. The comparison is constant-time.
 *
 * The signature only proves ElevenLabs sent the bytes. It does NOT prove the event is
 * about one of our calls: the handler still checks the agent id against our
 * configuration and resolves the conversation id through our own link record, and
 * the event's content is treated as untrusted data (bounded sizes, closed keys).
 */

import crypto from 'node:crypto';

import { z } from 'zod';

import { RIYA_DATA_COLLECTION_KEYS, type ConversationTranscriptTurn, type RiyaDataCollection } from './types';

export const SIGNATURE_TOLERANCE_SECONDS = 30 * 60;
export const SIGNATURE_FUTURE_SKEW_SECONDS = 5 * 60;
/** Larger bodies are refused before parsing (transcripts of a 10-minute call are far smaller; audio events are not subscribed). */
export const MAX_WEBHOOK_BYTES = 512 * 1024;
export const MAX_TRANSCRIPT_TURNS = 80;
export const MAX_TURN_CHARS = 1000;
export const MAX_DATA_VALUE_CHARS = 200;

export type SignatureVerdict = { ok: true; timestamp: number } | { ok: false; reason: 'missing' | 'malformed' | 'stale' | 'future' | 'mismatch' | 'no_secret' };

export function verifyElevenLabsSignature(rawBody: string, header: string | null | undefined, secret: string | null | undefined, nowSeconds: number): SignatureVerdict {
    if (!secret) return { ok: false, reason: 'no_secret' };
    if (!header) return { ok: false, reason: 'missing' };
    let timestamp: number | null = null;
    const signatures: string[] = [];
    for (const part of header.split(',')) {
        const [k, ...rest] = part.trim().split('=');
        const v = rest.join('=');
        if (k === 't' && /^\d{1,12}$/.test(v)) timestamp = Number(v);
        else if (k === 'v0' && /^[0-9a-f]{64}$/i.test(v)) signatures.push(v.toLowerCase());
    }
    if (timestamp === null || signatures.length === 0) return { ok: false, reason: 'malformed' };
    if (nowSeconds - timestamp > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'stale' };
    if (timestamp - nowSeconds > SIGNATURE_FUTURE_SKEW_SECONDS) return { ok: false, reason: 'future' };
    const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'), 'utf8');
    const match = signatures.some((sig) => {
        const given = Buffer.from(sig, 'utf8');
        return given.length === expected.length && crypto.timingSafeEqual(given, expected);
    });
    return match ? { ok: true, timestamp } : { ok: false, reason: 'mismatch' };
}

// ── Payload ─────────────────────────────────────────────────────────────────

const Id = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);

const TranscriptTurn = z
    .object({
        role: z.string().max(20),
        message: z.string().nullable().optional(),
        time_in_call_secs: z.number().nullable().optional(),
    })
    .passthrough();

const PostCallTranscription = z
    .object({
        type: z.literal('post_call_transcription'),
        event_timestamp: z.number().int().nonnegative(),
        data: z
            .object({
                agent_id: Id,
                conversation_id: Id,
                status: z.string().max(40),
                user_id: z.string().max(200).nullable().optional(),
                transcript: z.array(TranscriptTurn).max(2000).nullable().optional(),
                metadata: z
                    .object({
                        call_duration_secs: z.number().nonnegative().max(86_400).nullable().optional(),
                        termination_reason: z.string().nullable().optional(),
                    })
                    .passthrough()
                    .nullable()
                    .optional(),
                analysis: z
                    .object({
                        call_successful: z.string().max(20).nullable().optional(),
                        data_collection_results: z.record(z.unknown()).nullable().optional(),
                    })
                    .passthrough()
                    .nullable()
                    .optional(),
                conversation_initiation_client_data: z
                    .object({ user_id: z.string().max(200).nullable().optional() })
                    .passthrough()
                    .nullable()
                    .optional(),
            })
            .passthrough(),
    })
    .passthrough();

const CallInitiationFailure = z
    .object({
        type: z.literal('call_initiation_failure'),
        event_timestamp: z.number().int().nonnegative(),
        data: z
            .object({
                agent_id: Id,
                conversation_id: Id,
                failure_reason: z.string().max(40).nullable().optional(),
            })
            .passthrough(),
    })
    .passthrough();

export type RiyaWebhookEvent =
    | {
          kind: 'post_call';
          eventId: string;
          eventTimestamp: number;
          agentId: string;
          conversationId: string;
          userId: string | null;
          status: string;
          durationSeconds: number | null;
          terminationReason: string | null;
          callSuccessful: 'success' | 'failure' | 'unknown' | null;
          dataCollection: RiyaDataCollection;
          transcript: ConversationTranscriptTurn[];
      }
    | {
          kind: 'initiation_failure';
          eventId: string;
          eventTimestamp: number;
          agentId: string;
          conversationId: string;
          failureReason: 'busy' | 'no-answer' | 'unknown';
      }
    | { kind: 'ignored'; type: string };

function shortString(v: unknown, max: number): string | null {
    if (v === null || v === undefined) return null;
    const s = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;
    if (s === null) return null;
    const trimmed = s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return trimmed === '' ? null : trimmed.slice(0, max);
}

/** ElevenLabs sends each data-collection result as `{ data_collection_id, value, rationale, json_schema }`; only `value` is kept. */
export function normaliseDataCollection(results: Record<string, unknown> | null | undefined): RiyaDataCollection {
    const out: RiyaDataCollection = {};
    if (!results) return out;
    for (const key of RIYA_DATA_COLLECTION_KEYS) {
        if (!(key in results)) continue;
        const entry = results[key];
        const value = entry && typeof entry === 'object' && 'value' in (entry as object) ? (entry as { value: unknown }).value : entry;
        out[key] = shortString(value, MAX_DATA_VALUE_CHARS);
    }
    return out;
}

function normaliseTranscript(turns: z.infer<typeof TranscriptTurn>[] | null | undefined): ConversationTranscriptTurn[] {
    if (!turns) return [];
    return turns
        .filter((t) => t.role === 'agent' || t.role === 'user')
        .slice(0, MAX_TRANSCRIPT_TURNS)
        .map((t) => ({
            role: t.role as 'agent' | 'user',
            message: shortString(t.message, MAX_TURN_CHARS) ?? '',
            timeInCallSecs: typeof t.time_in_call_secs === 'number' ? t.time_in_call_secs : null,
        }));
}

function callSuccessful(v: string | null | undefined): 'success' | 'failure' | 'unknown' | null {
    return v === 'success' || v === 'failure' || v === 'unknown' ? v : null;
}

/** Parse a verified body. Returns null for a body we cannot read (the route answers 400). */
export function parseRiyaWebhook(rawBody: string): RiyaWebhookEvent | null {
    let json: unknown;
    try {
        json = JSON.parse(rawBody);
    } catch {
        return null;
    }
    const type = (json as { type?: unknown })?.type;
    if (type === 'post_call_transcription') {
        const p = PostCallTranscription.safeParse(json);
        if (!p.success) return null;
        const d = p.data.data;
        return {
            kind: 'post_call',
            eventId: `post_call:${d.conversation_id}`,
            eventTimestamp: p.data.event_timestamp,
            agentId: d.agent_id,
            conversationId: d.conversation_id,
            userId: shortString(d.user_id ?? d.conversation_initiation_client_data?.user_id, 200),
            status: d.status,
            durationSeconds: d.metadata?.call_duration_secs ?? null,
            terminationReason: shortString(d.metadata?.termination_reason, 300),
            callSuccessful: callSuccessful(d.analysis?.call_successful),
            dataCollection: normaliseDataCollection(d.analysis?.data_collection_results ?? null),
            transcript: normaliseTranscript(d.transcript),
        };
    }
    if (type === 'call_initiation_failure') {
        const p = CallInitiationFailure.safeParse(json);
        if (!p.success) return null;
        const reason = p.data.data.failure_reason;
        return {
            kind: 'initiation_failure',
            eventId: `initiation_failure:${p.data.data.conversation_id}`,
            eventTimestamp: p.data.event_timestamp,
            agentId: p.data.data.agent_id,
            conversationId: p.data.data.conversation_id,
            failureReason: reason === 'busy' || reason === 'no-answer' ? reason : 'unknown',
        };
    }
    return typeof type === 'string' ? { kind: 'ignored', type: type.slice(0, 60) } : null;
}

/**
 * Phrases that mean "stop calling me", in every language a family may answer in. Used only
 * when the agent has no `stop_requested` data-collection field; a match never suppresses
 * directly — it marks the call for the office, exactly as an unconfirmed keypad 9 does.
 *
 * Riya speaks English, but parents answer in the language they think in, and the recogniser
 * writes what it hears in either the native script or Latin letters. So each of Hindi,
 * Bengali and Nepali is matched in both. Text is folded first (foldForStopMatch): NFC,
 * nukta and zero-width joiners removed, lower case, single spaces — so फ़ोन and फोन, or
 * बंद and बन्द, are one word. JavaScript's \b is ASCII-only, so the Indic patterns use
 * plain substrings that are specific enough on their own.
 *
 * Patterns are written in folded form (no nukta: সরি not সরিয়ে). Deliberately NOT matched:
 * "phone mat kaato" (don't hang up), "call na kar paya" (couldn't call), Hindi "कल नगर…"
 * (tomorrow, city …). Each pattern has a positive and a near-miss case in
 * src/__tests__/sampark/conversation/riya-stop-phrases.test.ts.
 */
export const STOP_PHRASES: Readonly<Record<'English' | 'Hindi' | 'Bengali' | 'Nepali', readonly RegExp[]>> = {
    English: [
        /\bstop (calling|these calls|this call|the calls)\b/,
        /\bdon'?t call (me|us|again|this number)\b/,
        /\bdo not call (me|us|again|this number)\b/,
        /\bnever call\b/,
        /\bremove (my|this) number\b/,
        /\bunsubscribe\b/,
    ],
    Hindi: [
        // फोन/कॉल मत करो · मत करें · मत कीजिए · मत करना (also "दोबारा/बार बार फोन मत करो")
        /(फोन|कॉल|काल) मत (कर|की)/,
        /(फोन|कॉल|काल) (न|ना) (करें|करो|कीजिए|करना|करिए)/,
        // फोन करना बंद करो / करें / कीजिए
        /(फोन|कॉल|काल) करना (बंद|बन्द)/,
        // मेरा नंबर हटाओ / हटा दो / हटा दीजिए
        /(मेरा|ये|यह) (नंबर|नम्बर) हटा/,
        /\b(phone|fone|call|kol) (mat|na) (karo|karna|kijiye|kijie|kariye|karie|karein|karen|kare)\b/,
        /\b(phone|fone|call) karna band\b/,
        /\b(mera|ye|yeh) number hata(o|do|dein|de|iye|ie)?\b/,
    ],
    Bengali: [
        // ফোন/কল করবেন না · করো না · কোরো না (also "আর ফোন করবেন না")
        /(ফোন|কল) (করবেন|করো|কোরো) না/,
        // ফোন করা বন্ধ করুন
        /(ফোন|কল) করা বন্ধ/,
        // আমার নম্বর মুছে দিন / বাদ দিন / সরিয়ে দিন
        /(আমার|এই) (নম্বর|নাম্বার) (মুছে|বাদ|সরি)/,
        /\b(phone|fon|call|kol) (korben|koro) na\b/,
        /\b(phone|fon|call) kora bondho\b/,
    ],
    Nepali: [
        // फोन/कल नगर्नुहोस् · नगर्नु · नगर्नूस् (also "फेरि फोन नगर्नुहोस्"); never bare नगर (city)
        /(फोन|कल) नगर्न/,
        // फोन गर्न बन्द गर्नुहोस्
        /(फोन|कल) गर्न (बन्द|बंद)/,
        // मेरो नम्बर हटाउनुहोस्
        /(मेरो|यो) (नम्बर|नंबर) हटा/,
        /\b(phone|fon|call) nagar(nu|nuhos|nuhosh|nus|noos)\b/,
        /\b(phone|fon|call) garna banda\b/,
    ],
};

const ALL_STOP_PHRASES: readonly RegExp[] = Object.values(STOP_PHRASES).flat();

/** Folds a transcript turn so script and spelling variants match one pattern. Exported for tests. */
export function foldForStopMatch(text: string): string {
    return text
        .normalize('NFC')
        .replace(/[\u093C\u09BC\u200C\u200D]/g, '') // Devanagari and Bengali nukta, ZWNJ, ZWJ
        .replace(/[\u2018\u2019]/g, "'")
        .toLowerCase()
        .replace(/[\s\u0964\u0965.,!?;:]+/g, ' ') // whitespace, danda, punctuation
        .trim();
}

export function transcriptRequestsStop(transcript: readonly ConversationTranscriptTurn[]): boolean {
    return transcript.some((t) => {
        if (t.role !== 'user') return false;
        const text = foldForStopMatch(t.message);
        return ALL_STOP_PHRASES.some((re) => re.test(text));
    });
}
