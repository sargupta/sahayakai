/**
 * Class gate (founder decision, 23 Oct 2026; plan §2A): a concern call is a request to talk. It
 * never states the concern, on the call or to the calling provider, and never names its category
 * ("academic progress update", "classroom participation update").
 *
 * Before this gate the Riya academic and behaviour workflows sent ElevenLabs, and said on the
 * call, the concern itself ("Your child's recent marks in Mathematics have dropped…", "Your child
 * has been disturbing other students…"). After the variables were fixed, the announcement shown
 * to staff still framed the call ("I'm calling with a brief academic progress update.") and the
 * Vobiz bridge's own workflow (sahayakai-agents riya_workflow.json) still opened with "I'm calling
 * about a brief academic progress update" before verification, then discussed low marks and
 * "difficulty paying attention … disturbing other students".
 *
 * The rule belongs to the catalogue purpose, not to one workflow or one sentence, so the gate walks
 * every Riya workflow whose Sampark purpose is in REQUEST_TO_TALK_PURPOSES and checks:
 *   1. built for every concern, subject and observation staff can select, no variable sent to the
 *      provider and no announcement shown to staff carries a concern sentence, an observation, a
 *      subject name, a concern word or a category phrase;
 *   2. the bridge's workflow node for that purpose scripts no such line, and its instructions carry
 *      no category phrase, observation or subject (examples are what a model repeats);
 *   3. the bridge's own list of request-to-talk purposes is the same set.
 * A new concern workflow is covered the moment its purpose maps to a request-to-talk purpose.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { REQUEST_TO_TALK_PURPOSES } from '@/lib/sampark/catalogue';
import { buildRiyaVariables, type RiyaFacts } from '@/lib/sampark/conversation/facts';
import {
    ACADEMIC_CONCERNS,
    BEHAVIOUR_OBSERVATIONS,
    EXAM_SUBJECTS,
    RIYA_PURPOSES,
    riyaPurposeSpec,
    type AcademicConcern,
    type BehaviourObservation,
    type ExamSubject,
    type RiyaPurpose,
} from '@/lib/sampark/conversation/riya-purposes';

const NOW = new Date('2026-10-07T05:30:00Z'); // Wednesday 11:00 IST
const SCHOOL = { spokenName: { English: 'Hillview Demo School', Hindi: '', Bengali: '', Nepali: '' }, holidays: [] };
const STUDENT = { spokenFirstName: { English: 'Pema', Hindi: '', Bengali: '', Nepali: '' }, grade: 7, section: 'B' };

const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const TELEPHONY = path.join(MONOREPO_ROOT, 'sahayakai-agents', 'src', 'sahayakai_agents', 'telephony');

const SUBJECTS = Object.keys(EXAM_SUBJECTS) as ExamSubject[];
const CONCERNS = Object.keys(ACADEMIC_CONCERNS) as AcademicConcern[];
const OBSERVATIONS = Object.keys(BEHAVIOUR_OBSERVATIONS) as BehaviourObservation[];

/** Every fact set staff can choose for a concern workflow (one and two of each list). */
function factsFor(purpose: RiyaPurpose): RiyaFacts[] {
    if (purpose === 'academic_performance') {
        const subjectSets: ExamSubject[][] = [...SUBJECTS.map((s) => [s]), [SUBJECTS[0], SUBJECTS[1]]];
        return CONCERNS.flatMap((concern) => subjectSets.map((subjects) => ({ purpose, subjects, concern })));
    }
    if (purpose === 'classroom_behaviour') {
        return [...OBSERVATIONS.map((o) => [o]), OBSERVATIONS.slice(0, 2), OBSERVATIONS.slice(0, 3)].map((observations) => ({ purpose, observations }));
    }
    throw new Error(`no fact generator for request-to-talk workflow ${purpose}: add one here`);
}

/** The category, named. Forbidden in anything spoken AND anywhere in a request-to-talk node. */
const CATEGORY_PHRASES = [
    'academic progress', 'academic performance', 'academic update', 'progress update',
    'classroom participation', 'participation update', 'classroom behaviour', 'classroom behavior',
    'classroom update', 'low marks', 'difficulty paying attention', 'paying attention', 'disturbing other students',
];

/** Words that state or frame a concern. Forbidden in anything Riya says. */
const CONCERN_WORDS = [
    'academic', 'academics', 'performance', 'progress', 'marks', 'grades', 'behaviour', 'behavior',
    'conduct', 'discipline', 'participation', 'attention', 'disturbing', 'concern', 'concerns', 'improvement',
];

/** What staff can select: each concern sentence's fixed parts, each observation, each subject. */
const SELECTABLE: string[] = [
    ...Object.values(ACADEMIC_CONCERNS).flatMap((s) => s.split('{subjects}').map((part) => part.trim()).filter((p) => p.length > 12)),
    ...Object.values(BEHAVIOUR_OBSERVATIONS),
    ...Object.values(EXAM_SUBJECTS),
];

/** Anything Riya says must be free of all of these. */
const NEVER_SPOKEN = [...SELECTABLE, ...CONCERN_WORDS, ...CATEGORY_PHRASES];
/** Anywhere in a request-to-talk node, instructions included (they may say "never mention marks"). */
const NEVER_IN_NODE = [...Object.values(BEHAVIOUR_OBSERVATIONS), ...Object.values(EXAM_SUBJECTS), ...CATEGORY_PHRASES];

/** Whole-word, case-insensitive: "Art" must not match "part". */
function wholePhrase(phrase: string): RegExp {
    return new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
}

function named(text: string, phrases: readonly string[]): string[] {
    return phrases.filter((phrase) => wholePhrase(phrase).test(text));
}

const concernWorkflows = RIYA_PURPOSES.filter((p) => REQUEST_TO_TALK_PURPOSES.has(riyaPurposeSpec(p).samparkPurpose));

interface BridgeWorkflow {
    routes: { when: Record<string, string>; node: string }[];
    nodes: Record<string, { additional_prompt: string }>;
}
const bridgeWorkflow = JSON.parse(readFileSync(path.join(TELEPHONY, 'riya_workflow.json'), 'utf8')) as BridgeWorkflow;

/** The bridge node a call_purpose routes to (its own edge, never the generic fallback). */
function bridgeNodePrompt(purpose: RiyaPurpose): string {
    const r = bridgeWorkflow.routes.find((x) => x.when.product_context === 'sampark' && x.when.call_purpose === purpose);
    if (!r) throw new Error(`the bridge workflow has no route for ${purpose}`);
    return bridgeWorkflow.nodes[r.node].additional_prompt;
}

/** The lines a node prompt scripts for Riya (its double-quoted lines). */
function scriptedLines(prompt: string): string[] {
    return [...prompt.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe('gate: a request-to-talk call never states the concern', () => {
    it('covers the concern workflows at all', () => {
        // A gate that checks nothing reports green forever.
        expect(concernWorkflows).toEqual(expect.arrayContaining(['academic_performance', 'classroom_behaviour']));
    });

    it.each(concernWorkflows)('%s sends and shows no concern, observation, subject or category', (purpose) => {
        for (const facts of factsFor(purpose)) {
            const r = buildRiyaVariables({ purpose, facts, school: SCHOOL, student: STUDENT, now: NOW });
            if (!r.ok) throw new Error(`${purpose} refused ${JSON.stringify(facts)}: ${JSON.stringify(r.problems)}`);
            // call_purpose is the routing key, not something said: the Vobiz bridge routes on it and
            // never shows it to the model (test_telephony_riya_request_to_talk.py), and the hosted
            // ElevenLabs agent, which would see it, is refused for these purposes until its prompt
            // is verified (ELEVENLABS_REQUEST_TO_TALK_UNVERIFIED). Every other variable is checked
            // with "_" read as a space: \b cannot see "behaviour" inside "classroom_behaviour".
            const { call_purpose: routingKey, ...spoken } = r.variables as Record<string, string>;
            expect(routingKey).toBe(purpose);
            const said = [...Object.values(spoken), r.announcement].join(' \n ').replace(/_/g, ' ');
            const leaked = named(said, NEVER_SPOKEN);
            expect({ facts, leaked }).toEqual({ facts, leaked: [] });
        }
    });

    it.each(concernWorkflows)('the Vobiz bridge node for %s scripts no concern and names no category', (purpose) => {
        const prompt = bridgeNodePrompt(purpose);
        const lines = scriptedLines(prompt);
        // The verification line the bridge plays before the listener is verified is one of them.
        expect(lines.some((l) => /parent or guardian of \{\{student_name\}\}/.test(l))).toBe(true);
        for (const line of lines) expect({ line, leaked: named(line, NEVER_SPOKEN) }).toEqual({ line, leaked: [] });
        expect(named(prompt, NEVER_IN_NODE)).toEqual([]);
        // Asked why, Riya says the class teacher will explain; she is never told to pretend she knows.
        expect(lines.some((l) => /class teacher will explain/.test(l))).toBe(true);
    });

    it('the bridge treats exactly these workflows as requests to talk', () => {
        const source = readFileSync(path.join(TELEPHONY, 'riya.py'), 'utf8');
        const m = source.match(/REQUEST_TO_TALK_PURPOSES[^=\n]*=\s*frozenset\(\s*\{([^}]*)\}/);
        if (!m) throw new Error('riya.py no longer defines REQUEST_TO_TALK_PURPOSES');
        const bridge = [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]).sort();
        expect(bridge).toEqual([...concernWorkflows].sort());
    });
});
