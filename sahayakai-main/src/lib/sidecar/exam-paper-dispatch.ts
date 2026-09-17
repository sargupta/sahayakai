/**
 * Exam paper generator dispatcher (Phase E.2).
 *
 * Phase K (P0 #2): canary/full mode now mirrors the Genkit flow's
 * post-call persistence (Storage + Firestore content doc) and the
 * server-side rate limiter. Before Phase K, sidecar-served exam papers
 * silently bypassed the user's library and the daily rate limit.
 *
 * Topic-safety gate (H8, forensic EPG-2026-07-17): the dispatcher now runs
 * `validateTopicSafety` on the free-text inputs. The old assumption that these
 * fields are "structured/safe" was wrong — board / grade / subject / chapters /
 * teacherContext are unrestricted teacher-typed text, so this flow must run the
 * same content-safety check every sibling AI flow does.
 */
import {
    generateExamPaper,
    type ExamPaperInput,
    type ExamPaperOutput,
} from '@/ai/flows/exam-paper-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import { validateTopicSafety } from '@/lib/safety';
import {
    callSidecarExamPaper,
    ExamPaperSidecarBehaviouralError,
    ExamPaperSidecarConfigError,
    ExamPaperSidecarHttpError,
    ExamPaperSidecarTimeoutError,
    type SidecarExamPaperRequest,
    type SidecarExamPaperResponse,
} from './exam-paper-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { shouldRunCanaryShadowDiff } from './canary-shadow-diff';
import { withTimeout, WithTimeoutError } from './with-timeout';
import { toLanguageLabel } from './lang';
import { computeTotalMarks } from '@/ai/data/exam-paper-marks';
import { StructuredLogger } from '@/lib/logger/structured-logger';

// NCERT demo hot-fix (2026-05-19): exam-paper is the most token-heavy
// flow we run (full paper + answer key + marking scheme + sections).
// Observed cold-start latency at CBSE Class 8 Science: 30–45 s; the
// old 30 s budget tripped `WithTimeoutError` even when Gemini was
// completing successfully. Bumped to 75 s — still well under Cloud
// Run's 300 s request-timeout default, and overridable per-env for
// future tuning without a code change.
//
// Phase J.2 history: this used to mirror `TIMEOUT_MS` in
// exam-paper-client.ts (30 s) — capping the Genkit fallback to the
// same budget as the sidecar. We now intentionally diverge: the
// sidecar has its own 30 s cap, but when we fall *back* to Genkit
// we accept a longer wait rather than hand the user a 500.
const EXAM_PAPER_TIMEOUT_MS =
    Number(process.env.EXAM_PAPER_GENKIT_TIMEOUT_MS) || 75_000;
const FALLBACK_TIMEOUT_MS = EXAM_PAPER_TIMEOUT_MS;

// Sentinel thrown when the Genkit fallback exceeds budget. The route
// handler unwraps this and returns a structured `generation_in_progress`
// payload instead of a generic 500. The actual Gemini call is allowed
// to keep running in the background (see with-timeout.ts) — if it
// eventually persists to the user's library, it shows up under
// "My Library" the next time the teacher opens it.
export class ExamPaperGenerationInProgressError extends Error {
    readonly budgetMs: number;
    readonly elapsedMs: number;
    constructor(budgetMs: number, elapsedMs: number) {
        super(
            `Exam paper still generating after ${elapsedMs}ms (budget ${budgetMs}ms)`,
        );
        this.name = 'ExamPaperGenerationInProgressError';
        this.budgetMs = budgetMs;
        this.elapsedMs = elapsedMs;
    }
}

export type ExamPaperSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface ExamPaperSidecarDecision {
    mode: ExamPaperSidecarMode;
    reason: string;
    bucket: number;
    /** Q4C: raw flag value pre-bucket. */
    configuredMode?: ExamPaperSidecarMode;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return Math.abs(hash) % 100;
}

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<ExamPaperSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.examPaperSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.examPaperSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideExamPaperDispatch(uid: string): Promise<ExamPaperSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket, configuredMode: mode };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket, configuredMode: mode };
    const percent = await readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket, configuredMode: mode };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket, configuredMode: mode };
}

export type ExamPaperDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedExamPaper extends ExamPaperOutput {
    source: ExamPaperDispatchSource;
    decision: ExamPaperSidecarDecision;
    sidecarTelemetry?: { sidecarVersion: string; latencyMs: number; modelUsed: string };
    // H3 (2026-07-16): the persisted content id. Genkit path carries it via
    // ExamPaperOutput.contentId (spread through genkitToDispatched); sidecar
    // path sets it from persistSidecarJSON's result. Exposed so the route can
    // return it and the client's Save upserts by id instead of duplicating.
    contentId?: string;
}

export interface ExamPaperDispatchInput extends ExamPaperInput {
    userId: string;
}

function inputToSidecarRequest(input: ExamPaperDispatchInput): SidecarExamPaperRequest {
    return {
        board: input.board,
        gradeLevel: input.gradeLevel,
        subject: input.subject,
        chapters: input.chapters ?? [],
        duration: input.duration ?? null,
        maxMarks: input.maxMarks ?? null,
        // Exam-paper Python schema defaults to "English" (display name);
        // keep the wire shape display-name-form to match the prompt
        // templates the agent renders server-side.
        language: toLanguageLabel(input.language ?? 'English'),
        difficulty: input.difficulty ?? 'mixed',
        includeAnswerKey: input.includeAnswerKey ?? true,
        includeMarkingScheme: input.includeMarkingScheme ?? true,
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarExamPaperResponse,
    decision: ExamPaperSidecarDecision,
    requested: { includeAnswerKey: boolean; includeMarkingScheme: boolean },
): DispatchedExamPaper {
    // H4 (2026-07-16): recompute the invariant reports the route forwards to
    // the UI — the sidecar branch used to drop them, so a sidecar-served paper
    // showed no marks-drift / completeness signal at all.
    // ponytail: sidecar REPORTS only, it does not repair (repaired:false,
    // filledBy*=0). Sidecar mode is `off` by default; wire repair here if it is
    // ever promoted to the primary path.
    let missingBefore = 0;
    for (const s of res.sections) {
        for (const q of s.questions) {
            if (requested.includeAnswerKey && !q.answerKey) missingBefore++;
            if (requested.includeMarkingScheme && !q.markingScheme) missingBefore++;
        }
    }
    return {
        marksReconciliation: {
            expected: res.maxMarks,
            actual: computeTotalMarks(res.sections),
            repaired: false,
            attempts: 1,
        },
        answerKeyCompleteness: {
            requestedAnswerKey: requested.includeAnswerKey,
            requestedMarkingScheme: requested.includeMarkingScheme,
            missingBefore,
            filledByStamp: 0,
            filledByReprompt: 0,
            filledByPlaceholder: 0,
        },
        // validationWarnings stays undefined — the sidecar has no NCERT
        // chapter-validation input to produce them.
        title: res.title,
        board: res.board,
        subject: res.subject,
        gradeLevel: res.gradeLevel,
        duration: res.duration,
        maxMarks: res.maxMarks,
        generalInstructions: res.generalInstructions,
        sections: res.sections.map((s) => ({
            name: s.name,
            label: s.label,
            totalMarks: s.totalMarks,
            questions: s.questions.map((q) => ({
                number: q.number,
                text: q.text,
                marks: q.marks,
                options: q.options ?? undefined,
                // The sidecar schema has no `correctOption`; it emits answerKey/
                // markingScheme directly. The Genkit-shaped `ExamPaperOutput`
                // requires the field, so default to '' (non-objective sentinel —
                // MCQ stamping is a Genkit-path concern only).
                correctOption: '',
                internalChoice: q.internalChoice ?? undefined,
                answerKey: q.answerKey ?? undefined,
                markingScheme: q.markingScheme ?? undefined,
                // Codegen marks `source` optional; the Genkit-shaped
                // `ExamPaperOutput` requires it. Default to the same
                // tag the Pydantic model uses when the sidecar omits it.
                source: q.source ?? 'AI Generated',
            })),
        })),
        blueprintSummary: res.blueprintSummary,
        pyqSources: res.pyqSources?.map((p) => ({
            id: p.id,
            year: p.year ?? undefined,
            chapter: p.chapter ?? undefined,
        })) ?? undefined,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            modelUsed: res.modelUsed,
        },
    };
}

function genkitToDispatched(
    out: ExamPaperOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: ExamPaperSidecarDecision,
): DispatchedExamPaper {
    return { ...out, source, decision };
}

/**
 * Shared core for `runGenkitSafe` / `runGenkitOrThrow`: run the Genkit
 * `generateExamPaper` flow under the `FALLBACK_TIMEOUT_MS` budget and emit
 * structured logs at the timeout boundary on both the success and timeout
 * paths. On timeout it logs via `StructuredLogger.error` then RE-THROWS the original
 * error unchanged — mapping (to `ExamPaperGenerationInProgressError`) and
 * swallowing (to `{ ok: false }`) are the wrappers' concern, so each keeps
 * its distinct error outcome while sharing identical work + logging.
 */
async function runGenkitCore(
    input: ExamPaperInput,
    source: ExamPaperDispatchSource,
): Promise<ExamPaperOutput> {
    const startedAt = Date.now();
    try {
        const out = await withTimeout(
            generateExamPaper(input),
            FALLBACK_TIMEOUT_MS,
            'exam-paper genkit fallback',
        );
        StructuredLogger.info('[exam-paper.dispatch] complete', {
            service: 'exam-paper-dispatch',
            operation: 'runGenkitCore',
            metadata: {
                durationMs: Date.now() - startedAt,
                source,
                budgetMs: FALLBACK_TIMEOUT_MS,
            },
        });
        return out;
    } catch (err) {
        if (err instanceof WithTimeoutError) {
            StructuredLogger.error('[exam-paper.dispatch] timeout', {
                service: 'exam-paper-dispatch',
                operation: 'runGenkitCore',
                metadata: {
                    budgetMs: FALLBACK_TIMEOUT_MS,
                    elapsedMs: err.elapsedMs,
                    source,
                    // Redact prompt — board/grade/subject only.
                    prompt: redactExamPaperInput(input),
                },
            });
        }
        throw err;
    }
}

/**
 * Thin wrapper over `runGenkitCore` that swallows failures into
 * `{ ok: false }`. Caller-side (shadow mode) wraps the whole Promise.all
 * so we never let an unhandled `WithTimeoutError` reach the user. Returns
 * the RAW error (e.g. `WithTimeoutError`) — the `generation_in_progress`
 * mapping lives only in `runGenkitOrThrow`.
 */
async function runGenkitSafe(input: ExamPaperInput, source: ExamPaperDispatchSource) {
    try {
        return { ok: true as const, out: await runGenkitCore(input, source) };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

/**
 * Thin wrapper over `runGenkitCore` that throws instead of swallowing —
 * used on the `off` and `genkit_fallback` paths where we want the failure
 * to surface to the route handler. Maps `WithTimeoutError` to the
 * structured `generation_in_progress` response.
 */
async function runGenkitOrThrow(
    input: ExamPaperInput,
    source: ExamPaperDispatchSource,
): Promise<ExamPaperOutput> {
    try {
        return await runGenkitCore(input, source);
    } catch (err) {
        if (err instanceof WithTimeoutError) {
            throw new ExamPaperGenerationInProgressError(
                FALLBACK_TIMEOUT_MS,
                err.elapsedMs,
            );
        }
        throw err;
    }
}

/**
 * Strip user-supplied free-text from log payloads. We keep the structural
 * fields (board, grade, subject, language, difficulty) because they are
 * useful for triaging which exam-paper shape is slow, but drop
 * `teacherContext` and chapter strings which may carry PII.
 */
function redactExamPaperInput(input: ExamPaperInput): Record<string, unknown> {
    return {
        board: input.board,
        gradeLevel: input.gradeLevel,
        subject: input.subject,
        language: input.language,
        difficulty: input.difficulty,
        pyqRatio: input.pyqRatio,
        chapterCount: input.chapters?.length ?? 0,
        hasTeacherContext: Boolean(input.teacherContext),
    };
}

async function runSidecarSafe(request: SidecarExamPaperRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarExamPaper(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(decision: ExamPaperSidecarDecision, payload: Record<string, unknown>): void {
    StructuredLogger.info('[exam-paper.dispatch] decision', {
        service: 'exam-paper-dispatch',
        operation: 'dispatchExamPaper',
        metadata: {
            event: 'exam_paper.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        },
    });
}

export async function dispatchExamPaper(
    input: ExamPaperDispatchInput,
): Promise<DispatchedExamPaper> {
    // H8 (forensic EPG-2026-07-17): exam-paper previously skipped the
    // content-safety check every sibling flow runs, because these fields were
    // assumed structured/safe. They are unrestricted teacher-typed free text,
    // so gate them here — the single chokepoint both routes call, before any
    // genkit/sidecar dispatch. Routes already map `Safety Violation:` errors.
    const safetyText = [
        input.board,
        input.gradeLevel,
        input.subject,
        ...(input.chapters ?? []),
        input.teacherContext,
    ]
        .filter(Boolean)
        .join(' \n');
    const safety = validateTopicSafety(safetyText);
    if (!safety.safe) {
        throw new Error(`Safety Violation: ${safety.reason}`);
    }

    // M8 (forensic EPG-2026-07-17): the sidecar request builder below forwards
    // teacherContext verbatim, and the safe server summary was only applied INSIDE
    // the Genkit flow (after this request is built) — so raw client text could reach
    // the sidecar model. Replace it HERE, the single chokepoint both the sidecar
    // request and the genkit fallback flow inherit. Best-effort: on failure drop it
    // rather than block generation (mirrors the flow's own non-blocking derivation).
    if (input.userId) {
        try {
            const { getTeacherContextLine } = await import('@/lib/teacher-context');
            input.teacherContext = await getTeacherContextLine(input.userId);
        } catch {
            input.teacherContext = undefined;
        }
    } else {
        input.teacherContext = undefined;
    }

    const decision = await decideExamPaperDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await runGenkitOrThrow(input, 'genkit');
        logDispatch(decision, { source: 'genkit', uid: input.userId });

        // Q4C — canary "bucket-overshoot" observation. When the agent
        // is mid-canary (configuredMode==='canary') but THIS teacher's
        // bucket landed >=percent (mode collapsed to 'off'), fire the
        // sidecar in the background and write a shadow_diff so the
        // promotion gate has a non-zero denominator.
        if (
            shouldRunCanaryShadowDiff() &&
            decision.configuredMode === 'canary'
        ) {
            void runSidecarSafe(sidecarRequest).then((sc) => {
                void writeAgentShadowDiff({
                    agent: 'exam-paper',
                    uid: input.userId,
                    genkit: out,
                    sidecar: sc.ok ? sc.res : null,
                    genkitLatencyMs: 0,
                    sidecarLatencyMs: sc.latencyMs,
                    sidecarOk: sc.ok,
                    sidecarError: sc.ok ? undefined : sc.error.message,
                });
                // L7: runSidecarSafe rethrows AbortError — swallow it so a
                // background shadow-diff never becomes an unhandled rejection.
            }).catch(() => {});
        }
                return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const shadowStartedAt = Date.now();
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input, 'genkit'),
            runSidecarSafe(sidecarRequest),
        ]);
        const genkitLatencyMs = Date.now() - shadowStartedAt;
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        void writeAgentShadowDiff({
            agent: 'exam-paper',
            uid: input.userId,
            genkit: genkit.ok ? genkit.out : null,
            sidecar: sidecar.ok ? sidecar.res : null,
            genkitLatencyMs,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarOk: sidecar.ok,
            sidecarError: sidecar.ok ? undefined : sidecar.error.message,
        });
        if (!genkit.ok) {
            // L8: unify with the other paths — a genkit timeout in the shadow
            // branch maps to a 202 in-progress, not a 503.
            if (genkit.error instanceof WithTimeoutError) {
                throw new ExamPaperGenerationInProgressError(
                    FALLBACK_TIMEOUT_MS,
                    genkit.error.elapsedMs,
                );
            }
            throw genkit.error;
        }
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // Phase K — rate limit gate that the Genkit flow's wrapper enforces
    // via the route-level layers. Lifted here so canary/full doesn't blow
    // through the user's daily quota.
    if (input.userId) {
        const { checkServerRateLimit } = await import('@/lib/server-safety');
        await checkServerRateLimit(input.userId);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        // Phase K — persist the exam paper to the user's library so it is
        // available regardless of which AI path served the request.
        const topicForLibrary =
            input.chapters && input.chapters.length > 0
                ? input.chapters.join(', ')
                : input.subject;
        const titleForLibrary =
            sidecar.res.title ||
            `${input.board} ${input.gradeLevel} ${input.subject} Exam Paper`.trim();
        const persistResult = input.userId
            ? await persistSidecarJSON({
                  uid: input.userId,
                  collection: 'exam-papers',
                  contentType: 'exam-paper',
                  title: titleForLibrary,
                  output: sidecar.res,
                  metadata: {
                      gradeLevel:
                          sidecar.res.gradeLevel || input.gradeLevel || 'Class 10',
                      subject: input.subject || sidecar.res.subject || 'General',
                      topic: topicForLibrary,
                      language: input.language || 'English',
                  },
                  // Papers are viewed/downloaded from Firestore `data` — no blob.
                  skipStorageBlob: true,
              })
            : null;
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            contentId: persistResult?.contentId,
            persisted: persistResult !== null,
        });

        // Q4C — canary/full observation: fire Genkit in the background
        // and write a shadow_diff so the promotion-gate aggregator has
        // a live (genkit, sidecar) parity signal during the rollout.
        // 2x Gemini cost while observation is on; toggle the constant
        // off post-promotion to reclaim it.
        if (shouldRunCanaryShadowDiff()) {
            const __q4cGenkitStartedAt = Date.now();
            void runGenkitSafe(input, 'genkit').then((gk) => {
                void writeAgentShadowDiff({
                    agent: 'exam-paper',
                    uid: input.userId,
                    genkit: gk.ok ? gk.out : null,
                    sidecar: sidecar.res,
                    genkitLatencyMs: Date.now() - __q4cGenkitStartedAt,
                    sidecarLatencyMs: sidecar.latencyMs,
                    sidecarOk: true,
                });
                // L7: runGenkitSafe rethrows AbortError — swallow it here.
            }).catch(() => {});
        }
                return {
                    ...sidecarToDispatched(sidecar.res, decision, {
                        includeAnswerKey: input.includeAnswerKey ?? true,
                        includeMarkingScheme: input.includeMarkingScheme ?? true,
                    }),
                    // H3: expose the persisted id so Save upserts by id.
                    contentId: persistResult?.contentId,
                };
    }

    const errorClass =
        sidecar.error instanceof ExamPaperSidecarBehaviouralError ? 'behavioural'
        : sidecar.error instanceof ExamPaperSidecarTimeoutError ? 'timeout'
        : sidecar.error instanceof ExamPaperSidecarHttpError ? 'http'
        : sidecar.error instanceof ExamPaperSidecarConfigError ? 'config'
        : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await runGenkitOrThrow(input, 'genkit_fallback');
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
