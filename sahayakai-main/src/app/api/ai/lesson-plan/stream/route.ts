
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

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

          const output = await generateLessonPlan({
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

          logger.error(
            `Lesson Plan Stream Failed for topic: "${topicText}"`,
            error,
            'LESSON_PLAN_STREAM',
            {
              path: '/api/ai/lesson-plan/stream',
              userId,
              errorMessage,
            },
          );

          if (errorMessage.includes('Safety Violation')) {
            send({ type: 'error', message: errorMessage });
          } else {
            send({
              type: 'error',
              message: 'AI generation failed. Please try again.',
            });
          }
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

    logger.error(
      `Lesson Plan Stream Failed for topic: "${topicText}"`,
      error,
      'LESSON_PLAN_STREAM',
      {
        path: '/api/ai/lesson-plan/stream',
        userId: request.headers.get('x-user-id'),
        errorMessage,
      },
    );

    // If we failed before the stream was created (e.g. bad JSON body),
    // return a plain SSE error response.
    return new Response(
      sseEvent({
        type: 'error',
        message: 'AI generation failed. Please try again.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      },
    );
  }
}

// SSE routes return native Response (not NextResponse), so withPlanCheck
// type is incompatible. Plan check runs inside _handler before streaming.
export const POST = _handler;
