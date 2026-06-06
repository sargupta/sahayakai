/**
 * F7-003: planType MUST be resolved from subscription.plan_id, not from
 * the forgeable notes.planKey substring.
 */

beforeAll(() => {
    process.env.RAZORPAY_PLAN_PRO_MONTHLY = 'plan_pro_m';
    process.env.RAZORPAY_PLAN_PRO_ANNUAL = 'plan_pro_a';
    process.env.RAZORPAY_PLAN_GOLD_MONTHLY = 'plan_gold_m';
    process.env.RAZORPAY_PLAN_GOLD_ANNUAL = 'plan_gold_a';
    process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY = 'plan_prem_m';
    process.env.RAZORPAY_PLAN_PREMIUM_ANNUAL = 'plan_prem_a';
    process.env.RAZORPAY_KEY_ID = 'x';
    process.env.RAZORPAY_KEY_SECRET = 'y';
});

describe('resolvePlanTypeFromPlanId', () => {
    test('maps known plan_ids strictly', () => {
        jest.isolateModules(() => {
            const { resolvePlanTypeFromPlanId } = require('@/lib/razorpay');
            expect(resolvePlanTypeFromPlanId('plan_pro_m')).toBe('pro');
            expect(resolvePlanTypeFromPlanId('plan_pro_a')).toBe('pro');
            expect(resolvePlanTypeFromPlanId('plan_gold_m')).toBe('gold');
            expect(resolvePlanTypeFromPlanId('plan_gold_a')).toBe('gold');
            expect(resolvePlanTypeFromPlanId('plan_prem_m')).toBe('premium');
            expect(resolvePlanTypeFromPlanId('plan_prem_a')).toBe('premium');
        });
    });

    test('returns null for unknown plan_id (forces caller to error out)', () => {
        jest.isolateModules(() => {
            const { resolvePlanTypeFromPlanId } = require('@/lib/razorpay');
            expect(resolvePlanTypeFromPlanId('plan_unknown')).toBeNull();
            expect(resolvePlanTypeFromPlanId('')).toBeNull();
            expect(resolvePlanTypeFromPlanId(undefined)).toBeNull();
        });
    });

    test('substring attack: a forged "premium"-named id that is not in the env map returns null', () => {
        jest.isolateModules(() => {
            const { resolvePlanTypeFromPlanId } = require('@/lib/razorpay');
            // Attacker creates a subscription with notes.planKey="premium_annual" but the
            // actual Razorpay plan_id is the pro one. Old substring code would call it
            // 'premium'. resolvePlanTypeFromPlanId only trusts the plan_id.
            expect(resolvePlanTypeFromPlanId('plan_pro_m')).toBe('pro');
            // And a never-configured "premium-looking" plan_id is rejected.
            expect(resolvePlanTypeFromPlanId('plan_premium_attacker_supplied')).toBeNull();
        });
    });
});
