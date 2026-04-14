/**
 * Voice Pipeline Configuration
 *
 * Reads pipeline settings from environment variables.
 * Defaults to 'auto' mode which tries the streaming pipeline
 * and falls back to the existing batch (Twilio <Gather>/<Say>) pipeline.
 */

import type { VoicePipelineConfig, PipelineMode } from './types';

const DEFAULT_MODE: PipelineMode = 'batch'; // Start safe — batch until streaming is proven

export function getVoicePipelineConfig(): VoicePipelineConfig {
    return {
        mode: (process.env.VOICE_PIPELINE_MODE as PipelineMode) || DEFAULT_MODE,
        orchestratorWsUrl: process.env.VOICE_PIPELINE_WS_URL || '',
        orchestratorApiUrl: process.env.VOICE_PIPELINE_API_URL || '',
        internalApiKey: process.env.VOICE_PIPELINE_INTERNAL_KEY || '',
    };
}

/** Quick check: is the streaming pipeline configured at all? */
export function isStreamingConfigured(): boolean {
    const config = getVoicePipelineConfig();
    return config.mode !== 'batch' && !!config.orchestratorWsUrl;
}
