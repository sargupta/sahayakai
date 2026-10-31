/**
 * My Library semantics — CLASS GATE.
 *
 *   Conversation / session  → users/{uid}/vidya_sessions   (My Library → Conversations)
 *   Generated resource      → users/{uid}/content          (My Library → Generations)
 *
 * Founder bug (2026-10): ordinary VIDYA chat ("hello", "who are you", "explain
 * photosynthesis") was auto-saved as `instant-answer` rows and cluttered
 * Generations. The Generations store is NOT a transcript store.
 *
 * Part 1 (static) fails CI when ANY module starts writing to the Generations
 * store without being deliberately classified as a generator or an explicit
 * teacher Save, and when any conversation / voice / app-action module gains a
 * Generations writer at all.
 *
 * Part 2 (behavioural) runs the REAL persistence layer (persist-helpers +
 * dbAdapter) against a recording fake Firestore/Storage — only the model calls
 * are stubbed — and counts what actually lands in users/{uid}/content.
 */
import fs from 'fs';
import path from 'path';

// ── Part 1: who may write to the Generations store ──────────────────────────

const SRC = path.resolve(__dirname, '../..');
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '__tests__' || e.name === '__mocks__' || e.name === 'node_modules') continue;
            sourceFiles(p, out);
        } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}

/** Every way code puts a row into users/{uid}/content. */
const GENERATIONS_WRITER = /dbAdapter\.saveContent\(|persistSidecar(JSON|Image|Avatar)\(|\bsaveToLibrary\(|["'`]\/api\/content\/save["'`]|collection\(\s*["'`]content["'`]\s*\)[\s\S]{0,120}?\.(set|add|update)\(/;

/** Deliberately classified writers. Adding a writer means adding it HERE, with a reason. */
const ALLOWED_WRITERS: Record<string, 'generator' | 'explicit-save' | 'store'> = {
    // The shared persistence helpers (dbAdapter.saveContent itself is the store).
    'lib/sidecar/persist-helpers.ts': 'store',
    'lib/api/content.ts': 'store', // client wrapper used only by explicit Save buttons
    // Generator flows / dispatchers / routes — produce an actual teaching resource.
    'ai/flows/assessment-scanner.ts': 'generator',
    'ai/flows/assignment-assessor.ts': 'generator',
    'ai/flows/exam-paper-generator.ts': 'generator',
    'ai/flows/lesson-plan-generator.ts': 'generator',
    'ai/flows/quiz-generator.ts': 'generator',
    'ai/flows/rubric-generator.ts': 'generator',
    'ai/flows/teacher-training.ts': 'generator',
    'ai/flows/virtual-field-trip.ts': 'generator',
    'ai/flows/visual-aid-designer.ts': 'generator',
    'ai/flows/worksheet-wizard.ts': 'generator',
    'app/api/ai/exam-paper/route.ts': 'generator',
    'app/api/assessment-scanner/[id]/route.ts': 'generator',
    'lib/sidecar/avatar-generator-dispatch.ts': 'generator',
    'lib/sidecar/exam-paper-dispatch.ts': 'generator',
    'lib/sidecar/lesson-plan-dispatch.ts': 'generator',
    'lib/sidecar/quiz-dispatch.ts': 'generator',
    'lib/sidecar/rubric-dispatch.ts': 'generator',
    'lib/sidecar/teacher-training-dispatch.ts': 'generator',
    'lib/sidecar/virtual-field-trip-dispatch.ts': 'generator',
    'lib/sidecar/visual-aid-dispatch.ts': 'generator',
    'lib/sidecar/worksheet-dispatch.ts': 'generator',
    // Explicit teacher actions (Save / Download / Save-from-community / Publish).
    'app/api/content/save/route.ts': 'explicit-save',
    'app/api/content/library/route.ts': 'explicit-save',
    'server/content.ts': 'explicit-save',
    'server/community.ts': 'explicit-save',
    'app/onboarding/page.tsx': 'explicit-save',
    'app/teacher-training/page.tsx': 'explicit-save',
    'components/instant-answer-display.tsx': 'explicit-save',
    'components/lesson-plan-display.tsx': 'explicit-save',
    'components/quiz-display.tsx': 'explicit-save',
    'components/rubric-display.tsx': 'explicit-save',
    'components/teacher-training-display.tsx': 'explicit-save',
    'components/virtual-field-trip-display.tsx': 'explicit-save',
    'components/visual-aid-display.tsx': 'explicit-save',
    'components/worksheet-display.tsx': 'explicit-save',
    'features/instant-answer/hooks/use-instant-answer.ts': 'explicit-save',
};

/** Conversation, contextual-answer, voice and app-action code: must NEVER write Generations. */
const CONVERSATION_MODULES = [
    'app/api/ai/intent/route.ts',
    'app/api/assistant/route.ts',
    'app/api/ai/instant-answer/route.ts',
    'app/api/vidya/session/route.ts',
    'ai/flows/vidya-assistant.ts',
    'ai/flows/instant-answer.ts',
    'ai/flows/agent-router.ts',
    'ai/flows/agent-definitions.ts',
    'lib/sidecar/instant-answer-dispatch.ts',
    'lib/sidecar/vidya-dispatch.ts',
    'components/omni-orb.tsx',
    'components/vidya-live-orb.tsx',
    'components/library/conversation-list.tsx',
    'store/jarvisStore.ts',
];
const CONVERSATION_DIRS = ['lib/vidya', 'lib/vidya-live', 'app/api/vidya-voice', 'components/vidya'];

describe('Generations store writers (static class gate)', () => {
    const files = sourceFiles(SRC);
    // Comments are stripped: modules that explain WHY they do not persist must not count as writers.
    const code = (f: string) => fs.readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    const writers = files.filter((f) => GENERATIONS_WRITER.test(code(f))).map(rel);

    it('every Generations writer is a classified generator or explicit Save', () => {
        const unclassified = writers.filter((w) => !(w in ALLOWED_WRITERS));
        // If this fails: you added a new path into users/{uid}/content. If it is a
        // real generated resource or an explicit Save, add it to ALLOWED_WRITERS.
        // If it is chat/conversation, store it in vidya_sessions instead.
        expect(unclassified).toEqual([]);
    });

    it('the allowlist has no stale entries (keeps the gate honest)', () => {
        const stale = Object.keys(ALLOWED_WRITERS).filter((w) => !writers.includes(w));
        expect(stale).toEqual([]);
    });

    it('no conversation / contextual / voice / app-action module writes to Generations', () => {
        const inDirs = files.map(rel).filter((f) => CONVERSATION_DIRS.some((d) => f.startsWith(`${d}/`)));
        const conversation = [...CONVERSATION_MODULES, ...inDirs];
        for (const m of CONVERSATION_MODULES) expect(fs.existsSync(path.join(SRC, m))).toBe(true);
        expect(conversation.filter((m) => writers.includes(m))).toEqual([]);
    });

    it('the instant-answer hook writes only from the explicit Save handler', () => {
        const src = code(path.join(SRC, 'features/instant-answer/hooks/use-instant-answer.ts'));
        const calls = [...src.matchAll(/\bsaveToLibrary\(/g)].length;
        expect(calls).toBe(1);
        const handleSave = src.slice(src.indexOf('const handleSave = async'));
        expect(handleSave.indexOf('saveToLibrary(')).toBeGreaterThan(0);
        expect(handleSave.indexOf('saveToLibrary(')).toBeLessThan(handleSave.indexOf('\n    };'));
    });

    it('the Live Voice sidecar has no Library / Firestore write path (contextual voice answers are audio only)', () => {
        const voiceDir = path.resolve(SRC, '../../sahayakai-agents/src/sahayakai_agents/agents/vidya_voice');
        if (!fs.existsSync(voiceDir)) return; // web-only checkout
        for (const f of fs.readdirSync(voiceDir).filter((n) => n.endsWith('.py'))) {
            const py = fs.readFileSync(path.join(voiceDir, f), 'utf8');
            expect({ f, firestore: /google\.cloud\s+import\s+firestore|firestore\.Client\(/.test(py) }).toEqual({ f, firestore: false });
            expect({ f, content: /collection\(\s*["']content["']\s*\)/.test(py) }).toEqual({ f, content: false });
        }
    });
});

// ── Part 2: the real persistence layer, counted at the store ────────────────

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>(); // full doc path → data
const objects = new Map<string, unknown>(); // storage path → bytes
const contentRows = (uid?: string) =>
    [...store.keys()].filter((p) => /^users\/[^/]+\/content\/[^/]+$/.test(p) && (!uid || p.startsWith(`users/${uid}/`)));

function docRef(p: string): any {
    return {
        id: p.split('/').pop(),
        set: async (data: Doc, opts?: { merge?: boolean }) => {
            store.set(p, opts?.merge ? { ...(store.get(p) ?? {}), ...data } : { ...data });
        },
        get: async () => ({ exists: store.has(p), data: () => store.get(p) }),
        collection: (c: string) => colRef(`${p}/${c}`),
    };
}
function colRef(p: string): any {
    return { doc: (id: string) => docRef(`${p}/${id}`) };
}
const fakeDb = { collection: (c: string) => colRef(c) };
const fakeStorage = {
    bucket: () => ({ file: (p: string) => ({ save: async (b: unknown) => { objects.set(p, b); } }) }),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => fakeDb,
    getStorageInstance: async () => fakeStorage,
}));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'SERVER_TS', increment: (n: number) => n, arrayUnion: (...v: unknown[]) => v },
    Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: (d: Date) => ({ toDate: () => d }) },
}));
jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: { track: jest.fn(), increment: jest.fn() } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockFlags = { mode: 'full' as 'off' | 'canary' | 'full' };
jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(async () => ({
        quizSidecarMode: mockFlags.mode, quizSidecarPercent: 100,
        instantAnswerSidecarMode: mockFlags.mode, instantAnswerSidecarPercent: 100,
        worksheetSidecarMode: mockFlags.mode, worksheetSidecarPercent: 100,
        examPaperSidecarMode: mockFlags.mode, examPaperSidecarPercent: 100,
    })),
    decideLessonPlanDispatch: jest.fn(async () => ({ mode: mockFlags.mode, reason: 'test', bucket: 0 })),
}));
jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({ writeAgentShadowDiff: jest.fn() }));
jest.mock('@/lib/sidecar/canary-shadow-diff', () => ({ shouldRunCanaryShadowDiff: () => false }));
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: jest.fn(async () => undefined) }));

// Model calls only (Genkit flows + sidecar HTTP clients) are stubbed.
jest.mock('@/ai/flows/instant-answer', () => ({ instantAnswer: jest.fn() }));
jest.mock('@/ai/flows/quiz-generator', () => ({ generateQuiz: jest.fn() }));
jest.mock('@/ai/flows/lesson-plan-generator', () => ({ generateLessonPlan: jest.fn() }));
jest.mock('@/ai/flows/worksheet-wizard', () => ({ generateWorksheet: jest.fn() }));
jest.mock('@/ai/flows/exam-paper-generator', () => ({ generateExamPaper: jest.fn() }));
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: jest.fn(async () => '') }));
// A function declaration (not a const) so the hoisted jest.mock factories can use it.
function sidecarErrors(prefix: string) {
    const make = (name: string) => class extends Error { constructor(...a: unknown[]) { super(String(a[0] ?? name)); this.name = name; } };
    return Object.fromEntries(['ConfigError', 'TimeoutError', 'HttpError', 'BehaviouralError'].map((s) => [`${prefix}${s}`, make(`${prefix}${s}`)]));
}
jest.mock('@/lib/sidecar/instant-answer-client', () => ({ callSidecarInstantAnswer: jest.fn(), ...sidecarErrors('InstantAnswerSidecar') }));
jest.mock('@/lib/sidecar/quiz-client', () => ({ callSidecarQuiz: jest.fn(), ...sidecarErrors('QuizSidecar') }));
jest.mock('@/lib/sidecar/lesson-plan-client', () => ({ callSidecarLessonPlan: jest.fn(), ...sidecarErrors('LessonPlanSidecar') }));
jest.mock('@/lib/sidecar/worksheet-client', () => ({ callSidecarWorksheet: jest.fn(), ...sidecarErrors('WorksheetSidecar') }));
jest.mock('@/lib/sidecar/exam-paper-client', () => ({ callSidecarExamPaper: jest.fn(), ...sidecarErrors('ExamPaperSidecar') }));

import { dispatchInstantAnswer } from '@/lib/sidecar/instant-answer-dispatch';
import { dispatchQuiz } from '@/lib/sidecar/quiz-dispatch';
import { dispatchLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { callSidecarInstantAnswer } from '@/lib/sidecar/instant-answer-client';
import { callSidecarQuiz } from '@/lib/sidecar/quiz-client';
import { callSidecarLessonPlan } from '@/lib/sidecar/lesson-plan-client';
import { dispatchWorksheet } from '@/lib/sidecar/worksheet-dispatch';
import { dispatchExamPaper } from '@/lib/sidecar/exam-paper-dispatch';
import { callSidecarWorksheet } from '@/lib/sidecar/worksheet-client';
import { callSidecarExamPaper } from '@/lib/sidecar/exam-paper-client';

const ANSWER = { answer: 'I am VIDYA, your teaching assistant.', videoSuggestionUrl: null, gradeLevel: 'Class 5', subject: 'General', sidecarVersion: 't', latencyMs: 1, modelUsed: 'm', groundingUsed: false };
const QUIZ = {
    easy: { title: 'Easy', questions: [], teacherInstructions: null, gradeLevel: 'Class 5', subject: 'Science' },
    medium: { title: 'Medium', questions: [], teacherInstructions: null, gradeLevel: 'Class 5', subject: 'Science' },
    hard: { title: 'Hard', questions: [], teacherInstructions: null, gradeLevel: 'Class 5', subject: 'Science' },
    gradeLevel: 'Class 5', subject: 'Science', topic: 'Photosynthesis', sidecarVersion: 't', latencyMs: 1, modelUsed: 'm', variantsGenerated: 3,
};
const LESSON = {
    title: 'Photosynthesis', gradeLevel: 'Class 5', duration: '45 minutes', subject: 'Science', objectives: ['Explain'],
    keyVocabulary: null, materials: ['leaves'], activities: [{ phase: 'Engage', name: 'Riddle', description: 'd', duration: '5 minutes', teacherTips: null, understandingCheck: null }],
    assessment: 'Quiz', homework: 'Draw', language: 'en', revisionsRun: 0, sidecarVersion: 't',
    rubric: { scores: {}, safety: true, rationale: 'ok', fail_reasons: [] },
};

const WORKSHEET = {
    title: 'Multiplication practice', gradeLevel: 'Class 4', subject: 'Math', learningObjectives: ['Multiply'],
    studentInstructions: 'Solve.', activities: [{ type: 'question', content: '3 x 4?', explanation: 'e' }],
    answerKey: [{ activityIndex: 0, answer: '12' }], sidecarVersion: 't', latencyMs: 1, modelUsed: 'm',
};
const EXAM = {
    title: 'CBSE Class 10 Mathematics Sample Paper', board: 'CBSE', subject: 'Mathematics', gradeLevel: 'Class 10',
    duration: '3 Hours', maxMarks: 80, generalInstructions: ['All questions are compulsory.'], sections: [],
    blueprintSummary: { chapterWise: [], difficultyWise: [] }, pyqSources: [], sidecarVersion: 't', latencyMs: 1, modelUsed: 'm',
};

beforeEach(() => {
    store.clear();
    objects.clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (callSidecarInstantAnswer as jest.Mock).mockResolvedValue(ANSWER);
    (instantAnswer as jest.Mock).mockResolvedValue({ answer: ANSWER.answer, videoSuggestionUrl: null, gradeLevel: 'Class 5', subject: 'General' });
    (callSidecarQuiz as jest.Mock).mockResolvedValue(QUIZ);
    (callSidecarLessonPlan as jest.Mock).mockResolvedValue(LESSON);
    (callSidecarWorksheet as jest.Mock).mockResolvedValue(WORKSHEET);
    (callSidecarExamPaper as jest.Mock).mockResolvedValue(EXAM);
});
afterEach(() => jest.restoreAllMocks());

describe.each(['off', 'canary', 'full'] as const)('real persistence layer — %s mode', (mode) => {
    beforeEach(() => { mockFlags.mode = mode; });

    it.each([
        'Who are you and what can you help me with?',
        'Good afternoon',
        'Explain photosynthesis.',
        'How many students are absent?', // contextual question
    ])('ordinary chat "%s" creates NO Generation', async (question) => {
        await dispatchInstantAnswer({ question, language: 'en', userId: 'teacher-a' } as any);
        expect(contentRows()).toEqual([]);
        expect([...objects.keys()]).toEqual([]);
    });
});

describe('real persistence layer — generation (sidecar path)', () => {
    beforeEach(() => { mockFlags.mode = 'full'; });

    it('a quiz creates exactly ONE Generation, under the teacher, and a retry does not duplicate it', async () => {
        const input = { userId: 'teacher-a', topic: 'Photosynthesis', numQuestions: 5, questionTypes: ['multiple_choice'], gradeLevel: 'Class 5', language: 'English', subject: 'Science', contentId: '11111111-1111-4111-8111-111111111111' } as any;
        await dispatchQuiz(input);
        await dispatchQuiz(input); // double-submit / retry with the same id
        expect(contentRows()).toEqual(['users/teacher-a/content/11111111-1111-4111-8111-111111111111']);
        expect(store.get('users/teacher-a/content/11111111-1111-4111-8111-111111111111')).toMatchObject({ type: 'quiz' });
    });

    it('a lesson plan creates exactly ONE Generation of type lesson-plan', async () => {
        await dispatchLessonPlan({ userId: 'teacher-a', topic: 'Photosynthesis', language: 'en', gradeLevels: ['Class 5'], useRuralContext: false, resourceLevel: 'low', contentId: '44444444-4444-4444-8444-444444444444' } as any);
        expect(contentRows()).toEqual(['users/teacher-a/content/44444444-4444-4444-8444-444444444444']);
        expect(store.get('users/teacher-a/content/44444444-4444-4444-8444-444444444444')).toMatchObject({ type: 'lesson-plan' });
    });

    it('a worksheet creates exactly ONE Generation, and a retry does not duplicate it', async () => {
        const input = { userId: 'teacher-a', imageDataUri: 'data:image/png;base64,xxx', prompt: 'multiplication practice', language: 'English', gradeLevel: 'Class 4', subject: 'Math', contentId: '55555555-5555-4555-8555-555555555555' } as any;
        await dispatchWorksheet(input);
        await dispatchWorksheet(input);
        expect(contentRows()).toEqual(['users/teacher-a/content/55555555-5555-4555-8555-555555555555']);
        expect(store.get('users/teacher-a/content/55555555-5555-4555-8555-555555555555')).toMatchObject({ type: 'worksheet' });
    });

    it('a question paper creates exactly ONE Generation, and a retry does not duplicate it', async () => {
        const input = { userId: 'teacher-a', board: 'CBSE', gradeLevel: 'Class 10', subject: 'Mathematics', chapters: ['Quadratic Equations'], language: 'English', difficulty: 'mixed', includeAnswerKey: true, includeMarkingScheme: true, contentId: '66666666-6666-4666-8666-666666666666' } as any;
        await dispatchExamPaper(input);
        await dispatchExamPaper(input);
        expect(contentRows()).toEqual(['users/teacher-a/content/66666666-6666-4666-8666-666666666666']);
        expect(store.get('users/teacher-a/content/66666666-6666-4666-8666-666666666666')).toMatchObject({ type: 'exam-paper' });
    });

    it('chat around a generation adds nothing: conversation + quiz = exactly one Generation', async () => {
        await dispatchInstantAnswer({ question: 'Hi VIDYA', language: 'en', userId: 'teacher-a' } as any);
        await dispatchQuiz({ userId: 'teacher-a', topic: 'Fractions', numQuestions: 5, questionTypes: ['multiple_choice'], gradeLevel: 'Class 5', language: 'English', subject: 'Maths', contentId: '22222222-2222-4222-8222-222222222222' } as any);
        await dispatchInstantAnswer({ question: 'Thank you!', language: 'en', userId: 'teacher-a' } as any);
        expect(contentRows()).toEqual(['users/teacher-a/content/22222222-2222-4222-8222-222222222222']);
    });

    it('a generation by teacher A never lands in teacher B\'s Library', async () => {
        await dispatchQuiz({ userId: 'teacher-a', topic: 'Plants', numQuestions: 5, questionTypes: ['multiple_choice'], gradeLevel: 'Class 5', language: 'English', subject: 'Science', contentId: '33333333-3333-4333-8333-333333333333' } as any);
        expect(contentRows('teacher-b')).toEqual([]);
        expect(contentRows('teacher-a')).toHaveLength(1);
    });
});
