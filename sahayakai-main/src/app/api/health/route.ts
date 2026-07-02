import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
    // Middleware leaves this route public, so x-user-id is only set when a
    // valid Firebase ID token was presented. Unauthenticated callers get a
    // minimal {status} body; detailed build/env provenance (SHAs, build id,
    // NODE_ENV, names of missing env vars) is only exposed to authenticated
    // callers to avoid handing attackers targeting information.
    const headersList = await headers();
    const isAuthed = !!headersList.get('x-user-id');

    const checks = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        version: process.env.npm_package_version || 'unknown',
        environment: process.env.NODE_ENV || 'unknown',
        // Build-time provenance. Injected via Docker --build-arg from
        // Cloud Build's $SHORT_SHA / $COMMIT_SHA / $BUILD_ID. Lets us
        // answer "which SHA is live RIGHT NOW?" with one curl.
        // Local `npm run build` reports "local" for all three.
        build: {
            gitSha: process.env.GIT_SHA || 'local',
            gitShaFull: process.env.GIT_SHA_FULL || 'local',
            buildId: process.env.BUILD_ID || 'local',
        },
        checks: {
            server: {
                healthy: true,
                uptime: process.uptime()
            },
            environment: {
                healthy: !!(
                    process.env.GOOGLE_GENAI_API_KEY &&
                    process.env.FIREBASE_SERVICE_ACCOUNT_KEY
                ),
                missingVars: [
                    !process.env.GOOGLE_GENAI_API_KEY && 'GOOGLE_GENAI_API_KEY',
                    !process.env.FIREBASE_SERVICE_ACCOUNT_KEY && 'FIREBASE_SERVICE_ACCOUNT_KEY',
                ].filter(Boolean)
            }
        }
    };

    const allHealthy = Object.values(checks.checks).every(c => c.healthy);
    const status = allHealthy ? 200 : 503;
    const cacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    // Public callers get only a coarse liveness signal — no build provenance,
    // no environment names, no missing-var listing.
    if (!isAuthed) {
        return NextResponse.json(
            { status: allHealthy ? 'ok' : 'unhealthy' },
            { status, headers: cacheHeaders },
        );
    }

    // Authenticated callers get the full diagnostic payload.
    return NextResponse.json(checks, {
        status,
        headers: cacheHeaders,
    });
}
