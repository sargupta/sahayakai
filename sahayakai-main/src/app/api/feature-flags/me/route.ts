/**
 * GET /api/feature-flags/me
 *
 * Returns the whitelisted set of client-readable feature flags evaluated
 * for the currently-authenticated user. The client provider
 * (`FeatureFlagsContext` in `src/context/feature-flags-context.tsx`) hits
 * this on app boot + caches the result.
 *
 * Why a whitelist: the Firestore feature_flags doc contains admin-only
 * flags (billing kill switch, sidecar modes per agent, etc.). Those must
 * NOT leak to clients. The whitelist below is the explicit subset that
 * client-rendered UI is allowed to read.
 *
 * Adding a new client-side flag:
 *   1. Add the key to CLIENT_READABLE_FLAGS below
 *   2. Document in docs/operations/FEATURE_FLAGS.md
 *   3. Use `useFeatureFlag('<key>')` from `@/context/feature-flags-context`
 *
 * Auth: any signed-in user. Unauthenticated callers get 401.
 *
 * Response shape:
 *   { flags: { <key>: boolean, ... }, evaluatedAt: ISO timestamp }
 *
 * Failure behaviour: if Firestore is unreachable or the flag system
 * throws, returns the safe defaults (every flag defaults to `true` per
 * the existing `isFeatureEnabled` "not configured = enabled" rule). The
 * client should treat the API as best-effort and fall back to defaults
 * on any non-200 response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/feature-flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Whitelist of flag keys the client can read. Add new client-side flags
 * here. NEVER add admin-only flags (billingKillSwitch, sidecar modes,
 * subscriptionRolloutPercent, etc.) — they live on the same Firestore
 * doc but stay server-only.
 */
const CLIENT_READABLE_FLAGS = [
    // Demo / persona surfaces
    'communityPersonas',
    'assessmentScannerDemoMode',
    // VIDYA UX toggles (intent cache gate, greeting suppressor — wrapped later)
    'vidyaIntentCacheGate',
    'vidyaGreetingSuppressor',
    // NCERT validation UI surfaces
    'ncertChapterValidation',
    // Gemini model rollout (client may want to label which model produced output)
    'geminiFlash2_0',
    // Master demo gate
    'demoMode',
] as const;

export type ClientReadableFlag = (typeof CLIENT_READABLE_FLAGS)[number];

export async function GET(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flags: Record<string, boolean> = {};
    await Promise.all(
        CLIENT_READABLE_FLAGS.map(async (key) => {
            try {
                const result = await isFeatureEnabled(key, userId);
                flags[key] = result.enabled;
            } catch {
                // Safe default — match the "not configured = enabled" rule.
                flags[key] = true;
            }
        }),
    );

    return NextResponse.json(
        { flags, evaluatedAt: new Date().toISOString() },
        {
            headers: {
                // Short cache — flags refresh on next mount, not stale forever.
                'Cache-Control': 'private, max-age=60, must-revalidate',
            },
        },
    );
}
