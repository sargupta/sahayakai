/**
 * Assignment-assessor dispatcher.
 *
 * Today: Genkit-only. The feature ships with one path so the surface
 * area stays small for v1.
 *
 * Future (PR4 in the plan at .claude/plans/uh-can-you-assign-lively-hartmanis.md):
 * an optional Sarvam OCR pre-step behind `enableSarvamOcr` so power users
 * can opt into a higher-accuracy Indic OCR pass that feeds the model an
 * `editedTranscript` in `mode='score'`. The structure below keeps that
 * extension trivial — drop the OCR call here, no schema changes needed.
 */

import {
    assessAssignment,
    type AssessAssignmentInput,
    type AssessAssignmentOutput,
} from '@/ai/flows/assignment-assessor';
import { checkServerRateLimit } from '@/lib/server-safety';

export interface AssessmentDispatchInput extends AssessAssignmentInput {
    userId: string;
}

export type AssessmentDispatchSource = 'genkit' | 'sarvam_genkit';

export interface DispatchedAssessment extends AssessAssignmentOutput {
    source: AssessmentDispatchSource;
}

export async function dispatchAssessment(
    input: AssessmentDispatchInput,
): Promise<DispatchedAssessment> {
    // Server-wide rate-limit guard (per uid). The plan-guard wrapper at the
    // route level enforces plan limits; this is the absolute floor so a
    // single user can't fan out hundreds of concurrent grading calls and
    // saturate the Gemini key pool.
    await checkServerRateLimit(input.userId);

    const out = await assessAssignment(input);
    return { ...out, source: 'genkit' };
}
