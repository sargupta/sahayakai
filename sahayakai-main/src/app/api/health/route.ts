import { NextResponse } from 'next/server';

export async function GET() {
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

    return NextResponse.json(checks, {
        status: allHealthy ? 200 : 503,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}
