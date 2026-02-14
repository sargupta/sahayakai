import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// 1. Central Genkit Instance
// This instance uses the default GOOGLE_GENAI_API_KEY from the environment
// but we will override it dynamically for resilience.
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

/**
 * AI Resilience Strategy: "The Presentation Guard"
 * This layer ensures that if one API key hits a rate limit (429), 
 * the application automatically retries with a backup key from the pool.
 */

// Parse the key pool from environment
const keyPool = (process.env.GOOGLE_GENAI_API_KEY || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

/**
 * Executes an AI operation resiliently across the key pool.
 * Automatically fails over to the next key on 429 (Rate Limit) or 401 (Auth) errors.
 */
export async function runResiliently<T>(fn: (overrideConfig: { config: { apiKey?: string } }) => Promise<T>): Promise<T> {
  const poolSize = keyPool.length;

  // If no pool is defined, just run the function once with empty config
  if (poolSize === 0) return await fn({ config: {} });

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
          error.message?.includes('401') ? 401 : null);

      if (status === 429 || status === 401) {
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
