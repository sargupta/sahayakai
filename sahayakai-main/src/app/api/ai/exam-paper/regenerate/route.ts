/**
 * @fileOverview POST /api/ai/exam-paper/regenerate — regenerate a SINGLE
 * exam-paper question via the LLM (same chapter, same marks, fresh answer key).
 *
 * Deliberately NO withPlanCheck: like the PUT save on the sibling route (its
 * H2 comment), this is a refinement of already-generated (already-charged)
 * content, not a new paper — gating it would double-charge the teacher's quota.
 * Auth (x-user-id) + the examPaperQuestionRegen feature flag still apply.
 */

import { NextResponse } from 'next/server';
import { handleAIError } from '@/lib/ai-error-response';
import { isFeatureEnabled } from '@/lib/feature-flags';

// A single-question regen is one bounded model call (plus at most one retry),
// far cheaper than whole-paper generation — the default budget is plenty.
export const maxDuration = 60;

async function _handler(request: Request) {
  try {
    // x-user-id is injected by middleware.ts (the trust boundary strips any
    // client-supplied copy), so it's safe to trust here.
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
    }

    const flag = await isFeatureEnabled('examPaperQuestionRegen', userId);
    if (!flag.enabled) {
      return NextResponse.json({ error: 'Feature disabled', reason: flag.reason }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body.board || !body.gradeLevel || !body.subject || !body.originalQuestionText) {
      return NextResponse.json(
        { error: 'Missing required fields: board, gradeLevel, subject, originalQuestionText' },
        { status: 400 },
      );
    }
    if (typeof body.marks !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid required field: marks (number)' }, { status: 400 });
    }

    const { regenerateExamQuestion } = await import('@/ai/flows/regenerate-exam-question');
    const question = await regenerateExamQuestion({
      board: String(body.board),
      gradeLevel: String(body.gradeLevel),
      subject: String(body.subject),
      language: typeof body.language === 'string' && body.language.trim() ? body.language : 'English',
      chapters: Array.isArray(body.chapters) ? (body.chapters as string[]) : [],
      originalQuestionText: String(body.originalQuestionText),
      marks: body.marks,
      isMcq: !!body.isMcq,
      optionCount: typeof body.optionCount === 'number' ? body.optionCount : 4,
      includeAnswerKey: body.includeAnswerKey !== false,
      includeMarkingScheme: body.includeMarkingScheme !== false,
      internalChoice: !!body.internalChoice,
    });

    return NextResponse.json({ question });
  } catch (error) {
    // Route quota/safety/schema failures through the shared mapper (503/400/422)
    // instead of a bare 500 — same convention as the generate route.
    return handleAIError(error, 'EXAM_PAPER_REGEN', {
      message: 'Exam paper question regeneration failed',
      userId: request.headers.get('x-user-id'),
    });
  }
}

// No withPlanCheck — refinement of already-charged content (see file header).
export const POST = _handler;
