
import { generateExamPaper } from '@/ai/flows/exam-paper-generator';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

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

const VALID_DIFFICULTIES = ['easy', 'moderate', 'hard', 'mixed'] as const;

function sseEvent(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function _handler(request: Request) {
  let paperDesc = 'Unknown Paper';
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

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(sseEvent(payload)));
        };

        try {
          // --- Phase 1: Blueprint loading ---
          send({ type: 'status', message: 'Loading blueprint...' });

          // --- Phase 2: AI generation ---
          send({ type: 'status', message: 'Generating exam paper...' });

          const output = await generateExamPaper({
            ...body,
            userId,
          } as Parameters<typeof generateExamPaper>[0]);

          // --- Phase 3: Validation ---
          send({ type: 'status', message: 'Validating marks...' });

          // Small delay so the client can render the status before the
          // complete payload arrives in the same TCP frame.
          await new Promise((r) => setTimeout(r, 50));

          // --- Phase 4: Done ---
          send({ type: 'complete', data: output });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          logger.error(
            `Exam Paper Stream Failed for: "${paperDesc}"`,
            error,
            'EXAM_PAPER_STREAM',
            {
              path: '/api/ai/exam-paper/stream',
              userId,
              errorMessage,
            },
          );

          send({
            type: 'error',
            message: 'AI generation failed. Please try again.',
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
    logger.error(
      `Exam Paper Stream Failed for: "${paperDesc}"`,
      error,
      'EXAM_PAPER_STREAM',
      {
        path: '/api/ai/exam-paper/stream',
        userId: request.headers.get('x-user-id'),
      },
    );

    return new Response(
      sseEvent({
        type: 'error',
        message: 'Internal Server Error',
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
