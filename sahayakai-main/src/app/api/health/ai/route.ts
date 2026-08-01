import { NextResponse } from 'next/server';
import { ai, DEFAULT_MODEL, usingVertex } from '@/ai/genkit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 6000;
const DEGRADED_MS = 2500;

const cacheHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
};

/**
 * Public liveness probe for the active Genkit AI provider (Vertex AI or
 * Google AI Studio). Unlike /api/ai/quiz/health this is NOT admin-gated —
 * it's a cheap 1-token ping, not a real generation flow, so it's safe to
 * expose for uptime monitoring.
 *
 * Usage: GET /api/health/ai (public)
 */
export async function GET() {
    const provider = usingVertex ? 'vertexai' : 'googleai';
    const model = process.env.GENKIT_DEFAULT_MODEL || DEFAULT_MODEL;
    const startTime = Date.now();

    try {
        const timeout = new Promise<'timeout'>((resolve) => {
            setTimeout(() => resolve('timeout'), TIMEOUT_MS);
        });

        const result = await Promise.race([
            ai.generate({ prompt: 'ping', config: { maxOutputTokens: 1, temperature: 0 } }),
            timeout,
        ]);

        const latencyMs = Date.now() - startTime;

        if (result === 'timeout') {
            logger.error('[AI Health] provider down', new Error('TimeoutError'), 'HEALTH_CHECK', { provider, model, latencyMs });
            return NextResponse.json(
                { status: 'down', provider, model, latencyMs, checkedAt: new Date().toISOString(), error: 'TimeoutError' },
                { status: 503, headers: cacheHeaders },
            );
        }

        const status = latencyMs > DEGRADED_MS ? 'degraded' : 'ok';
        if (status === 'degraded') {
            logger.warn('[AI Health] slow', 'HEALTH_CHECK', { provider, model, latencyMs });
        }

        return NextResponse.json(
            { status, provider, model, latencyMs, checkedAt: new Date().toISOString() },
            { status: 200, headers: cacheHeaders },
        );
    } catch (error) {
        const latencyMs = Date.now() - startTime;
        const errorName = error instanceof Error ? error.name : 'UnknownError';

        logger.error('[AI Health] provider down', error, 'HEALTH_CHECK', { provider, model, latencyMs });

        return NextResponse.json(
            { status: 'down', provider, model, latencyMs, checkedAt: new Date().toISOString(), error: errorName },
            { status: 503, headers: cacheHeaders },
        );
    }
}
