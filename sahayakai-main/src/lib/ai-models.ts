/**
 * Centralized AI model name resolver.
 *
 * Single place that decides which Gemini model the rest of the codebase uses.
 * Today every `.prompt` file in `src/ai/prompts/*.prompt` and every
 * `ai.generate({ model: '...' })` call site has the model string
 * hardcoded — that means a quality regression on `gemini-2.5-flash`
 * requires editing ~20 files to revert. This resolver gives operators a
 * single Firestore flag flip to switch the whole codebase between
 * `2.0-flash` (current default, cheaper) and `2.5-pro` (slower, higher
 * quality) without a deploy.
 *
 * Wrapping pattern (incremental, one flow per PR):
 *   1. Import this resolver where the model string is hardcoded
 *   2. Replace the literal with `await getActiveGeminiModel(userId)`
 *   3. Ship + verify on preview
 *   4. Repeat for next flow
 *
 * `.prompt` files (Genkit YAML frontmatter) cannot easily call a resolver
 * — Genkit reads them at module load. For those, the wrap pattern is:
 *   - leave the .prompt frontmatter as-is (it's the BUILD-TIME default)
 *   - at runtime, override via `prompt.generate({ model: await getActiveGeminiModel(uid) })`
 *
 * Flag: `geminiFlash2_0`
 *   - ENABLED (default — `features` map default): use `gemini-2.5-flash`
 *   - DISABLED: revert to `gemini-2.5-pro`
 *
 * Toggle in Firestore at `system_config/feature_flags`:
 *   features.geminiFlash2_0.enabled = false
 *
 * See docs/operations/FEATURE_FLAGS.md for the full flag lifecycle.
 */

import { isFeatureEnabled } from './feature-flags';

/** Canonical Gemini model identifiers. Add new variants here as they roll out. */
export const GEMINI_MODELS = {
    /** Default — fast, cheap, multimodal. Production default since 2026-05-19. */
    FLASH_2_0: 'googleai/gemini-2.5-flash',
    /** Higher-quality fallback. Use when 2.0-flash regresses on edge cases. */
    PRO_2_5: 'googleai/gemini-2.5-pro',
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

/**
 * Resolve which Gemini model to use right now, based on the
 * `geminiFlash2_0` feature flag. Server-side only (Firestore admin SDK
 * read). Cached 5min per the feature-flags module.
 *
 * Pass the requesting `userId` if available (enables per-user rollout
 * targeting in the future). For background jobs / shared services, pass
 * `'system'` as a sentinel.
 */
export async function getActiveGeminiModel(userId?: string): Promise<GeminiModel> {
    const flag = await isFeatureEnabled('geminiFlash2_0', userId ?? 'system');
    return flag.enabled ? GEMINI_MODELS.FLASH_2_0 : GEMINI_MODELS.PRO_2_5;
}

/**
 * Synchronous helper that returns the build-time default (`FLASH_2_0`)
 * without consulting the flag. Use when async resolution is impossible
 * (e.g. inside `.prompt` YAML frontmatter, which Genkit reads at module
 * load). Operators flipping the flag will only affect callers that use
 * `getActiveGeminiModel` — the static frontmatter still says
 * `FLASH_2_0`. Document this asymmetry in docs/operations/FEATURE_FLAGS.md.
 */
export function getDefaultGeminiModel(): GeminiModel {
    return GEMINI_MODELS.FLASH_2_0;
}
