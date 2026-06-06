/**
 * Profile-completion scoring helpers.
 *
 * Extracted out of `src/app/actions/profile.ts` because Next.js 15
 * Server Action files (those carrying `"use server"`) may only export
 * async functions. The non-async `computeProfileCompletion` and the
 * `PROFILE_COMPLETE_THRESHOLD` constant must therefore live in a plain
 * module that both the action file and `/api/profile/mark-complete`
 * can import.
 */

export const PROFILE_COMPLETE_THRESHOLD = 80;

export function hasValue(v: unknown): boolean {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
}

/**
 * Compute a 0-100 profile completion score from the merged profile.
 * Weights agreed in the onboarding-hardening plan:
 *   displayName 10, state 15, schoolName 15, subjects 15, gradeLevels 15,
 *   preferredLanguage 10, educationBoard 5, phone 10, photoURL 5.
 */
export function computeProfileCompletion(profile: Record<string, unknown>): number {
    const weights: Array<[string, number]> = [
        ['displayName', 10],
        ['state', 15],
        ['schoolName', 15],
        ['subjects', 15],
        ['gradeLevels', 15],
        ['preferredLanguage', 10],
        ['educationBoard', 5],
        ['phoneNumber', 10],
        ['photoURL', 5],
    ];
    let score = 0;
    for (const [field, weight] of weights) {
        if (field === 'phoneNumber') {
            if (hasValue(profile.phoneNumber) || hasValue(profile.phone)) score += weight;
            continue;
        }
        if (field === 'photoURL') {
            if (
                hasValue(profile.photoURL) ||
                hasValue(profile.avatarUrl) ||
                hasValue(profile.customAvatarUrl)
            ) {
                score += weight;
            }
            continue;
        }
        if (hasValue((profile as Record<string, unknown>)[field])) score += weight;
    }
    return Math.min(100, Math.max(0, score));
}
