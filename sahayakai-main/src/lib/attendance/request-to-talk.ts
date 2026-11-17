/**
 * Concern calls are requests to talk.
 *
 * Founder decision, 23 Oct 2026: a call about a concern never states the concern. The parent
 * hears that the class teacher would like to speak with them and is asked for a good time; the
 * reason, the teacher's write-up, the subject and the marks stay on the record for the teacher.
 *
 * Only a reason in MESSAGE_DELIVERY_REASONS (good news) delivers the teacher's message. Every
 * other reason is a request to talk: the three concern reasons, a missing reason, and any reason
 * added later and not listed here. Fail-closed on purpose: `/api/attendance/outreach` stores the
 * reason from the request body without validating it.
 *
 * This module is the ONE place a parent-facing call path reads the concern fields of an outreach
 * record (`generatedMessage`, `spokenScript`, `subject`, `reason`, `performanceContext`). Routes
 * that speak to a parent, or hand a voice pipeline what to speak, call `parentCallContent` and
 * never read those fields themselves (gate: src/__tests__/attendance/gate-request-to-talk-paths.test.ts).
 *
 * Scope: the web routes that speak to a parent or serve a pipeline (the Twilio TwiML route and
 * /api/attendance/call-context). NOT the engine that speaks production Vobiz calls: that is the
 * Pipecat voice server (services/voice-server, deployed as sahayakai-telephony), which reads
 * parent_outreach itself; its request-to-talk fix and gate (services/voice-server/tests/) come in
 * a separate PR. The same English line is used by Sampark and by the sahayakai-agents bridge
 * (fix/agents-telephony-phase0), neither of which serves production calls today.
 */

import requestToTalkScript from '@/locales/call-scripts/request-to-talk.json';
import { resolveSpokenMessage } from '@/lib/voice-pipeline/spoken-script';
import type { Language } from '@/types';
import { TWILIO_LANGUAGE_MAP, type OutreachReason } from '@/types/attendance';

/** Outreach reasons whose call delivers the teacher's message. Only good news qualifies. */
export const MESSAGE_DELIVERY_REASONS: ReadonlySet<string> = new Set<OutreachReason>(['positive_feedback']);

/**
 * The concern reasons of `OutreachReason`. Listed so the gate can prove every reason is
 * classified; enforcement does not depend on this list (see `isRequestToTalk`).
 */
export const CONCERN_REASONS: ReadonlySet<string> = new Set<OutreachReason>([
    'consecutive_absences',
    'poor_performance',
    'behavioral_concern',
]);

const LINES: Readonly<Record<string, string>> = requestToTalkScript.lines;

/** The request-to-talk line in English, the fallback for any language without its own line. */
export const REQUEST_TO_TALK_LINE: string = LINES.English;

/**
 * What a conversational agent is told the call is about, in place of the outreach reason. The
 * agent schemas need a non-empty reason; this one names the purpose and nothing else.
 */
export const REQUEST_TO_TALK_AGENT_REASON =
    'A request to talk: the class teacher would like to speak with the parent personally this week. ' +
    'The reason has not been shared on this call. Ask only for a good time for a short call, and ' +
    'do not discuss, guess, confirm or deny why.';

export function isRequestToTalk(reason: unknown): boolean {
    return !(typeof reason === 'string' && MESSAGE_DELIVERY_REASONS.has(reason.trim()));
}

/** The line in `language`, or English when that language has none. */
export function requestToTalkLine(language: unknown): string {
    return (typeof language === 'string' && LINES[language]) || REQUEST_TO_TALK_LINE;
}

/**
 * The language a Twilio call is actually spoken in. Twilio has one voice per language code, and
 * some languages share one (Odia is voiced by hi-IN, with the Hindi call menu), so the line
 * follows the voice: the first language mapped to that code.
 */
export function twilioSpokenLanguage(language: unknown): Language {
    const code = TWILIO_LANGUAGE_MAP[language as Language] ?? 'en-IN';
    const languages = Object.keys(TWILIO_LANGUAGE_MAP) as Language[];
    return languages.find((l) => TWILIO_LANGUAGE_MAP[l] === code) ?? 'English';
}

export interface ParentCallContent {
    /** True for every reason that is not a message-delivery reason. */
    requestToTalk: boolean;
    /** What the parent hears as the reason for the call. */
    spokenMessage: string;
    /** What a conversational agent treats as the teacher's own words. */
    teacherMessage: string;
    /** What a conversational agent is told the call is about. */
    reason: string;
    subject: string;
    /** Marks, for an agent to quote only if the parent asks. Never set on a request to talk. */
    performanceSummary?: string;
}

type OutreachData = Record<string, unknown>;

interface PerformanceShape {
    subjectBreakdown?: { subject: string; marksObtained: number; maxMarks: number }[];
    latestPercentage?: number;
}

/** At most three subjects with marks, the way the call agent has always been given them. */
function summarisePerformance(pc: unknown): string | undefined {
    const perf = (pc ?? undefined) as PerformanceShape | undefined;
    if (!perf?.subjectBreakdown?.length) return undefined;
    return (
        perf.subjectBreakdown.slice(0, 3).map((a) => `${a.subject}: ${a.marksObtained}/${a.maxMarks}`).join(', ') +
        (typeof perf.latestPercentage === 'number' ? ` · overall ${Math.round(perf.latestPercentage)}%` : '')
    );
}

/**
 * Everything a parent-facing call path may say or pass on about this outreach.
 *
 * `spokenLanguage` picks the request-to-talk line: the language the call is actually voiced in.
 */
export function parentCallContent(data: OutreachData, spokenLanguage: unknown): ParentCallContent {
    if (isRequestToTalk(data.reason)) {
        const line = requestToTalkLine(spokenLanguage);
        return {
            requestToTalk: true,
            spokenMessage: line,
            teacherMessage: line,
            reason: REQUEST_TO_TALK_AGENT_REASON,
            subject: '',
        };
    }
    return {
        requestToTalk: false,
        spokenMessage: resolveSpokenMessage(data),
        teacherMessage: typeof data.generatedMessage === 'string' ? data.generatedMessage : '',
        reason: String(data.reason),
        subject: typeof data.subject === 'string' ? data.subject : '',
        performanceSummary: summarisePerformance(data.performanceContext),
    };
}
