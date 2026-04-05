import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { getSecret } from '@/lib/secrets';

// Protection against placeholder keys in process.env
const isPlaceholder = (val: string | undefined) => !val || val.startsWith('secrets/');
if (isPlaceholder(process.env.GOOGLE_API_KEY)) delete process.env.GOOGLE_API_KEY;
if (isPlaceholder(process.env.GEMINI_API_KEY)) delete process.env.GEMINI_API_KEY;

// 1. Central Genkit Instance
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
  // promptDir: 'src/ai/prompts',  // TODO: Enable after migrating flows from inline definePrompt() to ai.prompt()
});

// 2. Telemetry (lazy init — imported by dev.ts and first API call)
let telemetryInitialized = false;

export async function initTelemetry() {
  if (telemetryInitialized) return;
  telemetryInitialized = true;

  // In local dev, the Genkit Dev UI captures traces natively — no Firebase plugin needed.
  // Firebase telemetry is only for production (Cloud Run / GCE) where Cloud Trace is available.
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    console.log('[Telemetry] ℹ️ Dev mode — using Genkit Dev UI for traces (Firebase telemetry skipped)');
    return;
  }

  try {
    const { enableFirebaseTelemetry } = await import('@genkit-ai/firebase');
    await enableFirebaseTelemetry({
      forceDevExport: false,
      metricExportIntervalMillis: 300_000,  // 5 min (must be >= exportTimeoutMillis default of 30s)
      metricExportTimeoutMillis: 30_000,
    });
    console.log('[Telemetry] ✅ Firebase telemetry enabled (Cloud Trace + Cloud Logging)');
  } catch (error) {
    // Telemetry failure must not crash the app
    console.warn('[Telemetry] ⚠️ Could not enable Firebase telemetry:', error instanceof Error ? error.message : 'Unknown');
  }
}

/**
 * AI Resilience Strategy: "The Presentation Guard"
 */

let keyPoolPromise: Promise<void> | null = null;
let keyPool: string[] = [];

async function ensureKeyPool() {
  if (keyPool.length > 0) return;
  if (keyPoolPromise) return keyPoolPromise;

  keyPoolPromise = (async () => {
    // Initialize telemetry alongside the key pool (runs once)
    await initTelemetry();

    try {
      const secretKeys = await getSecret('GOOGLE_GENAI_API_KEY');
      keyPool = secretKeys
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      console.log(`[AI Resilience] ✅ Loaded ${keyPool.length} keys from Secret Manager. Fingerprints: ${keyPool.map(k => k.substring(0, 8) + '...').join(', ')}`);

      if (keyPool.length < 2) {
        console.warn(`[AI Resilience] ⚠️ WARNING: Only ${keyPool.length} key(s) in pool. Consider adding more for resilience.`);
      }
    } catch (error) {
      console.error('[AI Resilience] ❌ Fallback Triggered: Local/Process API key will be used.', {
        error: error instanceof Error ? error.message : 'Unknown'
      });

      const isPlaceholder = (val: string) => val.startsWith('secrets/');
      keyPool = (process.env.GOOGLE_GENAI_API_KEY || '')
        .split(',')
        .map(k => k.trim())
        .filter(k => k && !isPlaceholder(k));

      if (keyPool.length > 0) {
        console.log(`[AI Resilience] ✅ Fallback active. Fingerprints: ${keyPool.map(k => k.substring(0, 8) + '...').join(', ')}`);
      }
    }
  })();

  return keyPoolPromise;
}

/**
 * Executes an AI operation resiliently across the key pool.
 * Automatically fails over to the next key on 429 (Rate Limit) or 401 (Auth) errors.
 * @param fn — The AI operation to execute
 * @param spanName — Optional name for the tracing span (e.g. 'lessonPlan.generate')
 */
export async function runResiliently<T>(
  fn: (overrideConfig: { config: { apiKey?: string } }) => Promise<T>,
  spanName?: string,
): Promise<T> {
  await ensureKeyPool();
  const poolSize = keyPool.length;

  if (poolSize === 0) {
    throw new Error('AI Configuration Error: No valid API keys found in Secret Manager or local .env. If running locally, please run "gcloud auth application-default login" or provide a valid GOOGLE_GENAI_API_KEY in .env.local (without the "secrets/" prefix).');
  }

  const startTime = Date.now();
  let lastError: any;
  const startIndex = Math.floor(Math.random() * poolSize);
  const maxAttempts = Math.min(poolSize, 3);

  for (let i = 0; i < maxAttempts; i++) {
    const currentIndex = (startIndex + i) % poolSize;
    const currentKey = keyPool[currentIndex];

    try {
      const result = await fn({ config: { apiKey: currentKey } });

      // Log success metrics for tracing
      if (spanName) {
        console.log(`[Trace] ${spanName} completed`, {
          spanName,
          keyIndex: currentIndex,
          attempts: i + 1,
          latencyMs: Date.now() - startTime,
        });
      }

      return result;
    } catch (error: any) {
      lastError = error;

      console.error(`[AI Resilience] ${spanName || 'unknown'} attempt ${i + 1} failed`, {
        keyIndex: currentIndex,
        attemptNumber: i + 1,
        maxAttempts,
        errorType: error.constructor?.name || 'Unknown',
        errorMessage: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        errorDetail: error.detail,
        parseErrors: error.detail?.parseErrors,
        latencyMs: Date.now() - startTime,
      });

      const status = error.status ||
        (error.message?.includes('429') ? 429 :
          error.message?.includes('401') ? 401 :
            error.message?.includes('403') ? 403 : null);

      if (status === 429 || status === 401 || status === 403) {
        const delay = 1000 * Math.pow(2, i);
        console.warn(`[AI Resilience] Failover triggered: Key ${currentIndex} failed with ${status}. Waiting ${delay}ms before retrying with next key...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For safety filters, bad requests, or other logic errors, don't retry with a new key
      throw error;
    }
  }

  throw lastError;
}
