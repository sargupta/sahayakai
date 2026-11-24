import { NextResponse } from 'next/server';
import { resolveEffectiveGateMode } from '@/lib/access/access-state';

/**
 * GET /api/access/mode
 *
 * Public. Tells the marketing pages whether sign-up is open ("Start free")
 * or by request ("Request access"). Returns the EFFECTIVE rollout mode (what
 * the middleware is actually doing) and nothing else: no user data, no
 * configuration detail.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        { mode: resolveEffectiveGateMode().mode },
        { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
}
