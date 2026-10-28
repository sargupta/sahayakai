import 'server-only';

/**
 * Server side of the SamparkAI demo: the AI agent's next line and the
 * post-call summary, for a call the presenter plays in the browser (they
 * speak as the parent; no phone rings). Uses the same Genkit agent as
 * Sahayak's parent calls, so the demo shows the real behaviour, including
 * the calm-under-pressure and complaint rules.
 *
 * Public by design (the demo link has no sign-in), so it is:
 *   - off unless SAMPARK_DEMO_ENABLED=true (404 otherwise);
 *   - bounded: strict schemas, short transcripts, a per-address and a
 *     per-instance budget;
 *   - free of real data: the only inputs are the fictional school's names.
 * If the AI is unreachable the call continues on a scripted fallback, and the
 * response says so.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAgentReply, generateCallSummary } from '@/ai/flows/parent-call-agent';
import { fallbackReply } from '@/lib/sampark/demo/script';
import type { DemoCallContext, DemoSummary, DemoTurn } from '@/lib/sampark/demo/types';

export function demoEnabled(): boolean {
    return process.env.SAMPARK_DEMO_ENABLED === 'true';
}

const MAX_TURNS = 24;
const MAX_TEXT = 600;

const ContextSchema = z.object({
    studentName: z.string().min(1).max(80),
    className: z.string().min(1).max(40),
    subject: z.string().min(1).max(40),
    reason: z.enum(['consecutive_absences', 'poor_performance', 'behavioral_concern', 'positive_feedback']),
    teacherMessage: z.string().min(1).max(MAX_TEXT),
    teacherName: z.string().min(1).max(80),
    schoolName: z.string().min(1).max(80),
    parentLanguage: z.enum(['en', 'hi']),
});

const TurnSchema = z.object({ role: z.enum(['agent', 'parent']), text: z.string().min(1).max(MAX_TEXT) });

const TurnRequest = z.object({
    callId: z.string().min(1).max(64),
    context: ContextSchema,
    transcript: z.array(TurnSchema).max(MAX_TURNS),
    parentSpeech: z.string().min(1).max(MAX_TEXT),
    turnNumber: z.number().int().min(1).max(12),
});

const SummaryRequest = z.object({
    callId: z.string().min(1).max(64),
    context: ContextSchema,
    transcript: z.array(TurnSchema).min(1).max(MAX_TURNS),
    durationSeconds: z.number().int().min(0).max(3600),
});

// ── Budget ───────────────────────────────────────────────────────────────────

const WINDOW_MS = 10 * 60_000;
const PER_ADDRESS = 60;
const PER_INSTANCE_PER_DAY = 4000;
const hits = new Map<string, number[]>();
let day = { start: Date.now(), count: 0 };

function overBudget(address: string): boolean {
    const now = Date.now();
    if (now - day.start > 24 * 3_600_000) day = { start: now, count: 0 };
    if (day.count >= PER_INSTANCE_PER_DAY) return true;
    const recent = (hits.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= PER_ADDRESS) return true;
    recent.push(now);
    hits.set(address, recent);
    if (hits.size > 5000) hits.clear();
    day.count++;
    return false;
}

function addressOf(req: Request): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

async function guard(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
    if (!demoEnabled()) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    if (overBudget(addressOf(req))) return { ok: false, res: NextResponse.json({ error: 'The demo is busy. Try again in a few minutes.' }, { status: 429 }) };
    try {
        return { ok: true, body: await req.json() };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
    }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function handleDemoTurn(req: Request): Promise<NextResponse> {
    const g = await guard(req);
    if (!g.ok) return g.res;
    const parsed = TurnRequest.safeParse(g.body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { callId, context, transcript, parentSpeech, turnNumber } = parsed.data;

    try {
        const out = await generateAgentReply({
            ...context,
            transcript,
            parentSpeech,
            turnNumber,
            callSid: `demo-${callId}`,
        });
        return NextResponse.json({ reply: out.reply, shouldEndCall: out.shouldEndCall, source: 'ai' });
    } catch (err) {
        console.warn('[sampark-demo] agent reply fell back to script', { error: err instanceof Error ? err.name : 'unknown' });
        const out = fallbackReply(context as DemoCallContext, parentSpeech, turnNumber);
        return NextResponse.json({ ...out, source: 'fallback' });
    }
}

export async function handleDemoSummary(req: Request): Promise<NextResponse> {
    const g = await guard(req);
    if (!g.ok) return g.res;
    const parsed = SummaryRequest.safeParse(g.body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { callId, context, transcript, durationSeconds } = parsed.data;

    try {
        const out = await generateCallSummary({
            ...context,
            teacherLanguage: 'en',
            transcript,
            callSid: `demo-${callId}`,
            callDurationSeconds: durationSeconds,
        });
        return NextResponse.json({ summary: normalizeSummary(out), source: 'ai' });
    } catch (err) {
        console.warn('[sampark-demo] summary fell back to script', { error: err instanceof Error ? err.name : 'unknown' });
        return NextResponse.json({ summary: fallbackSummary(context as DemoCallContext, transcript), source: 'fallback' });
    }
}

/** Models sometimes write the word "null" (or "none") instead of leaving a field empty. */
function present(value: string | null | undefined): string | null {
    const v = value?.trim();
    return v && !/^(null|none|n\/?a|undefined|nil|-)\.?$/i.test(v) ? v : null;
}

/** Empty or "null" complaint text means no complaint; any complaint means a follow-up. */
export function normalizeSummary(out: Omit<DemoSummary, 'complaintAboutTeacher'> & { complaintAboutTeacher?: string | null }): DemoSummary {
    const complaint = present(out.complaintAboutTeacher);
    return {
        ...out,
        followUpSuggestion: present(out.followUpSuggestion) ?? undefined,
        complaintAboutTeacher: complaint,
        followUpNeeded: out.followUpNeeded || Boolean(complaint),
    };
}

/** A plain summary built from the transcript when the AI cannot write one. */
function fallbackSummary(ctx: DemoCallContext, transcript: DemoTurn[]): DemoSummary {
    const parentLines = transcript.filter((t) => t.role === 'parent').map((t) => t.text);
    const all = parentLines.join(' ');
    const complaint = parentLines.find((l) => /teacher|shout|scold|ma'?am|sir|टीचर|चिल्ला|डांट/i.test(l)) ?? null;
    const angry = /!|always|blame|every time|हमेशा|हर बार|दोष/i.test(all);
    const meet = /meet|come to school|मिलना/i.test(all);
    return {
        parentResponse: parentLines.length ? `The parent said: “${parentLines[parentLines.length - 1].slice(0, 200)}”` : 'The parent did not say much.',
        parentConcerns: angry ? ['Feels the child is being blamed'] : [],
        parentCommitments: meet ? ['Wants to meet the teacher'] : [],
        actionItemsForTeacher: [complaint ? 'Principal and teacher to review the parent’s complaint' : `Follow up with ${ctx.studentName.split(' ')[0]}’s family next week`],
        guidanceGiven: [],
        parentSentiment: angry || complaint ? 'upset' : 'cooperative',
        callQuality: angry || complaint ? 'difficult' : parentLines.length > 1 ? 'productive' : 'brief',
        followUpNeeded: Boolean(angry || complaint || meet),
        followUpSuggestion: meet ? 'Call the parent to fix a meeting time.' : undefined,
        complaintAboutTeacher: complaint ? `The parent said: “${complaint.slice(0, 300)}”` : null,
    };
}
