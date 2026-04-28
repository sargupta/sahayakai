/**
 * Quiz generator dispatcher (Phase E.1) — 3-variant + multimodal.
 *
 * Phase K (P0 #2): canary/full mode now mirrors the Genkit flow's
 * pre-call gates (rate limit + topic safety) and post-call persistence
 * (Storage + Firestore content doc). Before Phase K, sidecar-served
 * quizzes silently bypassed the user's library and the daily rate limit.
 */
import {
    generateQuiz,
    type QuizGeneratorOutput,
    type QuizVariantsOutput,
} from '@/ai/flows/quiz-generator';
import type { QuizGeneratorInput } from '@/ai/schemas/quiz-generator-schemas';
import { getFeatureFlags } from '@/lib/feature-flags';
import { validateTopicSafety } from '@/lib/safety';
import {
    callSidecarQuiz,
    QuizSidecarBehaviouralError,
    QuizSidecarConfigError,
    QuizSidecarHttpError,
    QuizSidecarTimeoutError,
    type SidecarQuizRequest,
    type SidecarQuizResponse,
    type SidecarQuizVariant,
} from './quiz-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in quiz-client.ts. Phase J.2 hot-fix (P0 #7) —
// caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 45_000;

export type QuizSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface QuizSidecarDecision {
    mode: QuizSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return Math.abs(hash) % 100;
}

// Phase J.5 — flag plane consolidation. Reads from Firestore via
// `getFeatureFlags()` so the auto-abort Cloud Function (which only
// writes Firestore) can roll this agent back without a Cloud Run
// redeploy. See feature-flags.ts and the Phase J.5 commit message.
async function readMode(): Promise<QuizSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.quizSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.quizSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideQuizDispatch(uid: string): Promise<QuizSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type QuizDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedQuiz extends QuizVariantsOutput {
    source: QuizDispatchSource;
    decision: QuizSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
        variantsGenerated: number;
    };
}

export interface QuizDispatchInput extends QuizGeneratorInput {
    userId: string;
}

function inputToSidecarRequest(input: QuizDispatchInput): SidecarQuizRequest {
    return {
        topic: input.topic,
        imageDataUri: input.imageDataUri ?? null,
        numQuestions: input.numQuestions,
        questionTypes: input.questionTypes,
        gradeLevel: input.gradeLevel ?? null,
        language: input.language ?? null,
        bloomsTaxonomyLevels: input.bloomsTaxonomyLevels ?? null,
        targetDifficulty: input.targetDifficulty ?? null,
        subject: input.subject ?? null,
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function variantToGenkit(
    v: SidecarQuizVariant | null,
): QuizGeneratorOutput | null {
    if (!v) return null;
    return {
        title: v.title,
        questions: v.questions.map((q) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficultyLevel: q.difficultyLevel,
        })),
        teacherInstructions: v.teacherInstructions ?? undefined,
        gradeLevel: v.gradeLevel,
        subject: v.subject,
    };
}

function sidecarToDispatched(
    res: SidecarQuizResponse,
    decision: QuizSidecarDecision,
    contentId: string | null,
): DispatchedQuiz {
    return {
        easy: variantToGenkit(res.easy),
        medium: variantToGenkit(res.medium),
        hard: variantToGenkit(res.hard),
        // Mirror the Genkit flow: when the artefact is saved to the user's
        // library, surface the contentId + isSaved=true so the API route's
        // response matches the off-mode shape.
        id: contentId ?? undefined,
        topic: res.topic,
        gradeLevel: res.gradeLevel,
        subject: res.subject,
        isSaved: contentId !== null,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            modelUsed: res.modelUsed,
            variantsGenerated: res.variantsGenerated,
        },
    };
}

function genkitToDispatched(
    out: QuizVariantsOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: QuizSidecarDecision,
): DispatchedQuiz {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: QuizDispatchInput) {
    try {
        const out = await withTimeout(
            generateQuiz(input),
            FALLBACK_TIMEOUT_MS,
            'quiz genkit fallback',
        );
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarQuizRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarQuiz(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(decision: QuizSidecarDecision, payload: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        event: 'quiz.dispatch',
        mode: decision.mode,
        reason: decision.reason,
        bucket: decision.bucket,
        ...payload,
    }));
}

export async function dispatchQuiz(input: QuizDispatchInput): Promise<DispatchedQuiz> {
    const decision = await decideQuizDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateQuiz(input),
            FALLBACK_TIMEOUT_MS,
            'quiz genkit fallback',
        );
        logDispatch(decision, { source: 'genkit', uid: input.userId });
        return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const shadowStartedAt = Date.now();
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarRequest),
        ]);
        const genkitLatencyMs = Date.now() - shadowStartedAt;
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarVariantsGenerated: sidecar.ok ? sidecar.res.variantsGenerated : undefined,
        });
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        void writeAgentShadowDiff({
            agent: 'quiz',
            uid: input.userId,
            genkit: genkit.ok ? genkit.out : null,
            sidecar: sidecar.ok ? sidecar.res : null,
            genkitLatencyMs,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarOk: sidecar.ok,
            sidecarError: sidecar.ok ? undefined : sidecar.error.message,
        });
        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // Phase K — pre-call gates that the Genkit flow runs inside generateQuiz.
    // When canary/full bypasses Genkit we must still enforce them or a bad
    // actor blows through their daily quota and unsafe topics reach the
    // sidecar.
    const safety = validateTopicSafety(input.topic);
    if (!safety.safe) {
        throw new Error(`Safety Violation: ${safety.reason}`);
    }
    if (input.userId) {
        const { checkServerRateLimit } = await import('@/lib/server-safety');
        await checkServerRateLimit(input.userId);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        // Phase K — persist sidecar output to Storage + Firestore so the
        // teacher's library shows the quiz regardless of dispatch mode.
        const persistResult = input.userId
            ? await persistSidecarJSON({
                  uid: input.userId,
                  collection: 'quizzes',
                  contentType: 'quiz',
                  title: input.topic || sidecar.res.topic || 'Quiz',
                  output: sidecar.res,
                  metadata: {
                      gradeLevel:
                          sidecar.res.gradeLevel || input.gradeLevel || 'Class 5',
                      subject: sidecar.res.subject || input.subject || 'General',
                      topic: input.topic,
                      language: input.language || 'English',
                  },
              })
            : null;
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            variantsGenerated: sidecar.res.variantsGenerated,
            contentId: persistResult?.contentId,
            persisted: persistResult !== null,
        });
        return sidecarToDispatched(sidecar.res, decision, persistResult?.contentId ?? null);
    }

    const errorClass =
        sidecar.error instanceof QuizSidecarBehaviouralError ? 'behavioural'
        : sidecar.error instanceof QuizSidecarTimeoutError ? 'timeout'
        : sidecar.error instanceof QuizSidecarHttpError ? 'http'
        : sidecar.error instanceof QuizSidecarConfigError ? 'config'
        : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await withTimeout(
        generateQuiz(input),
        FALLBACK_TIMEOUT_MS,
        'quiz genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
