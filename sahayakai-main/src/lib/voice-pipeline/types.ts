/**
 * Voice Pipeline Provider Abstraction
 *
 * Defines interfaces for STT, TTS, and LLM providers used in the
 * Parent Call feature. Allows switching between hosted (SahayakAI servers),
 * API-based (Sarvam, Google), and self-hosted (open-source) providers.
 */

// ── Pipeline Configuration ──────────────────────────────────────────────────

export type PipelineMode = 'streaming' | 'batch' | 'auto';

export interface VoicePipelineConfig {
    /** 'streaming' = Twilio Media Streams + Pipecat, 'batch' = existing <Gather>/<Say>, 'auto' = try streaming, fallback to batch */
    mode: PipelineMode;
    /** WebSocket URL for the streaming orchestrator (e.g. wss://voice.sahayakai.com/ws) */
    orchestratorWsUrl: string;
    /** HTTP URL for the orchestrator API (e.g. https://voice.sahayakai.com) */
    orchestratorApiUrl: string;
    /** Service-to-service auth key for internal APIs */
    internalApiKey: string;
}

// ── STT Provider ────────────────────────────────────────────────────────────

export type STTProviderName = 'sarvam' | 'twilio' | 'gemini' | 'indicconformer';

export interface STTResult {
    text: string;
    language?: string;
    confidence?: number;
}

// ── TTS Provider ────────────────────────────────────────────────────────────

export type TTSProviderName = 'sarvam' | 'google' | 'indicf5';

export interface TTSResult {
    /** Base64-encoded audio (MP3 or WAV) */
    audioContent: string;
    /** Audio format: 'mp3' | 'wav' */
    format: 'mp3' | 'wav';
    /** Sample rate of the output audio */
    sampleRate: number;
}

// ── Pipeline Health ─────────────────────────────────────────────────────────

export interface PipelineHealthStatus {
    available: boolean;
    mode: PipelineMode;
    latencyMs?: number;
    lastChecked: number; // epoch ms
    error?: string;
}
