/**
 * Voice Pipeline Health Check
 *
 * Pings the streaming orchestrator's /health endpoint.
 * Caches result for 30 seconds to avoid hammering the service.
 * Used by the call initiation route to decide streaming vs batch mode.
 */

import type { PipelineHealthStatus } from './types';
import { getVoicePipelineConfig, isStreamingConfigured } from './config';

const CACHE_TTL_MS = 30_000;
let cached: PipelineHealthStatus | null = null;

export async function checkPipelineHealth(): Promise<PipelineHealthStatus> {
    // If streaming isn't configured, always return unavailable
    if (!isStreamingConfigured()) {
        return { available: false, mode: 'batch', lastChecked: Date.now() };
    }

    // Return cached result if fresh
    if (cached && Date.now() - cached.lastChecked < CACHE_TTL_MS) {
        return cached;
    }

    const config = getVoicePipelineConfig();
    const healthUrl = `${config.orchestratorApiUrl}/health`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);

        const start = Date.now();
        const resp = await fetch(healthUrl, { signal: controller.signal });
        clearTimeout(timer);

        const latencyMs = Date.now() - start;

        if (resp.ok) {
            cached = {
                available: true,
                mode: 'streaming',
                latencyMs,
                lastChecked: Date.now(),
            };
        } else {
            cached = {
                available: false,
                mode: 'batch',
                latencyMs,
                lastChecked: Date.now(),
                error: `HTTP ${resp.status}`,
            };
        }
    } catch (err: any) {
        cached = {
            available: false,
            mode: 'batch',
            lastChecked: Date.now(),
            error: err.message?.slice(0, 100) || 'Unknown error',
        };
    }

    return cached;
}

/** Determine effective mode: streaming if healthy, batch otherwise */
export async function getEffectiveMode(): Promise<'streaming' | 'batch'> {
    const config = getVoicePipelineConfig();

    if (config.mode === 'batch') return 'batch';
    if (config.mode === 'streaming') {
        const health = await checkPipelineHealth();
        return health.available ? 'streaming' : 'batch';
    }

    // 'auto' mode: try streaming, fall back to batch
    const health = await checkPipelineHealth();
    return health.available ? 'streaming' : 'batch';
}
