/**
 * POST /api/ai/assessment-scanner
 *
 * Run the AI grading flow on an uploaded student answer page.
 *
 * Phase 1 hard limits:
 *   - 1 page per request (enforced here, schema allows up to 15)
 *   - subject must be Mathematics
 * These constraints lift in Phase 2 once multi-page UX + non-math prompts are
 * verified. The schema-level cap (ASSESSMENT_MAX_PAGES = 15) is the long-term
 * ceiling.
 *
 * Pattern mirrors `/api/ai/quiz/route.ts`:
 *   - Auth via x-user-id header (middleware-injected)
 *   - Plan + quota gating via withPlanCheck('assessment-scanner')
 *   - Zod-validated body
 *   - handleAIError for consistent error responses
 */

import { NextResponse } from 'next/server';
import {
    AssessmentScannerInputSchema,
    PHASE_1_PAGE_CAP,
} from '@/ai/schemas/assessment-scanner-schemas';
import { gradeAssessment } from '@/ai/flows/assessment-scanner';
import { handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';

const PHASE_1_ALLOWED_SUBJECTS = new Set(['Mathematics']);

async function _handler(request: Request) {
    let assessmentId = 'unknown';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing User Identity' },
                { status: 401 },
            );
        }

        const json = await request.json();
        assessmentId = json.assessmentId || 'unknown';

        // Validate against the long-term schema first — this catches obvious
        // client mistakes (bad UUID, missing fields) early.
        const body = AssessmentScannerInputSchema.parse({ ...json, userId });

        // Phase-1 guard rails (intentionally not in the schema so we can
        // remove them in one place once Phase 2 lands).
        if (body.pageUrls.length > PHASE_1_PAGE_CAP) {
            return NextResponse.json(
                {
                    error: 'PHASE_LIMIT',
                    message: `Multi-page scanning ships in Phase 2. Please upload ${PHASE_1_PAGE_CAP} page at a time for now.`,
                    code: 'PHASE_1_PAGE_CAP',
                },
                { status: 400 },
            );
        }
        if (!PHASE_1_ALLOWED_SUBJECTS.has(body.subject)) {
            return NextResponse.json(
                {
                    error: 'PHASE_LIMIT',
                    message: 'Phase 1 supports Mathematics only. Other subjects ship in Phase 2.',
                    code: 'PHASE_1_SUBJECT',
                    allowedSubjects: Array.from(PHASE_1_ALLOWED_SUBJECTS),
                },
                { status: 400 },
            );
        }

        const result = await gradeAssessment(body);
        return NextResponse.json(result);
    } catch (error) {
        return handleAIError(error, 'ASSESSMENT_SCANNER', {
            message: `Assessment Scanner API failed for assessmentId: "${assessmentId}"`,
            userId: request.headers.get('x-user-id'),
        });
    }
}

export const POST = withPlanCheck('assessment-scanner')(_handler);
