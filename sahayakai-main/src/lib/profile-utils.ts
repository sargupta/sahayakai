import type { UserProfile } from '@/types';

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
 * Existing users with schoolName but no onboardingPhase are treated as 'done'.
 */
export function getEffectiveOnboardingPhase(
    profile: Partial<UserProfile> | null | undefined
): NonNullable<UserProfile['onboardingPhase']> {
    if (!profile) return 'setup';

    if (profile.onboardingPhase) return profile.onboardingPhase;

    // Backward compatibility: existing users who completed old onboarding
    if (profile.schoolName) return 'done';

    return 'setup';
}

export function isNewUser(
    profile: Partial<UserProfile> | null | undefined
): boolean {
    const phase = getEffectiveOnboardingPhase(profile);
    return phase !== 'done';
}

/**
 * Parse a grade string like "Class 8" into a number (8).
 * Returns undefined for non-numeric grades (Nursery, LKG, UKG).
 */
export function parseGradeNumber(grade: string): number | undefined {
    const match = grade.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
}
