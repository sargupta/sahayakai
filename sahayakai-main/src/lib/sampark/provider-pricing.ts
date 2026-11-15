/**
 * What a school sees when it chooses its calling provider: the all-in price per connected minute
 * SahayakAI charges for each provider, and a monthly estimate for its own number of families.
 *
 * Prices are DEPLOYMENT SETTINGS, never constants in code (vendor rates change):
 *   SAMPARK_PRICE_INR_PER_MIN_ELEVENLABS, SAMPARK_PRICE_INR_PER_MIN_VOBIZ — rupees per connected
 *   minute, a number in (0, 1000]; SAMPARK_PRICE_AS_OF — the date those prices were set (YYYY-MM-DD).
 * A missing or invalid price is `null`, and the console says "price not set yet" instead of a number.
 *
 * Pure and edge-safe: no Node APIs, no I/O.
 */

import type { RealConversationProvider } from './conversation/types';

type Env = Record<string, string | undefined>;

export const PRICE_ENV: Record<RealConversationProvider, string> = {
    elevenlabs: 'SAMPARK_PRICE_INR_PER_MIN_ELEVENLABS',
    vobiz: 'SAMPARK_PRICE_INR_PER_MIN_VOBIZ',
};

/** Defaults for the estimate inputs; the school edits all three on the card. */
export const ESTIMATE_DEFAULTS = { callsPerFamilyPerMonth: 2, minutesPerCall: 2 } as const;

/** Bounds for estimate inputs (also the API's validation). */
export const ESTIMATE_LIMITS = {
    families: { min: 0, max: 100_000 },
    callsPerFamilyPerMonth: { min: 0, max: 60 },
    minutesPerCall: { min: 0, max: 15 },
} as const;

export interface ProviderPrice {
    /** Rupees per connected minute, or null when the deployment has not set one. */
    inrPerMinute: number | null;
    /** YYYY-MM-DD the prices were set, or null. */
    asOf: string | null;
}

function parsePrice(raw: string | undefined): number | null {
    if (raw === undefined || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 1000 ? Math.round(n * 100) / 100 : null;
}

function parseAsOf(raw: string | undefined): string | null {
    const v = raw?.trim() ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
}

export function providerPrice(provider: RealConversationProvider, env: Env = process.env): ProviderPrice {
    return { inrPerMinute: parsePrice(env[PRICE_ENV[provider]]), asOf: parseAsOf(env.SAMPARK_PRICE_AS_OF) };
}

export interface EstimateInput {
    families: number;
    callsPerFamilyPerMonth: number;
    minutesPerCall: number;
}

function clamp(n: number, lo: number, hi: number): number {
    if (!Number.isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
}

/**
 * Monthly cost in rupees = families × calls per family × minutes per call × price per minute,
 * rounded to the rupee. Null when there is no price (never a made-up number). Inputs outside
 * their bounds are clamped, so a typo cannot produce an absurd figure.
 */
export function estimateMonthlyInr(input: EstimateInput, inrPerMinute: number | null): number | null {
    if (inrPerMinute === null) return null;
    const families = clamp(Math.floor(input.families), ESTIMATE_LIMITS.families.min, ESTIMATE_LIMITS.families.max);
    const calls = clamp(input.callsPerFamilyPerMonth, ESTIMATE_LIMITS.callsPerFamilyPerMonth.min, ESTIMATE_LIMITS.callsPerFamilyPerMonth.max);
    const minutes = clamp(input.minutesPerCall, ESTIMATE_LIMITS.minutesPerCall.min, ESTIMATE_LIMITS.minutesPerCall.max);
    return Math.round(families * calls * minutes * inrPerMinute);
}

/** "₹12,400" (Indian digit grouping). */
export function formatInr(n: number): string {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
