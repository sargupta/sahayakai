/**
 * POST /api/sampark-demo/turn — the AI agent's next line on a demo call.
 *
 * Input:  { callId, context, transcript, parentSpeech, turnNumber }
 * Output: { reply, shouldEndCall, source: 'ai' | 'fallback' }
 * Auth:   none (public demo); SAMPARK_DEMO_ENABLED === 'true' else 404; rate-limited.
 */

import { handleDemoTurn } from '@/server/sampark/demo';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    return handleDemoTurn(req);
}
