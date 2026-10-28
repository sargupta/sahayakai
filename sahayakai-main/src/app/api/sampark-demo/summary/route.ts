/**
 * POST /api/sampark-demo/summary — the teacher-facing summary of a demo call.
 *
 * Input:  { callId, context, transcript, durationSeconds }
 * Output: { summary, source: 'ai' | 'fallback' }
 * Auth:   none (public demo); SAMPARK_DEMO_ENABLED === 'true' else 404; rate-limited.
 */

import { handleDemoSummary } from '@/server/sampark/demo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    return handleDemoSummary(req);
}
