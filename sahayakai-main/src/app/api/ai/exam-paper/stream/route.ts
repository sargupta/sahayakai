
import {
  dispatchExamPaper,
  ExamPaperGenerationInProgressError,
} from '@/lib/sidecar/exam-paper-dispatch';
import { logger } from '@/lib/logger';
import { reservePlanQuota } from '@/lib/plan-guard';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { logAIError, classifyAIError } from '@/lib/ai-error-response';

/**
 * SSE streaming endpoint for exam paper generation.
 *
 * Sends progress status events while the AI flow executes, then emits the
 * complete result as a single JSON payload. This is a *progress-streaming*
 * pattern (not token-streaming) because the underlying Genkit flow returns
 * the full output at once.
 *
 * SSE event format:
 *   data: {"type":"status","message":"..."}\n\n
 *   data: {"type":"complete","data":{...}}\n\n
 *   data: {"type":"error","message":"..."}\n\n
 */

// L5 / H4 (forensic EPG-2026-07-17): match the non-stream sibling's budget so
// a slow-but-successful run isn't killed by the platform mid-stream. The 120s
// here was stale — it predated the sibling's M4 bump to 180 (the fallback path
// runs sidecar 90s + Genkit 75s = up to 165s worst case). At 120s the platform
// 504'd the SSE connection before the in-progress event could be sent.
export const maxDuration = 180;

const VALID_DIFFICULTIES = ['easy', 'moderate', 'hard', 'mixed'] as const;

function sseEvent(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function _handler(request: Request) {
  let paperDesc = 'Unknown Paper';
  let gate: Awaited<ReturnType<typeof reservePlanQuota>> | null = null;
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return new Response(
        sseEvent({ type: 'error', message: 'Unauthorized: Missing User Identity' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        },
      );
    }

    // H5 (forensic EPG-2026-07-17): master kill switch, mirroring the non-stream
    // sibling. Checked BEFORE reservePlanQuota so a disabled feature never
    // consumes quota. Unconfigured → enabled (zero-config; current behavior).
    const featureFlag = await isFeatureEnabled('examPaperEnabled', userId);
    if (!featureFlag.enabled) {
      return new Response(
        sseEvent({ type: 'error', code: 'feature_disabled', message: 'Exam paper generation is temporarily disabled.', reason: featureFlag.reason }),
        {
          status: 503,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Retry-After': '60',
          },
        },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response(
        sseEvent({ type: 'error', message: 'Invalid JSON in request body' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        },
      );
    }

    paperDesc =
      `${body.board || ''} ${body.gradeLevel || ''} ${body.subject || ''}`.trim() ||
      'Unknown Paper';

    if (!body.board || !body.gradeLevel || !body.subject) {
      return new Response(
        sseEvent({
          type: 'error',
          message: 'Missing required fields: board, gradeLevel, subject',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        },
      );
    }

    if (
      body.difficulty &&
      !VALID_DIFFICULTIES.includes(
        body.difficulty as (typeof VALID_DIFFICULTIES)[number],
      )
    ) {
      return new Response(
        sseEvent({
          type: 'error',
          message: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        },
      );
    }

    // H3.1 (forensic EPG-2026-07-17): the same anchor guard the non-stream
    // sibling has (route.ts, "NCERT demo hot-fix 2026-05-19"). With NO blueprint
    // AND no chapters, Gemini gets two open-ended constraints at once
    // ("invent the structure" + "invent the syllabus") and routinely exceeds the
    // 75s budget. This route was missing the check entirely — it didn't even
    // normalize `chapters` to []. Require SOMETHING to anchor on.
    if (!Array.isArray(body.chapters)) {
      body.chapters = [];
    }
    if ((body.chapters as string[]).length === 0) {
      const { findBlueprint } = await import('@/ai/data/board-blueprints');
      const blueprint = await findBlueprint(
        String(body.board),
        String(body.gradeLevel),
        String(body.subject),
      );
      let canAnchor = !!blueprint;
      if (!canAnchor) {
        const { canonicaliseGrade, canonicaliseSubject, getChaptersForCell } = await import('@/ai/data/ncert-chapters');
        const grade = canonicaliseGrade(String(body.gradeLevel));
        const subject = canonicaliseSubject(String(body.subject));
        canAnchor = grade != null && !!subject && getChaptersForCell(grade, subject).length > 0;
      }
      if (!canAnchor) {
        return new Response(
          sseEvent({
            type: 'error',
            code: 'chapters_required_for_unblueprinted_subject',
            message: `Please add at least one chapter for ${body.board} ${body.gradeLevel} ${body.subject}, or pick a subject we have a blueprint/syllabus for. The AI needs a chapter list to anchor the paper.`,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          },
        );
      }
    }

    // Plan/quota gate AFTER input validation (so a 400 never consumes quota),
    // BEFORE streaming. SSE returns a native Response so we use the shared
    // reservePlanQuota() rather than the withPlanCheck() HOF.
    gate = await reservePlanQuota(request, 'exam-paper');
    if (!gate.ok) {
      return new Response(
        sseEvent({ type: 'error', code: gate.body.error, message: gate.body.message ?? gate.body.error }),
        {
          status: gate.status,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        },
      );
    }

    // L6: track close/cancel so a late enqueue (heartbeat firing or a
    // dispatcher result arriving after the client disconnected) is a no-op
    // instead of throwing "Controller is already closed".
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (payload: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(sseEvent(payload)));
          } catch {
            // Controller closed under us (client gone) — drop the event.
          }
        };

        // L5: 15s keepalive comment so intermediary proxies don't drop an
        // otherwise-idle SSE connection during a long generation.
        heartbeat = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            /* closed */
          }
        }, 15_000);

        try {
          // --- Phase 1: Blueprint loading ---
          send({ type: 'status', message: 'Loading blueprint...' });

          // --- Phase 2: AI generation ---
          send({ type: 'status', message: 'Generating exam paper...' });

          // Route through dispatcher to match the non-stream sibling
          // (`/api/ai/exam-paper`). Previously this branch called the
          // raw Genkit flow and bypassed the dispatcher entirely.
          // TODO: this is a progress-event stream, not a token stream.
          // When the sidecar ADK agent gains a true streaming endpoint,
          // wire it here as a `stream: true` mode and pipe its events
          // through the SSE `controller`. For now the dispatcher's
          // single-shot result is fine — the SSE channel only sends
          // coarse phase markers ("Loading blueprint", "Generating",
          // "Validating") which we keep around the awaited call below.
          const output = await dispatchExamPaper({
            ...body,
            userId,
          } as Parameters<typeof dispatchExamPaper>[0]);

          // --- Phase 3: Validation ---
          send({ type: 'status', message: 'Validating marks...' });

          // Small delay so the client can render the status before the
          // complete payload arrives in the same TCP frame.
          await new Promise((r) => setTimeout(r, 50));

          // --- Phase 4: Done ---
          // Strip dispatcher-only metadata to keep the SSE payload
          // wire-compatible with what the legacy raw-Genkit path emitted.
          send({
            type: 'complete',
            data: {
              // H3: surface the persisted id so the client Save upserts by id.
              contentId: output.contentId,
              title: output.title,
              board: output.board,
              subject: output.subject,
              gradeLevel: output.gradeLevel,
              duration: output.duration,
              maxMarks: output.maxMarks,
              generalInstructions: output.generalInstructions,
              sections: output.sections,
              blueprintSummary: output.blueprintSummary,
              pyqSources: output.pyqSources,
              // Phase 1 marks-reconcile (2026-07-09): forward the drift
              // report + previously-dropped NCERT warnings, mirroring the
              // non-stream sibling route.
              marksReconciliation: output.marksReconciliation,
              // Phase 2 (2026-07-10): forward the answer-key/marking-scheme
              // completeness report, mirroring the non-stream sibling route.
              answerKeyCompleteness: output.answerKeyCompleteness,
              validationWarnings: output.validationWarnings,
              // C7/H1: novelty report — forward it too (route.ts allow-list mirror).
              newVerification: output.newVerification,
            },
          });
        } catch (error) {
          // H3.2 (forensic EPG-2026-07-17): a generation that blew the timeout
          // budget is STILL running in the background and may land in My Library.
          // The non-stream sibling maps this to a friendly 202; here it was
          // indistinguishable from a hard failure AND it refunded the quota for
          // a paper that will still be produced. Send a distinct in-progress
          // event and do NOT roll back the reservation.
          if (error instanceof ExamPaperGenerationInProgressError) {
            logger.warn(
              'Exam paper stream generation exceeded timeout budget',
              'EXAM_PAPER_STREAM',
              { budgetMs: error.budgetMs, elapsedMs: error.elapsedMs, paperDesc },
            );
            send({
              type: 'in_progress',
              message: 'Exam paper still generating. Check My Library in 1 minute.',
              budgetMs: error.budgetMs,
              elapsedMs: error.elapsedMs,
            });
            return; // finally still runs: heartbeat cleared, controller closed.
          }

          // Generation failed — refund the reserved quota.
          if (gate?.ok) await gate.rollback();

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const classified = classifyAIError(error);

          logAIError(error, 'EXAM_PAPER_STREAM', {
            message: `Exam Paper Stream Failed for: "${paperDesc}"`,
            userId,
            extra: {
              path: '/api/ai/exam-paper/stream',
              errorMessage,
              errorCode: classified.code,
            },
          });

          send({
            type: 'error',
            code: classified.code,
            message: classified.message,
          });
        } finally {
          if (heartbeat) clearInterval(heartbeat);
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
      // L6: client disconnected — stop the heartbeat and mark closed so any
      // in-flight send() becomes a no-op.
      cancel() {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    // Pre-stream failure after a successful reservation — refund.
    if (gate?.ok) await gate.rollback();

    const classified = classifyAIError(error);
    const status = classified.code === 'AI_SERVICE_BUSY' ? 503 : 500;

    logAIError(error, 'EXAM_PAPER_STREAM', {
      message: `Exam Paper Stream Failed for: "${paperDesc}"`,
      userId: request.headers.get('x-user-id'),
      extra: {
        path: '/api/ai/exam-paper/stream',
        errorCode: classified.code,
      },
    });

    return new Response(
      sseEvent({
        type: 'error',
        code: classified.code,
        message: classified.message,
      }),
      {
        status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...(status === 503 ? { 'Retry-After': '60' } : {}),
        },
      },
    );
  }
}

// SSE routes return native Response (not NextResponse), so the withPlanCheck
// HOF is type-incompatible. The plan/quota gate DOES run: _handler calls
// reservePlanQuota() after validation and before streaming, rolling back on failure.
export const POST = _handler;
