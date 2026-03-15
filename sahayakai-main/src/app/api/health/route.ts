import { NextResponse } from 'next/server';

export async function GET() {
    const checks = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        version: process.env.npm_package_version || 'unknown',
        environment: process.env.NODE_ENV || 'unknown',
        checks: {
            server: {
                healthy: true,
                uptime: process.uptime()
            },
            environment: {
                healthy: !!(
                    process.env.GOOGLE_GENAI_API_KEY &&
                    process.env.FIREBASE_SERVICE_ACCOUNT_KEY &&
                    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
                ),
                missingVars: [
                    !process.env.GOOGLE_GENAI_API_KEY && 'GOOGLE_GENAI_API_KEY',
                    !process.env.FIREBASE_SERVICE_ACCOUNT_KEY && 'FIREBASE_SERVICE_ACCOUNT_KEY',
                    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
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
