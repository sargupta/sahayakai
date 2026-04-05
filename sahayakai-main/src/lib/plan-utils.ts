/**
 * Plan type utilities — backward-compatible normalization during migration.
 *
 * New tiers: 'free' | 'pro' | 'gold' | 'premium'
 * Legacy mapping: old 'pro' → 'gold', old 'institution' → 'premium'
 *
 * Remove legacy aliases once Firestore migration is confirmed complete.
 */

export type PlanType = 'free' | 'pro' | 'gold' | 'premium';

const LEGACY_MAP: Record<string, PlanType> = {
    institution: 'premium',
    // 'pro' stays 'pro' — it's a valid new tier
};

/** Normalize any planType value (including legacy) to the current enum. */
export function normalizePlan(raw: string | undefined | null): PlanType {
    if (!raw) return 'free';
    const lower = raw.trim().toLowerCase();
    return LEGACY_MAP[lower] ?? (isValidPlan(lower) ? lower : 'free');
}

function isValidPlan(v: string): v is PlanType {
    return v === 'free' || v === 'pro' || v === 'gold' || v === 'premium';
}

/** Returns true if the user has any paid plan (pro, gold, or premium). */
export function hasPaidPlan(planType: string | undefined | null): boolean {
    const plan = normalizePlan(planType);
    return plan !== 'free';
}

/** Returns true if the user has gold or premium tier (the old "pro or institution" check). */
export function hasAdvancedPlan(planType: string | undefined | null): boolean {
    const plan = normalizePlan(planType);
    return plan === 'gold' || plan === 'premium';
}
