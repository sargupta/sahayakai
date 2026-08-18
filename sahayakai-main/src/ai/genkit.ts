import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';

// Protection against placeholder keys in process.env
const isPlaceholder = (val: string | undefined) => !val || val.startsWith('secrets/');
if (isPlaceholder(process.env.GOOGLE_API_KEY)) delete process.env.GOOGLE_API_KEY;
if (isPlaceholder(process.env.GEMINI_API_KEY)) delete process.env.GEMINI_API_KEY;

// 1. Central Genkit Instance
// GENKIT_DEFAULT_MODEL env override lets ops swap without a code change.
// Default is `gemini-2.5-flash` — `gemini-2.0-flash` was moved off because
// its free-tier per-minute quota was saturating in production (quiz flow
// calls the API 3× in parallel, one per difficulty, which hits the cap
// fast). 2.5-flash has the same pricing class with better throughput.
// Vertex AI is the default provider: billed via Cloud Billing (startup credits
// apply), authenticated via ADC/service identity — no API keys, no prepay.
// Rollback lever: set GENKIT_DEFAULT_MODEL='googleai/gemini-2.5-flash' on the
// service to revert to the AI Studio key-pool path without a redeploy.
export const DEFAULT_MODEL = 'vertexai/gemini-2.5-flash';
const activeModel = process.env.GENKIT_DEFAULT_MODEL || DEFAULT_MODEL;
export const usingVertex = activeModel.startsWith('vertexai/');

export const ai = genkit({
  plugins: [
    vertexAI({ projectId: process.env.GCLOUD_PROJECT || 'sahayakai-b4248', location: 'us-central1' }),
    googleAI(), // still serves googleai/* models (images, 2.5-pro) via the per-call key pool
  ],
  model: activeModel,
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
    logger.info('Dev mode — using Genkit Dev UI for traces (Firebase telemetry skipped)', 'Telemetry');
    return;
  }

  try {
    const { enableFirebaseTelemetry } = await import('@genkit-ai/firebase');
    await enableFirebaseTelemetry({
      forceDevExport: false,
      metricExportIntervalMillis: 300_000,  // 5 min (must be >= exportTimeoutMillis default of 30s)
      metricExportTimeoutMillis: 30_000,
    });
    logger.info('Firebase telemetry enabled (Cloud Trace + Cloud Logging)', 'Telemetry');
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

    // Vertex mode: auth is ADC/service identity — no API keys. A single
    // sentinel entry keeps the retry/backoff loop (Vertex 429s still benefit)
    // while skipping Secret Manager entirely (faster cold start).
    if (usingVertex) {
      keyPool = [''];
      logger.info('Vertex mode — key pool bypassed (ADC auth)', 'AI Resilience');
      return;
    }

    try {
      const secretKeys = await getSecret('GOOGLE_GENAI_API_KEY');
      keyPool = secretKeys
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
      logger.info('Loaded keys from Secret Manager', 'AI Resilience', { keyCount: keyPool.length });

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
        logger.info('Fallback active', 'AI Resilience', { keyCount: keyPool.length });
      }
    }
  })();

  return keyPoolPromise;
}

/**
 * Typed error thrown when the model is quota-exhausted after all retries.
 * Callers (API routes) should catch this and return HTTP 503 with a
 * Retry-After header so the client shows a friendly message instead of
 * a generic 500.
 */
export class AIQuotaExhaustedError extends Error {
  readonly status = 503;
  readonly retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds = 60) {
    super(message);
    this.name = 'AIQuotaExhaustedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Classify the status code from a Gemini error.
 * Gemini SDK sometimes sets .status, sometimes only embeds the code in message.
 */
function classifyStatus(error: any): number | null {
  if (typeof error?.status === 'number') return error.status;
  const msg = String(error?.message || '');
  if (msg.includes('429') || msg.includes('Resource exhausted') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
  if (msg.includes('401') || msg.includes('Unauthorized')) return 401;
  if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('denied access')) return 403;
  if (msg.includes('400') || msg.includes('Invalid') || msg.includes('API key expired')) return 400;
  if (msg.includes('500') || msg.includes('Internal')) return 500;
  return null;
}

/** Small jitter (±25% of base) to avoid thundering-herd when many users retry together. */
function jittered(ms: number): number {
  const jitter = ms * 0.25 * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(ms + jitter));
}

/**
 * Executes an AI operation resiliently:
 *   1. Across the key pool (failover on 429/401/403)
 *   2. With longer same-key backoff if the pool is small — per-minute quota
 *      windows usually reset within 30-60s, so a 20s backoff recovers the
 *      call without surfacing an error.
 *
 * On final exhaustion throws AIQuotaExhaustedError with Retry-After hint.
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
  let last429 = false;
  const startIndex = Math.floor(Math.random() * poolSize);

  // When the pool has >1 key, favour failover (each attempt = different key).
  // When the pool has 1 key (common in dev / free tier), we still want a few
  // attempts — subsequent retries hit the same key after a longer backoff,
  // which is the right strategy for per-minute quota ceilings.
  const maxAttempts = Math.max(3, Math.min(poolSize, 5));

  // Total-time budget for the retry loop (waits + attempts). Every caller
  // that wraps this in the dispatcher's `withTimeout` uses FALLBACK_TIMEOUT_MS
  // = 60_000ms (src/lib/sidecar/with-timeout.ts). The single-key 429 backoff
  // below (20s → 40s) can exceed that window, in which case `withTimeout`
  // wins the race and throws an UNCLASSIFIED `WithTimeoutError` *instead of*
  // our typed `AIQuotaExhaustedError` — which is exactly why the 2026-06-09
  // scan saw quota failures surface as 500/ERROR rather than a clean 503.
  // Cap the loop below the 60s wrapper so we always break early and throw the
  // typed 503 first. Leaves ~10s headroom for the final attempt + response.
  const MAX_TOTAL_BUDGET_MS = 50_000;

  for (let i = 0; i < maxAttempts; i++) {
    const currentIndex = (startIndex + i) % poolSize;
    const currentKey = keyPool[currentIndex];

    try {
      const result = await fn(currentKey ? { config: { apiKey: currentKey } } : { config: {} });

      if (spanName) {
        logger.info(`${spanName} completed`, 'Trace', {
          spanName,
          keyIndex: currentIndex,
          attempts: i + 1,
          latencyMs: Date.now() - startTime,
        });
      }

      return result;
    } catch (error: any) {
      lastError = error;
      const status = classifyStatus(error);
      last429 = status === 429;

      console.error(`[AI Resilience] ${spanName || 'unknown'} attempt ${i + 1}/${maxAttempts} failed`, {
        keyIndex: currentIndex,
        poolSize,
        attemptNumber: i + 1,
        errorType: error.constructor?.name || 'Unknown',
        errorStatus: status,
        errorMessage: (error.message || '').slice(0, 200),
        latencyMs: Date.now() - startTime,
      });

      // Retry only on transient / auth errors. Safety filters + bad requests
      // should fail fast — no amount of retry will fix them.
      if (status !== 429 && status !== 401 && status !== 403) {
        throw error;
      }

      // On the last attempt, don't wait — throw the shaped error.
      if (i === maxAttempts - 1) break;

      // Backoff strategy:
      //   - 429 (quota) with single-key pool: longer waits (20s, 40s) so the
      //     per-minute quota window resets. Capped at 60s total across retries
      //     to stay well under Cloud Run's 300s timeout.
      //   - 429/401/403 with multi-key pool: short waits (1s, 2s, 4s) — we
      //     mostly care about rotating, not waiting.
      //   - 401/403 anywhere: short waits (auth errors rarely benefit from
      //     long waits).
      let delay: number;
      if (status === 429 && poolSize === 1) {
        delay = jittered(20000 * Math.pow(2, i)); // 20s → 40s → 80s (last one caught by break above)
      } else if (status === 429) {
        delay = jittered(3000 * Math.pow(2, i));  // 3s → 6s → 12s
      } else {
        delay = jittered(1000 * Math.pow(2, i));  // 1s → 2s → 4s
      }

      // Budget guard: if waiting `delay` would push the loop past the total
      // budget (and therefore past the caller's 60s `withTimeout`), stop now
      // and let the typed AIQuotaExhaustedError below surface as a clean 503,
      // instead of letting the wrapper fire an unclassified WithTimeoutError.
      // This is what makes the 2026-06-09 quota failures return 503 (WARN)
      // rather than 500 (ERROR) at their true source.
      const elapsed = Date.now() - startTime;
      if (elapsed + delay > MAX_TOTAL_BUDGET_MS) {
        console.warn(`[AI Resilience] ${status} on key ${currentIndex}. Budget exhausted (${elapsed}ms elapsed + ${delay}ms wait > ${MAX_TOTAL_BUDGET_MS}ms); surfacing typed error early.`);
        break;
      }

      console.warn(`[AI Resilience] ${status} on key ${currentIndex}. Backing off ${delay}ms before retry ${i + 2}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted. Surface a typed error so API routes can return
  // a clean 503 with Retry-After instead of a generic 500.
  if (last429) {
    throw new AIQuotaExhaustedError(
      'AI service is temporarily overloaded. Please try again in a minute.',
      60,
    );
  }
  throw lastError;
}
