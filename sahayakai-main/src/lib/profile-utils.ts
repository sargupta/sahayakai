import type { UserProfile } from '@/types';
import { isNewUserPhase, normalizeOnboardingPhase, type OnboardingPhase } from '@/lib/onboarding-phase';

/**
 * Profile completion level utilities.
 * Determines how much of their profile a teacher has filled in,
 * and resolves the effective onboarding phase for backward compatibility.
 */

export function getProfileCompletionLevel(
    profile: Partial<UserProfile> | null | undefined
): 'none' | 'basic' | 'complete' {
    if (!profile) return 'none';

    // Explicit level stored on profile takes priority
    if (profile.profileCompletionLevel) return profile.profileCompletionLevel;

    const hasBasic =
        !!profile.schoolName &&
        Array.isArray(profile.subjects) && profile.subjects.length > 0 &&
        Array.isArray(profile.gradeLevels) && profile.gradeLevels.length > 0;

    if (!hasBasic) return 'none';

    const hasComplete =
        !!profile.department || !!profile.designation || !!profile.district || !!profile.bio;

    return hasComplete ? 'complete' : 'basic';
}

export function isProfileSufficientForAI(
    profile: Partial<UserProfile> | null | undefined
): boolean {
    return getProfileCompletionLevel(profile) !== 'none';
}

/**
 * Resolve the effective onboarding phase, handling backward compatibility.
 * Stored values are normalised through src/lib/onboarding-phase.ts, so legacy
 * aliases (e.g. 'completed') resolve to their canonical phase. Users with
 * schoolName but no recognised onboardingPhase are treated as 'done'.
 */
export function getEffectiveOnboardingPhase(
    profile: Partial<UserProfile> | null | undefined
): OnboardingPhase {
    if (!profile) return 'setup';

    const stored = normalizeOnboardingPhase(profile.onboardingPhase);
    if (stored) return stored;

    // Backward compatibility: existing users who completed old onboarding
    if (profile.schoolName) return 'done';

    return 'setup';
}

/**
 * New-user mode (reduced sidebar, spotlights, new-user dashboard): onboarding
 * not finished and the account is inside its first week. See
 * NEW_USER_MODE_MAX_DAYS — no phase can hold a teacher in this mode forever.
 */
export function isNewUser(
    profile: Partial<UserProfile> | null | undefined,
    now: Date = new Date(),
): boolean {
    return isNewUserPhase(getEffectiveOnboardingPhase(profile), profile?.createdAt, now);
}

/**
 * Parse a grade string like "Class 8" into a number (8).
 * Returns undefined for non-numeric grades (Nursery, LKG, UKG).
 */
export function parseGradeNumber(grade: string): number | undefined {
    const match = grade.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
}
