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
 *     per-instance budget spent only by valid requests;
 *   - free of real data: the browser names a demo student by id, and every
 *     name the model hears comes from the fictional school on the server.
 * If the AI is unreachable the call continues on a scripted fallback, and the
 * response says so.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateAgentReply, generateCallSummary } from '@/ai/flows/parent-call-agent';
import { classById, getDemoSchool, studentById, teacherById } from '@/lib/sampark/demo/school';
import { fallbackReply } from '@/lib/sampark/demo/script';
import type { DemoCallContext, DemoSummary, DemoTurn } from '@/lib/sampark/demo/types';

export function demoEnabled(): boolean {
    return process.env.SAMPARK_DEMO_ENABLED === 'true';
}

const MAX_TURNS = 24;
/** What a person types or says, and the teacher's note. */
const MAX_TEXT = 600;
/** An agent turn may run longer than a parent's; replies are capped to this. */
export const MAX_AGENT_TEXT = 1500;

const Reason = z.enum(['consecutive_absences', 'poor_performance', 'behavioral_concern', 'positive_feedback']);

/**
 * The browser names the call by demo record id only. School, student, class
 * and teacher names are built here from the fictional school, so an anonymous
 * caller cannot place text in the prompt outside its fenced, neutralised
 * fields (the note and the parent's words).
 */
const CallRequest = z.object({
    callId: z.string().min(1).max(64),
    studentId: z.string().min(1).max(16),
    reason: Reason,
    language: z.enum(['en', 'hi']),
    note: z.string().min(1).max(MAX_TEXT),
});

const TurnSchema = z.discriminatedUnion('role', [
    z.object({ role: z.literal('agent'), text: z.string().min(1).max(MAX_AGENT_TEXT) }),
    z.object({ role: z.literal('parent'), text: z.string().min(1).max(MAX_TEXT) }),
]);

const TurnRequest = CallRequest.extend({
    transcript: z.array(TurnSchema).max(MAX_TURNS),
    parentSpeech: z.string().min(1).max(MAX_TEXT),
    turnNumber: z.number().int().min(1).max(12),
});

const SummaryRequest = CallRequest.extend({
    transcript: z.array(TurnSchema).min(1).max(MAX_TURNS),
    durationSeconds: z.number().int().min(0).max(3600),
});

/** The call's context from the demo school, or null for an id that is not in it. */
export function demoCallContext(
    studentId: string,
    reason: DemoCallContext['reason'],
    language: DemoCallContext['parentLanguage'],
    note: string,
): DemoCallContext | null {
    const student = studentById(studentId);
    const cls = student ? classById(student.classId) : undefined;
    const teacher = cls ? teacherById(cls.teacherId) : undefined;
    if (!student || !cls || !teacher) return null;
    return {
        studentName: student.name,
        className: cls.name,
        subject: cls.subject,
        reason,
        teacherMessage: note,
        teacherName: teacher.spokenName,
        schoolName: getDemoSchool().name,
        parentLanguage: language,
    };
}

/** Cuts a reply at the last sentence end inside the limit. */
export function capReply(text: string, max = MAX_AGENT_TEXT): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '), cut.lastIndexOf('। '));
    return end > max * 0.5 ? cut.slice(0, end + 1) : cut;
}

// ── Budget ───────────────────────────────────────────────────────────────────

const WINDOW_MS = 10 * 60_000;
const PER_ADDRESS = 60;
const PER_INSTANCE_PER_DAY = 4000;
const MAX_TRACKED = 5000;
const hits = new Map<string, number[]>();
let day = { start: Date.now(), count: 0 };

/** Counts one valid request; true when this address or this instance is over its budget. */
function overBudget(address: string): boolean {
    const now = Date.now();
    if (now - day.start > 24 * 3_600_000) day = { start: now, count: 0 };
    if (day.count >= PER_INSTANCE_PER_DAY) return true;
    const recent = (hits.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= PER_ADDRESS) return true;
    recent.push(now);
    hits.set(address, recent);
    if (hits.size > MAX_TRACKED) {
        // Drop only addresses whose window has passed; live windows are never reset.
        for (const [k, v] of hits) if (now - v[v.length - 1] >= WINDOW_MS) hits.delete(k);
    }
    day.count++;
    return false;
}

/**
 * The caller's address as the platform saw it: the LAST X-Forwarded-For entry,
 * which Google's front end appends on Cloud Run. Earlier entries are whatever
 * the client sent and cannot be trusted for rate limiting.
 */
export function addressOf(req: Request): string {
    const last = req.headers
        .get('x-forwarded-for')
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .pop();
    return last || req.headers.get('x-real-ip') || 'unknown';
}

const busy = () => NextResponse.json({ error: 'The demo is busy. Try again in a few minutes.' }, { status: 429 });
const invalid = () => NextResponse.json({ error: 'Invalid request' }, { status: 400 });

async function readBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
    if (!demoEnabled()) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    try {
        return { ok: true, body: await req.json() };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) };
    }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function handleDemoTurn(req: Request): Promise<NextResponse> {
    const g = await readBody(req);
    if (!g.ok) return g.res;
    const parsed = TurnRequest.safeParse(g.body);
    if (!parsed.success) return invalid();
    const { callId, studentId, reason, language, note, transcript, parentSpeech, turnNumber } = parsed.data;
    const context = demoCallContext(studentId, reason, language, note);
    if (!context) return invalid();
    // Only valid requests spend the budget, so junk cannot exhaust it.
    if (overBudget(addressOf(req))) return busy();

    try {
        const out = await generateAgentReply({
            ...context,
            complaintRouting: true,
            transcript,
            parentSpeech,
            turnNumber,
            callSid: `demo-${callId}`,
        });
        return NextResponse.json({ reply: capReply(out.reply), shouldEndCall: out.shouldEndCall, source: 'ai' });
    } catch (err) {
        console.warn('[sampark-demo] agent reply fell back to script', { error: err instanceof Error ? err.name : 'unknown' });
        const out = fallbackReply(context, parentSpeech, turnNumber);
        return NextResponse.json({ ...out, source: 'fallback' });
    }
}

export async function handleDemoSummary(req: Request): Promise<NextResponse> {
    const g = await readBody(req);
    if (!g.ok) return g.res;
    const parsed = SummaryRequest.safeParse(g.body);
    if (!parsed.success) return invalid();
    const { callId, studentId, reason, language, note, transcript, durationSeconds } = parsed.data;
    const context = demoCallContext(studentId, reason, language, note);
    if (!context) return invalid();
    if (overBudget(addressOf(req))) return busy();

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
        return NextResponse.json({ summary: fallbackSummary(context, transcript), source: 'fallback' });
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
