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
});

/**
 * AI Resilience Strategy: "The Presentation Guard"
 */

let keyPool: string[] = [];

async function ensureKeyPool() {
  if (keyPool.length > 0) return;

  try {
    const secretKeys = await getSecret('GOOGLE_GENAI_API_KEY');
    keyPool = secretKeys
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    console.log(`[AI Resilience] Loaded ${keyPool.length} keys from Secret Manager. Fingerprints: ${keyPool.map(k => k.substring(0, 8) + '...').join(', ')}`);
  } catch (error) {
    console.warn('[AI Resilience] Failed to load keys from Secret Manager, falling back to process.env');
    const isPlaceholder = (val: string) => val.startsWith('secrets/');
    keyPool = (process.env.GOOGLE_GENAI_API_KEY || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k && !isPlaceholder(k));

    if (keyPool.length > 0) {
      console.log(`[AI Resilience] Fallback loaded ${keyPool.length} keys. Fingerprints: ${keyPool.map(k => k.substring(0, 8) + '...').join(', ')}`);
    }
  }
}

/**
 * Executes an AI operation resiliently across the key pool.
 * Automatically fails over to the next key on 429 (Rate Limit) or 401 (Auth) errors.
 */
export async function runResiliently<T>(fn: (overrideConfig: { config: { apiKey?: string } }) => Promise<T>): Promise<T> {
  await ensureKeyPool();
  const poolSize = keyPool.length;

  // If no pool is defined and we are falling back, throw a descriptive error instead of letting 
  // the AI plugin use an invalid placeholder from process.env
  if (poolSize === 0) {
    throw new Error('AI Configuration Error: No valid API keys found in Secret Manager or local .env. If running locally, please run "gcloud auth application-default login" or provide a valid GOOGLE_GENAI_API_KEY in .env.local (without the "secrets/" prefix).');
  }

  let lastError: any;
  const startIndex = Math.floor(Math.random() * poolSize);

  // Try up to 3 keys from the pool to avoid infinite loops and unnecessary latency
  const maxAttempts = Math.min(poolSize, 3);

  for (let i = 0; i < maxAttempts; i++) {
    const currentIndex = (startIndex + i) % poolSize;
    const currentKey = keyPool[currentIndex];

    try {
      return await fn({ config: { apiKey: currentKey } });
    } catch (error: any) {
      lastError = error;

      // COMPREHENSIVE ERROR LOGGING - Capture ALL error details
      console.error('[AI Resilience Error - Full Details]', {
        timestamp: new Date().toISOString(),
        keyIndex: currentIndex,
        attemptNumber: i + 1,
        maxAttempts,
        errorType: error.constructor?.name || 'Unknown',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        errorStatus: error.status,
        // CRITICAL: Genkit puts schema validation details here
        errorDetail: error.detail,
        parseErrors: error.detail?.parseErrors,
        validationErrors: error.detail?.validationErrors,
        // Full stack trace
        errorStack: error.stack,
        // Serialize the entire error object to catch any hidden properties
        fullErrorObject: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      });

      const status = error.status ||
        (error.message?.includes('429') ? 429 :
          error.message?.includes('401') ? 401 :
            error.message?.includes('403') ? 403 : null);

      if (status === 429 || status === 401 || status === 403) {
        const delay = 1000 * Math.pow(2, i); // Exponential backoff: 1s, 2s, 4s
        console.warn(`[AI Resilience] Failover triggered: Key ${currentIndex} failed with ${status}. Waiting ${delay}ms before retrying with next key...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For safety filters, bad requests, or other logic errors, don't retry with a new key
      console.error('[AI Resilience] Non-retryable error encountered. Throwing immediately.');
      throw error;
    }
  }

  throw lastError;
}
