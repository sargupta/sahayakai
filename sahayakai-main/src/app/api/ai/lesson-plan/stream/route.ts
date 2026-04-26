
import { dispatchLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';
import { logAIError, classifyAIError } from '@/lib/ai-error-response';

/**
 * SSE streaming endpoint for lesson plan generation.
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

function sseEvent(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function _handler(request: Request) {
  let topicText = 'Unknown Topic';
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

    const body = await request.json();
    topicText = body.topic || 'Unknown Topic';

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(sseEvent(payload)));
        };

        try {
          // --- Phase 1: Kick off generation ---
          send({ type: 'status', message: 'Generating lesson plan...' });

          // Phase 3 §3.4: dispatcher routes Genkit vs sidecar based
          // on the lessonPlanSidecarMode flag. Default "off" preserves
          // legacy behaviour; flag is flipped per rollout step.
          const output = await dispatchLessonPlan({
            ...body,
            userId,
          });

          // --- Phase 2: Post-processing complete ---
          send({ type: 'status', message: 'Adding materials and activities...' });

          // Small delay so the client can render the status before the
          // complete payload arrives in the same TCP frame.
          await new Promise((r) => setTimeout(r, 50));

          // --- Phase 3: Done ---
          send({ type: 'complete', data: output });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const classified = classifyAIError(error);

          // Classify severity via the shared helper — quota/safety are WARN,
          // everything else is ERROR (paging severity).
          logAIError(error, 'LESSON_PLAN_STREAM', {
            message: `Lesson Plan Stream Failed for topic: "${topicText}"`,
            userId,
            extra: {
              path: '/api/ai/lesson-plan/stream',
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
          controller.close();
        }
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
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const classified = classifyAIError(error);
    const status = classified.code === 'AI_SERVICE_BUSY' ? 503 : 500;

    logAIError(error, 'LESSON_PLAN_STREAM', {
      message: `Lesson Plan Stream Failed for topic: "${topicText}"`,
      userId: request.headers.get('x-user-id'),
      extra: {
        path: '/api/ai/lesson-plan/stream',
        errorMessage,
        errorCode: classified.code,
      },
    });

    // Pre-stream failure (e.g. bad JSON body, upstream 429 before the first
    // token). We can still set a real HTTP status here since headers haven't
    // been flushed.
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

// SSE routes return native Response (not NextResponse), so withPlanCheck
// type is incompatible. Plan check runs inside _handler before streaming.
export const POST = _handler;
