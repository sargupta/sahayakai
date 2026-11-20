/**
 * GET /api/exam-paper/blueprints — every official exam blueprint (board ×
 * class × subject → sections, marks, duration, chapter weightage), read
 * Firestore-first with the bundled fallback (getAllBlueprints).
 *
 * The exam-paper form (src/app/exam-paper/hooks/use-exam-paper-form.ts) has
 * always fetched this to fill the subject picker and the paper's pattern, but
 * the route was lost when Exam Paper moved out of the intern workspace, so the
 * fetch 404'd and every board looked blueprint-less. Behind the middleware's
 * token check like every non-public /api route.
 */
import { NextResponse } from 'next/server';
import { getAllBlueprints } from '@/ai/data/board-blueprints';
import { errorResponse, unauthorizedResponse } from '@/server/api-error';

export async function GET(req: Request) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();

    try {
        return NextResponse.json(await getAllBlueprints());
    } catch (err) {
        return errorResponse(err, 'EXAM_PAPER');
    }
}
