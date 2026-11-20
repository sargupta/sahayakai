/**
 * CLASS GATE — a concern call is a request to talk on every path that speaks to a parent.
 *
 * Founder decision, 23 Oct 2026: a call about a concern never states the concern. It says the
 * class teacher would like to speak with the parent and asks for a good time.
 *
 * Bug class: a route that speaks to a parent (or hands a voice pipeline what to speak) reads the
 * teacher's write-up, the reason, the subject or the marks straight off the outreach record, so
 * the concern is read out by a machine before the parent has spoken to a person. The instances
 * were the Twilio TwiML route (greeting + `spokenScript`, then an agent given the reason, the
 * message and the marks) and `/api/attendance/call-context` (returned `generatedMessage`,
 * `reason` and `subject` to the voice pipeline).
 *
 * Layers:
 *  1. BEHAVIOURAL — for every request-to-talk reason (each concern reason in the TS enum, a
 *     missing reason, an empty one, an unknown one), with a sentinel in every concern field,
 *     neither route's output contains a sentinel, the marks or the reason, and both serve the
 *     fixed line. A positive_feedback control proves the sentinels would be seen.
 *  2. LANGUAGES — the line exists, in the right script, for every language the routes speak.
 *  2b. AGENT RULES — the request-to-talk rules reach the conversation agent as SYSTEM
 *     instructions, selected by the trusted `requestToTalk` flag and outside every <user_input>
 *     fence (text inside a fence is data the prompt tells the model to ignore), and a
 *     request-to-talk turn is never served by the sidecar, whose agent has no such rules.
 *  2c. SIDECAR CONTRACT — every agent input the TwiML route builds (each reason, and a good-news
 *     record without a subject) becomes a sidecar request that satisfies AgentReplyRequest as
 *     declared in sahayakai-agents (field lengths, bounds, required fields, no extra fields),
 *     read from the Python source so the two sides cannot drift unnoticed.
 *  3. STRUCTURAL — discovered over EVERY source file under src/, not only route files, so a
 *     lib helper one module away from a route is in scope:
 *     - a file that reads `spokenScript`, `generatedMessage` or `performanceContext` (or calls
 *       resolveSpokenMessage) must be teacher-facing (its output never reaches a parent) or be
 *       the request-to-talk module itself; resolveSpokenMessage is called only from there;
 *     - a file that builds call XML (`<?xml`, `<Say>`, `<Speak>`, `<Stream>`, `<Play>`) or
 *       serves the voice pipeline (`x-internal-key`) must be a known parent-facing file or carry
 *       a stated exemption; parent-facing files read no concern field themselves;
 *     - the Vobiz answer route's XML is checked behaviourally: for every reason it carries only
 *       the <Stream> to the telephony service and nothing from the outreach record.
 *
 * NOT covered here: what is SPOKEN on a production Vobiz call. That is the Pipecat voice server
 * (sahayakai-main/services/voice-server, deployed as sahayakai-telephony), which reads
 * parent_outreach from Firestore itself and does not go through parentCallContent. Its gate is
 * services/voice-server/tests/, arriving in a separate PR.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import {
    CONCERN_REASONS,
    MESSAGE_DELIVERY_REASONS,
    REQUEST_TO_TALK_LINE,
    isRequestToTalk,
    requestToTalkLine,
    twilioSpokenLanguage,
} from '@/lib/attendance/request-to-talk';
import requestToTalkScript from '@/locales/call-scripts/request-to-talk.json';
import { TWILIO_LANGUAGE_MAP } from '@/types/attendance';
import type { Language } from '@/types';
import Handlebars from 'handlebars';
import { PARENT_CALL_AGENT_REPLY_TEMPLATE, REQUEST_TO_TALK_RULES_HEADER } from '@/ai/flows/parent-call-agent-prompt';
import { generateAgentReply } from '@/ai/flows/parent-call-agent';
import { callSidecarReply } from '@/lib/sidecar/parent-call-client';

const SRC = path.resolve(__dirname, '../..');
const rel = (abs: string) => path.relative(SRC, abs).split(path.sep).join('/');

// ── Fake Firestore (enough for the TwiML GET/POST and call-context) ─────────────────────────

type Data = Record<string, any>;
const store = new Map<string, Data>();

class DocRef {
    constructor(public readonly path: string) {}
    get firestore() { return db; }
    get id() { return this.path.split('/').pop()!; }
    collection(name: string) { return new CollRef(`${this.path}/${name}`); }
    async get() { return snap(this); }
    async set(data: Data) { store.set(this.path, { ...data }); }
    async update(patch: Data) { store.set(this.path, { ...(store.get(this.path) ?? {}), ...patch }); }
}
class CollRef {
    constructor(private readonly path: string) {}
    doc(id: string) { return new DocRef(`${this.path}/${id}`); }
}
function snap(ref: DocRef) {
    const data = store.get(ref.path);
    return { exists: data !== undefined, id: ref.id, ref, data: () => data };
}
const db: any = {
    collection: (name: string) => new CollRef(name),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) =>
        fn({
            get: async (ref: DocRef) => snap(ref),
            set: (ref: DocRef, data: Data) => { store.set(ref.path, { ...data }); },
            update: (ref: DocRef, patch: Data) => { store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...patch }); },
        }),
};

jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => db }));
jest.mock('@/lib/twilio-validate', () => ({
    validateTwilioSignature: () => true,
    validateTwilioSignaturePost: () => true,
}));
jest.mock('@/ai/flows/parent-call-agent', () => ({ generateAgentReply: jest.fn() }));
jest.mock('@/lib/voice-pipeline/config', () => ({ getVoicePipelineConfig: () => ({ orchestratorWsUrl: '' }) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
// The Vobiz answer route checks calling hours; pin the clock inside the window.
jest.mock('@/lib/calling-hours', () => {
    const actual = jest.requireActual('@/lib/calling-hours');
    return { ...actual, checkCallingWindow: () => actual.checkCallingWindow(new Date('2026-11-16T06:30:00.000Z')) };
});
jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'vobiz-answer', STREAM: 'vobiz-call', STATUS: 'vobiz-status' },
    verifyVobizToken: async () => 'o1',
    mintVobizToken: async () => ({ token: 'stream-tok' }),
}));
// For the real dispatcher (layer 2b): every turn would go to the sidecar ('full') unless refused.
jest.mock('@/lib/feature-flags', () => ({ decideParentCallDispatch: async () => ({ mode: 'full', reason: 'gate', bucket: 1 }) }));
jest.mock('@/lib/sidecar/shadow-diff', () => ({ writeShadowDiff: async () => undefined }));
jest.mock('@/lib/sidecar/parent-call-client', () => {
    class E extends Error {}
    return {
        callSidecarReply: jest.fn(async () => ({ reply: 'sidecar reply', shouldEndCall: false })),
        SidecarBehaviouralError: class extends E {},
        SidecarConfigError: class extends E {},
        SidecarHttpError: class extends E {},
        SidecarTimeoutError: class extends E {},
    };
});

// The agent ECHOES everything it was given, so anything the route hands it is in the reply the
// parent hears. A concern field reaching the agent is therefore visible in the TwiML.
const agentInputs: unknown[] = [];
jest.mock('@/lib/sidecar/dispatch', () => ({
    dispatchParentCallReply: async (input: unknown) => {
        agentInputs.push(input);
        return { reply: JSON.stringify(input), shouldEndCall: false, followUpQuestion: null, source: 'genkit', decision: {} };
    },
}));

// Imported after the mocks.
import { GET as twimlGET, POST as twimlPOST } from '@/app/api/attendance/twiml/route';
import { GET as callContextGET } from '@/app/api/attendance/call-context/route';
import { GET as vobizAnswerGET } from '@/app/api/attendance/vobiz/answer/route';

const OUTREACH = 'parent_outreach/o1';
const MARKS = '13/97';

/** A record with a sentinel in every field that carries the concern. */
function concernRecord(reason: string | undefined, parentLanguage: Language = 'English'): Data {
    return {
        teacherUid: 't1',
        studentName: 'Aarav',
        className: 'Class 5',
        teacherName: 'Mrs Rao',
        schoolName: 'Hillview Demo School',
        parentLanguage,
        reason,
        generatedMessage: 'SENTINEL-generatedMessage: Aarav has been absent for five days.',
        spokenScript: 'SENTINEL-spokenScript: Aarav has been absent for five days.',
        subject: 'SENTINEL-subject',
        teacherNote: 'SENTINEL-teacherNote',
        reasonContext: 'SENTINEL-reasonContext',
        performanceContext: {
            subjectBreakdown: [{ subject: 'SENTINEL-perf-subject', name: 'SENTINEL-perf-name', marksObtained: 13, maxMarks: 97, percentage: 13 }],
            latestPercentage: 13.4,
            isAtRisk: true,
        },
        transcript: [],
        turnCount: 1,
    };
}

const unescapeXml = (xml: string) =>
    xml.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function twilioRequest(form?: FormData) {
    return {
        url: 'https://app.test/api/attendance/twiml?outreachId=o1',
        headers: { get: () => null },
        formData: async () => form,
    } as any;
}

async function twimlGetText(): Promise<string> {
    return unescapeXml(await (await twimlGET(twilioRequest())).text());
}

async function twimlPostText(): Promise<string> {
    const form = new FormData();
    form.set('SpeechResult', 'haan ji, boliye');
    form.set('CallSid', 'CA-gate');
    return unescapeXml(await (await twimlPOST(twilioRequest(form))).text());
}

const jsonSpy = jest.spyOn(NextResponse, 'json');
async function callContext(): Promise<Record<string, unknown>> {
    process.env.VOICE_PIPELINE_INTERNAL_KEY = 'gate-key';
    const res = await callContextGET({
        url: 'https://app.test/api/attendance/call-context?outreachId=o1',
        headers: { get: (k: string) => (k === 'x-internal-key' ? 'gate-key' : null) },
    } as any);
    expect(res.status).toBe(200);
    const calls = jsonSpy.mock.calls;
    return calls[calls.length - 1][0] as Record<string, unknown>;
}

function tsOutreachReasons(): string[] {
    const src = fs.readFileSync(path.join(SRC, 'types/attendance.ts'), 'utf8');
    const union = src.match(/export type OutreachReason\s*=([^;]+);/);
    if (!union) throw new Error('OutreachReason not found in src/types/attendance.ts');
    return Array.from(union[1].matchAll(/'([^']+)'/g), (m) => m[1]);
}

const REQUEST_TO_TALK_REASONS: (string | undefined)[] = [
    ...tsOutreachReasons().filter((r) => !MESSAGE_DELIVERY_REASONS.has(r)),
    undefined,
    '',
    'a_reason_added_later',
];

function expectNoConcern(output: string, reason: string | undefined) {
    expect(output).not.toContain('SENTINEL');
    expect(output).not.toContain(MARKS);
    if (reason) {
        expect(output).not.toContain(reason);
        expect(output.toLowerCase()).not.toContain(reason.replace(/_/g, ' '));
    }
}

beforeEach(() => {
    store.clear();
    agentInputs.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

// ── 1. Behavioural ──────────────────────────────────────────────────────────────────────────

describe('every outreach reason is classified', () => {
    it('the TS enum is exactly the concern reasons plus the message-delivery reasons', () => {
        const ts = tsOutreachReasons();
        expect(ts.length).toBeGreaterThan(0);
        expect(new Set(ts)).toEqual(new Set([...CONCERN_REASONS, ...MESSAGE_DELIVERY_REASONS]));
        for (const r of ['consecutive_absences', 'poor_performance', 'behavioral_concern']) {
            expect(CONCERN_REASONS.has(r)).toBe(true);
            expect(isRequestToTalk(r)).toBe(true);
        }
    });
});

describe.each(REQUEST_TO_TALK_REASONS.map((r) => [String(r), r] as const))('request to talk, reason=%s', (_label, reason) => {
    beforeEach(() => store.set(OUTREACH, concernRecord(reason)));

    it('TwiML greeting speaks the fixed line and no concern content', async () => {
        const xml = await twimlGetText();
        expectNoConcern(xml, reason);
        expect(xml).toContain(REQUEST_TO_TALK_LINE);
    });

    it('TwiML conversation turn gives the agent no concern content', async () => {
        const xml = await twimlPostText();
        expect(agentInputs).toHaveLength(1);
        expectNoConcern(xml, reason);
        expectNoConcern(JSON.stringify(agentInputs[0]), reason);
        expect(xml).toContain(REQUEST_TO_TALK_LINE);
    });

    it('call-context hands the voice pipeline the fixed line and no concern content', async () => {
        const body = await callContext();
        expectNoConcern(JSON.stringify(body), reason);
        expect(body.generatedMessage).toBe(REQUEST_TO_TALK_LINE);
        expect(body.reason).toBe('');
        expect(body.subject).toBe('');
        expect(body.requestToTalk).toBe(true);
    });
});

describe('control: a good-news call still delivers the teacher message', () => {
    // Proves the sentinels above would have been seen had they leaked.
    beforeEach(() => store.set(OUTREACH, concernRecord('positive_feedback')));

    it('TwiML greeting speaks the spoken script', async () => {
        expect(await twimlGetText()).toContain('SENTINEL-spokenScript');
    });

    it('TwiML agent gets the message, subject and marks', async () => {
        const xml = await twimlPostText();
        for (const s of ['SENTINEL-generatedMessage', 'SENTINEL-subject', MARKS]) expect(xml).toContain(s);
    });

    it('call-context returns the message', async () => {
        expect((await callContext()).generatedMessage).toContain('SENTINEL-generatedMessage');
    });
});

// ── 2. Languages ────────────────────────────────────────────────────────────────────────────

/** Letters of each language's own script (Devanagari danda allowed everywhere). */
const SCRIPT: Record<Language, RegExp> = {
    English: /^[A-Za-z\s.,?'’]+$/,
    Hindi: /^[ऀ-ॿ\s.,?‌‍]+$/,
    Marathi: /^[ऀ-ॿ\s.,?‌‍]+$/,
    Bengali: /^[ঀ-৿।॥\s.,?‌‍]+$/,
    Punjabi: /^[਀-੿।॥\s.,?‌‍]+$/,
    Gujarati: /^[઀-૿।॥\s.,?‌‍]+$/,
    Odia: /^[଀-୿।॥\s.,?‌‍]+$/,
    Tamil: /^[஀-௿\s.,?‌‍]+$/,
    Telugu: /^[ఀ-౿\s.,?‌‍]+$/,
    Kannada: /^[ಀ-೿\s.,?‌‍]+$/,
    Malayalam: /^[ഀ-ൿ\s.,?‌‍]+$/,
};
const LANGUAGES = Object.keys(TWILIO_LANGUAGE_MAP) as Language[];

describe('the line exists in every language the routes speak', () => {
    const lines = requestToTalkScript.lines as Record<string, string>;

    it.each(LANGUAGES)('%s has its own line in its own script', (language) => {
        const line = lines[language];
        expect(typeof line).toBe('string');
        expect(line).toMatch(SCRIPT[language]);
        if (language !== 'English') expect(line).not.toBe(REQUEST_TO_TALK_LINE);
    });

    it.each(LANGUAGES)('%s: TwiML speaks the line of the voice it uses, call-context the parent language', async (language) => {
        store.set(OUTREACH, concernRecord('consecutive_absences', language));
        expect(await twimlGetText()).toContain(requestToTalkLine(twilioSpokenLanguage(language)));
        expect((await callContext()).generatedMessage).toBe(requestToTalkLine(language));
    });

    it('Odia on Twilio follows its Hindi voice and Hindi call menu', () => {
        expect(twilioSpokenLanguage('Odia')).toBe('Hindi');
        expect(twilioSpokenLanguage('Bengali')).toBe('Bengali');
    });
});

// ── 2b. Agent rules are system instructions ─────────────────────────────────────────────────

/** The rendered prompt with every <user_input> fence removed: what the model treats as rules. */
const outsideFences = (rendered: string) => rendered.replace(/<user_input\b[^>]*>[\s\S]*?<\/user_input>/g, '');
const renderAgentPrompt = (input: unknown) => Handlebars.compile(PARENT_CALL_AGENT_REPLY_TEMPLATE, { noEscape: true })(input);
const RULE = 'Never guess, hint at, confirm or deny a reason';

describe.each(REQUEST_TO_TALK_REASONS.map((r) => [String(r), r] as const))('agent rules, reason=%s', (_label, reason) => {
    beforeEach(() => store.set(OUTREACH, concernRecord(reason)));

    it('the agent is flagged and its prompt carries the request-to-talk rules outside every fence', async () => {
        await twimlPostText();
        const input = agentInputs[0] as Record<string, unknown>;
        expect(input.requestToTalk).toBe(true);
        const rules = outsideFences(renderAgentPrompt(input));
        expect(rules).toContain(REQUEST_TO_TALK_RULES_HEADER);
        expect(rules).toContain(RULE);
        expect(rules).toContain('override rules 4, 5 and 8');
    });
});

describe('agent rules: structure and control', () => {
    it('in the template, the flag-gated block sits outside every <user_input> fence', () => {
        const t = PARENT_CALL_AGENT_REPLY_TEMPLATE;
        const block = t.indexOf('{{#if requestToTalk}}');
        expect(block).toBeGreaterThan(0);
        for (const m of t.matchAll(/<user_input\b[^>]*>[\s\S]*?<\/user_input>/g)) {
            const [from, to] = [m.index!, m.index! + m[0].length];
            expect(block >= from && block < to).toBe(false);
        }
        expect(outsideFences(t)).toContain(RULE);
    });

    it('control: a good-news call is not flagged and its prompt has no request-to-talk rules', async () => {
        store.set(OUTREACH, concernRecord('positive_feedback'));
        await twimlPostText();
        const input = agentInputs[0] as Record<string, unknown>;
        expect(input.requestToTalk).toBe(false);
        expect(renderAgentPrompt(input)).not.toContain(REQUEST_TO_TALK_RULES_HEADER);
    });

    it('a request-to-talk turn is served by Genkit, never by the sidecar, even in full mode', async () => {
        const { dispatchParentCallReply } = jest.requireActual('@/lib/sidecar/dispatch');
        (generateAgentReply as jest.Mock).mockResolvedValue({ reply: 'genkit reply', shouldEndCall: false });
        (callSidecarReply as jest.Mock).mockClear();
        const base = {
            callSid: 'CA-gate', studentName: 'Aarav', className: 'Class 5', subject: '', reason: 'r', teacherMessage: 'm',
            parentLanguage: 'en', transcript: [], parentSpeech: 'hello', turnNumber: 2,
        };
        const flagged = await dispatchParentCallReply({ ...base, requestToTalk: true });
        expect(flagged.source).toBe('genkit');
        expect(callSidecarReply).not.toHaveBeenCalled();
        // Control: the same turn without the flag goes to the sidecar in full mode.
        const unflagged = await dispatchParentCallReply({ ...base, subject: 'Maths', requestToTalk: false });
        expect(unflagged.source).toBe('sidecar');
        expect(callSidecarReply).toHaveBeenCalledTimes(1);
    });
});

// ── 2c. Sidecar request contract ────────────────────────────────────────────────────────────

type FieldRule = { optional: boolean; minLength?: number; maxLength?: number; ge?: number; le?: number };

/** AgentReplyRequest's fields and constraints, read from the sidecar's own pydantic model. */
function sidecarReplyContract(): Record<string, FieldRule> {
    const file = path.resolve(SRC, '../../sahayakai-agents/src/sahayakai_agents/agents/parent_call/schemas.py');
    const src = fs.readFileSync(file, 'utf8');
    const start = src.indexOf('class AgentReplyRequest(BaseModel):');
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = src.slice(start + 1);
    const body = rest.slice(0, rest.search(/\nclass /));
    const rules: Record<string, FieldRule> = {};
    for (const m of body.matchAll(/^ {4}(\w+):\s*([^=\n]+?)(?:\s*=\s*(.+))?$/gm)) {
        const [, name, type, rhs = ''] = m;
        if (name === 'model_config') continue;
        const num = (k: string) => {
            const r = rhs.match(new RegExp(`\\b${k}=(\\d+)`));
            return r ? Number(r[1]) : undefined;
        };
        rules[name] = {
            optional: /\bdefault=/.test(rhs) || /\|\s*None\b/.test(type),
            minLength: num('min_length'),
            maxLength: num('max_length'),
            ge: num('ge'),
            le: num('le'),
        };
    }
    return rules;
}

function contractViolations(request: Record<string, unknown>, rules: Record<string, FieldRule>): string[] {
    const v: string[] = [];
    for (const [k, val] of Object.entries(request)) if (val !== undefined && !rules[k]) v.push(`extra field ${k}`);
    for (const [k, r] of Object.entries(rules)) {
        const val = request[k];
        if (val === undefined || val === null) {
            if (!r.optional) v.push(`missing ${k}`);
            continue;
        }
        const len = typeof val === 'string' || Array.isArray(val) ? val.length : undefined;
        if (len !== undefined && r.minLength !== undefined && len < r.minLength) v.push(`${k}: length ${len} < ${r.minLength}`);
        if (len !== undefined && r.maxLength !== undefined && len > r.maxLength) v.push(`${k}: length ${len} > ${r.maxLength}`);
        if (typeof val === 'number' && r.ge !== undefined && val < r.ge) v.push(`${k}: ${val} < ${r.ge}`);
        if (typeof val === 'number' && r.le !== undefined && val > r.le) v.push(`${k}: ${val} > ${r.le}`);
    }
    return v;
}

describe('sidecar contract: every agent input the TwiML route builds is a valid sidecar request', () => {
    const rules = sidecarReplyContract();
    const { toSidecarRequest } = jest.requireActual('@/lib/sidecar/dispatch');

    it('reads the contract (guards against the parser matching nothing)', () => {
        expect(rules.subject).toEqual(expect.objectContaining({ optional: false, minLength: 1 }));
        expect(rules.reason).toEqual(expect.objectContaining({ optional: false, minLength: 1 }));
        expect(rules.turnNumber).toEqual(expect.objectContaining({ ge: 1, le: 12 }));
        expect(rules.teacherName?.optional).toBe(true);
    });

    const CASES: [string, Data][] = [
        ...REQUEST_TO_TALK_REASONS.map((r) => [`request to talk, reason=${String(r)}`, concernRecord(r)] as [string, Data]),
        ['good news', concernRecord('positive_feedback')],
        ['good news saved without a subject', (() => { const d = concernRecord('positive_feedback'); delete d.subject; return d; })()],
    ];

    it.each(CASES)('%s', async (_label, record) => {
        store.set(OUTREACH, record);
        await twimlPostText();
        expect(agentInputs).toHaveLength(1);
        const request = toSidecarRequest(agentInputs[0]);
        expect(contractViolations(request, rules)).toEqual([]);
        // The stand-in subject is neutral: it never names the concern.
        if (isRequestToTalk(record.reason)) expect(String(request.subject)).not.toContain('SENTINEL');
    });
});

// ── 3. Structural ───────────────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}
function sources(dir = SRC, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '__tests__' || e.name === '__mocks__' || e.name === 'node_modules') continue;
            sources(p, out);
        } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}
const SOURCES = sources().map((abs) => ({ rel: rel(abs), code: stripComments(fs.readFileSync(abs, 'utf8')) }));
const source = (f: string) => SOURCES.find((s) => s.rel === f);

/** Reads a concern field of an outreach record, directly or through the spoken-script helper. */
const READS_CONCERN_FIELD =
    /\.(spokenScript|generatedMessage|performanceContext)\b|\[\s*['"](spokenScript|generatedMessage|performanceContext)['"]\s*\]|\bresolveSpokenMessage\s*\(/;
/** Builds call XML, or serves the voice pipeline. */
const FACES_A_CALL = /<\?xml\b|<Say\b|<Speak\b|<Stream\b|<Play>|x-internal-key/;
/** Reads the outreach's subject, reason or notes, other than from parentCallContent's result. */
const READS_OUTREACH_TOPIC = /(?<!\bcontent)\.(subject|reason|teacherNote|reasonContext)\b/;

/** Files that speak to a parent or build what a parent call speaks or streams. */
const PARENT_FACING: Record<string, 'speaks outreach content' | 'speaks no outreach content'> = {
    'app/api/attendance/twiml/route.ts': 'speaks outreach content',
    'app/api/attendance/call-context/route.ts': 'speaks outreach content',
    'app/api/attendance/vobiz/answer/route.ts': 'speaks no outreach content',
    'lib/vobiz/answer-xml.ts': 'speaks no outreach content',
};

/** The one module a parent-facing path reads concern fields through, and the helper it uses. */
const CONCERN_GATE: Record<string, string> = {
    'lib/attendance/request-to-talk.ts': 'parentCallContent applies the request-to-talk rule',
    'lib/voice-pipeline/spoken-script.ts': 'defines resolveSpokenMessage, called only by request-to-talk.ts (checked below)',
};

/** Files that may read concern fields because nothing they produce reaches a parent. */
const TEACHER_FACING: Record<string, string> = {
    'app/api/ai/parent-message/route.ts': 'drafts the message for the teacher to review in the Contact-Parent modal',
    'ai/flows/parent-message-generator.ts': "generates the teacher's draft message for review",
    'lib/sidecar/parent-message-dispatch.ts': "dispatches the teacher's draft generation to Genkit or the sidecar",
    'app/api/attendance/outreach/route.ts': "stores the teacher's draft on the outreach record; returns only its id",
    'server/attendance.ts': "saves and lists the teacher's own outreach history",
    'components/attendance/contact-parent-modal.tsx': "the teacher's own draft, shown to the teacher in the modal",
    'app/api/attendance/transcript-sync/route.ts': 'passes the message to the post-call summary written for the teacher',
    'app/api/attendance/twiml-status/route.ts': 'passes the message to the post-call summary written for the teacher',
    'scripts/seed-attendance-demo.ts': 'seeds demo outreach records; never runs on a call',
};

/** Files that face a call but speak nothing from an outreach record. */
const FACES_A_CALL_WITHOUT_OUTREACH_CONTENT: Record<string, string> = {
    'app/api/demo-call/twiml/route.ts': "public lead magnet: a fixed script to the visitor's own number, no outreach record",
    'app/api/attendance/transcript-sync/route.ts': 'receives transcripts from the voice pipeline and returns no speakable content',
    // Sampark's Riya calls speak catalogue purposes and Riya variables, never a parent_outreach
    // record; their own gate keeps concern calls to a request to talk
    // (src/__tests__/sampark/conversation/gate-request-to-talk-never-states-the-concern.test.ts).
    'app/api/webhooks/vobiz-riya/answer/route.ts': 'Sampark Riya over Vobiz: streams to the bridge with a signed Sampark ref, no outreach content',
    'lib/sampark/voice/xml.ts': 'Sampark notice XML: plays rendered catalogue clips, no outreach content',
    'server/sampark/vobiz-riya.ts': 'Sampark Riya over Vobiz: answer/stream for Sampark calls, no outreach content',
};

describe('structural: concern fields reach a parent only through parentCallContent (all of src/)', () => {
    it('finds the sources (guards against the scan matching nothing)', () => {
        expect(SOURCES.length).toBeGreaterThan(200);
        for (const f of [...Object.keys(PARENT_FACING), ...Object.keys(CONCERN_GATE)]) expect(source(f)).toBeDefined();
        expect(SOURCES.some((s) => s.rel.startsWith('lib/'))).toBe(true);
    });

    it('every file that reads spokenScript, generatedMessage or performanceContext is teacher-facing or the gate', () => {
        const offenders = SOURCES.filter((s) => READS_CONCERN_FIELD.test(s.code) && !TEACHER_FACING[s.rel] && !CONCERN_GATE[s.rel]).map(
            (s) => `${s.rel}: reads a concern field but is neither teacher-facing nor the request-to-talk gate`,
        );
        expect(offenders).toEqual([]);
    });

    it('the allow-lists are current: each entry exists and still reads a concern field, none is parent-facing', () => {
        for (const [f, why] of Object.entries({ ...TEACHER_FACING, ...CONCERN_GATE })) {
            const s = source(f);
            expect({ f, exists: !!s, reads: !!s && READS_CONCERN_FIELD.test(s.code) }).toEqual({ f, exists: true, reads: true });
            expect(PARENT_FACING[f]).toBeUndefined();
            expect(why.length).toBeGreaterThan(20);
        }
    });

    it('resolveSpokenMessage (it speaks the teacher message) is called only by the request-to-talk module', () => {
        const callers = SOURCES.filter((s) => /\bresolveSpokenMessage\s*\(/.test(s.code.replace(/export function resolveSpokenMessage\s*\(/, '')));
        expect(callers.map((s) => s.rel)).toEqual(['lib/attendance/request-to-talk.ts']);
    });

    it.each(Object.entries(PARENT_FACING))('%s reads no concern field itself (%s)', (f, kind) => {
        const code = source(f)!.code;
        expect(code).not.toMatch(READS_CONCERN_FIELD);
        expect(code).not.toMatch(READS_OUTREACH_TOPIC);
        if (kind === 'speaks outreach content') {
            expect(code).toMatch(/from\s+['"]@\/lib\/attendance\/request-to-talk['"]/);
            expect(code).toMatch(/\bparentCallContent\s*\(/);
        }
    });

    it('every file that builds call XML or serves the voice pipeline is parent-facing or names why it speaks no outreach content', () => {
        const offenders = SOURCES.filter(
            (s) => FACES_A_CALL.test(s.code) && !PARENT_FACING[s.rel] && !FACES_A_CALL_WITHOUT_OUTREACH_CONTENT[s.rel],
        ).map((s) => `${s.rel}: builds call XML or serves the voice pipeline but is not covered`);
        expect(offenders).toEqual([]);
    });
});

// The answer route's XML only. The speech on a Vobiz call comes from services/voice-server,
// which this file does not cover (see the header; its gate is services/voice-server/tests/).
describe.each([...REQUEST_TO_TALK_REASONS, 'positive_feedback'].map((r) => [String(r), r] as const))(
    'Vobiz answer route XML, reason=%s',
    (_label, reason) => {
        it('carries only the stream, nothing from the outreach record', async () => {
            process.env.VOBIZ_STREAM_BASE_URL = 'https://telephony.test';
            store.set(OUTREACH, concernRecord(reason));
            const res = await vobizAnswerGET({
                method: 'GET',
                url: 'https://app.test/api/attendance/vobiz/answer?t=answer-tok&CallUUID=cu1',
                headers: { get: () => null },
            } as any);
            const xml = unescapeXml(await res.text());
            expect(res.status).toBe(200);
            expect(xml).toContain('<Stream');
            expect(xml).not.toMatch(/<(Say|Speak|Play)\b/);
            expectNoConcern(xml, reason === 'positive_feedback' ? undefined : reason);
        });
    },
);
