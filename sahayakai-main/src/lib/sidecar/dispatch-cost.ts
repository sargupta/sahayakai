/**
 * Q3E per-agent cost telemetry.
 *
 * Each dispatcher (parent-call, quiz, lesson-plan, …) calls
 * `logDispatchCost` after every Genkit OR sidecar invocation. The
 * single structured log line is sinked into BigQuery via Cloud Logging
 * → `dispatch_cost` table (sink configured in
 * `infra/billing/dispatch-cost-log-sink.sh`). The Looker Studio
 * dashboard then SUMs `estimated_tokens` grouped by (agent, source,
 * date) for the per-agent token chart.
 *
 * `estimated_tokens` is a coarse estimate — we deliberately do NOT call
 * the Gemini token-counter API on every dispatch (extra latency + cost).
 * A char/4 heuristic for input + output is within ±20 % of the real
 * billed token count for English/Hindi prompts and is good enough to
 * spot 2× drift between sidecar and Genkit.
 *
 * Schema (one row per dispatch):
 *   event             : 'dispatch.cost'   (filter key for the sink)
 *   agent             : 'parent-call' | 'quiz' | 'lesson-plan' | …
 *   source            : 'genkit' | 'sidecar' | 'genkit_fallback'
 *   estimated_tokens  : number
 *   uid?              : string             (optional — for per-user spend if needed)
 *   latency_ms?       : number
 *
 * See qa/docs/COST_TELEMETRY.md for the aggregation queries.
 */

import { logger } from '@/lib/logger';

export type CostSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchCostInput {
    /** Agent name — e.g. 'parent-call', 'quiz'. */
    agent: string;
    /** Which path actually served the dispatch. */
    source: CostSource;
    /** Concatenated string length of the model's input prompt. */
    inputChars?: number;
    /** Concatenated string length of the model's output. */
    outputChars?: number;
    /** Optional: pre-computed token count (skips the heuristic). */
    estimatedTokens?: number;
    uid?: string;
    latencyMs?: number;
}

/**
 * Approximate token count from char length. Gemini's average is ~4
 * chars/token for English and ~3 chars/token for Devanagari/other
 * Indic scripts; we use 4 as a conservative single constant since the
 * dashboard is for trend detection, not invoice reconciliation.
 */
function estimateTokens(chars: number): number {
    if (!Number.isFinite(chars) || chars <= 0) return 0;
    return Math.ceil(chars / 4);
}

export function logDispatchCost(input: DispatchCostInput): void {
    const tokens = input.estimatedTokens ?? (
        estimateTokens(input.inputChars ?? 0) +
        estimateTokens(input.outputChars ?? 0)
    );

    logger.info('dispatch.cost', 'dispatch.cost', {
        agent: input.agent,
        source: input.source,
        estimated_tokens: tokens,
        ...(input.uid !== undefined ? { uid: input.uid } : {}),
        ...(input.latencyMs !== undefined ? { latency_ms: input.latencyMs } : {}),
    });
}
