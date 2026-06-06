"use server";

import { dbAdapter } from "@/lib/db/adapter";
import { certificationService } from "@/lib/services/certification-service";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { validateAdmin } from "@/lib/auth-utils";
import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * Read a user's profile data.
 *
 * Wave 1: now derives uid from session. The positional `_userId` arg is
 * preserved for compat — value is checked against session and rejected if
 * mismatched (to surface bad call sites loudly during the rollout).
 *
 * Note: profile data ALSO surfaces in public APIs (teacher directory, etc.)
 * via dedicated sanitised actions. This one returns the FULL profile and
 * therefore must be self-only.
 */
export async function getProfileData(_userId?: string) {
    const userId = await requireAuth();
    if (_userId && _userId !== userId) {
        throw new Error('Forbidden: cannot read another user\'s profile via this action');
    }
    try {
        const [profile, certifications] = await Promise.all([
            dbAdapter.getUser(userId),
            certificationService.getCertificationsByUser(userId)
        ]);

        return dbAdapter.serialize({ profile, certifications });
    } catch (error) {
        logger.error("Failed to fetch profile data", error, 'PROFILE', { userId });
        return { profile: null, certifications: [] };
    }
}

/**
 * Read another teacher's PUBLIC profile (used by /profile/[uid] and the
 * teacher directory). Returns only fields safe to surface to other teachers.
 *
 * Auth: caller must be signed in (any teacher can view any other teacher).
 * The returned shape mirrors getProfileData so the ProfileView component can
 * consume both transparently. Certifications are also returned to enable the
 * "BadgeCheck/verified" affordance on public profiles.
 *
 * Added 2026-05-20 to unblock the post-accept "View" flow — the existing
 * getProfileData throws Forbidden for cross-user reads, which silently
 * rendered "Profile Not Found".
 */
export async function getPublicProfileAction(targetUid: string) {
    await requireAuth(); // any signed-in teacher can view another teacher
    if (!targetUid || typeof targetUid !== 'string') {
        throw new Error('Invalid targetUid');
    }
    try {
        const [profile, certifications] = await Promise.all([
            dbAdapter.getUser(targetUid),
            certificationService.getCertificationsByUser(targetUid),
        ]);

        if (!profile) {
            return { profile: null, certifications: [] };
        }

        // Strip private fields that other teachers shouldn't see.
        // Whitelist approach — only return known-safe fields.
        const publicProfile = {
            id: (profile as any).id ?? targetUid,
            displayName: (profile as any).displayName,
            photoURL: (profile as any).photoURL,
            email: (profile as any).email, // public for connection (already shown elsewhere)
            bio: (profile as any).bio,
            state: (profile as any).state,
            district: (profile as any).district,
            schoolType: (profile as any).schoolType,
            resourceLevel: (profile as any).resourceLevel,
            subjects: (profile as any).subjects,
            languages: (profile as any).languages,
            gradeLevels: (profile as any).gradeLevels,
            qualifications: (profile as any).qualifications,
            yearsOfExperience: (profile as any).yearsOfExperience,
            verifiedStatus: (profile as any).verifiedStatus,
            careerStage: (profile as any).careerStage,
            // intentionally excluded: phoneNumber, fcmTokens, adminRoles,
            // billing/usage fields, communityIntroState, onboarding flags
        };

        return dbAdapter.serialize({ profile: publicProfile, certifications });
    } catch (error) {
        logger.error("Failed to fetch public profile data", error, 'PROFILE', { targetUid });
        return { profile: null, certifications: [] };
    }
}

/**
 * Add a certification to the caller's profile.
 *
 * Wave 1: now derives uid from session — userId field on FormData is ignored.
 * Previously any caller could add certifications to any user's profile by
 * passing a different uid in the FormData.
 */
export async function addCertificationAction(formData: FormData) {
    const userId = await requireAuth();
    const certName = formData.get("certName") as string;
    const issuingBody = formData.get("issuingBody") as string;
    const issueDate = formData.get("issueDate") as string;

    if (!certName) throw new Error("Missing required field: certName");

    await certificationService.addCertification({
        userId,
        certName,
        issuingBody,
        issueDate,
        status: 'pending'
    } as any);

    revalidatePath("/my-profile");
}

/**
 * Update the caller's own profile.
 *
 * Wave 1: dropped trust-the-client `userId` parameter (the previous check
 * `if (!userId)` validated PRESENCE but not OWNERSHIP — any signed-in user
 * could pass another user's uid and overwrite their profile). Now uid is
 * derived from session and the supplied `_userId` is rejected if it doesn't
 * match.
 */
// Allowlist of fields a teacher may set on their own profile via this action.
// Anything else is silently stripped before the Firestore write so a hostile
// client cannot escalate privileges (e.g. set `role:'admin'`, flip plan tier,
// award badges, mint impactScore, etc.). Privileged or server-derived fields
// must be written through dedicated, auth-checked code paths.
// Allowlist categories:
//   1. Identity / profile basics — user-typed strings shown on the profile card
//   2. Teaching context — subjects, grades, board, school, location
//   3. Preferences — language, notification/voice prefs
//   4. Onboarding state machine — phase, checklist, spotlights, counters
//   5. Privacy / consent — timestamps + version stamps the user clicks to set
//   6. Community intro state — first-visit nudge tracking
//
// NEVER in the allowlist (privilege escalation surface):
//   - adminRoles / isAdmin / superadmin / role / customClaims
//   - plan / planTier / planExpiresAt / subscriptionId / razorpaySubscriptionId / billing*
//   - email / emailVerified / uid / createdAt (auth identity / immutable)
//   - fcmTokens (handled by a dedicated push-token action)
//   - referralCode (server-issued)
//   - impactScore / badges / verifiedStatus / followersCount / followingCount /
//     contentSharedCount — these are SERVER-COMPUTED aggregates. They are
//     initialized server-side in POST /api/user/profile for new users; the
//     onboarding step was passing zero-values for them, which is harmless but
//     pointless (the adapter-level allowlist also rejects them). They are now
//     dropped from the onboarding payload, so the client never tries to write
//     them through this action.
const PROFILE_WRITABLE_FIELDS: ReadonlySet<string> = new Set([
    // 1. Identity / profile basics
    'displayName',
    'bio',
    'photoURL',
    'customAvatarUrl',
    'phoneNumber',
    'designation',
    'department',
    'qualifications',
    'yearsOfExperience',
    'experienceYears', // legacy alias
    'administrativeRole',

    // 2. Teaching context
    'subjects',
    'grades',
    'gradeLevels',
    'boards',
    'educationBoard',
    'preferredBoard',
    'schoolName',
    'school', // legacy alias
    'schoolNormalized',
    'udise',
    'organizationId',
    'interests',

    // Location
    'state',
    'district',
    'region',

    // 3. Preferences
    'preferredLanguage',
    'lastLessonPlanLanguage', // F11-2: reconcile with adapter allowlist
    'notificationPreferences', // F11-2
    'voicePreferences', // F11-2

    // 4. Onboarding state machine
    'onboardingPhase',
    'onboardingCompletedAt',
    'onboardingComplete', // F11-2: reconcile with adapter allowlist
    'onboardingChecklistItems',
    'checklistDismissedAt',
    'featureSpotlightsSeen',
    'profileCompletionLevel',
    'profileCompletionDismissCount',
    'firstGenerationContentId',
    'firstGenerationTool',
    'aiGenerationCount',
    'hasHeardGreeting',

    // 5. Privacy / consent
    'privacyAcceptedAt',
    'privacyVersion',
    'consentGivenAt', // F11-2: reconcile with adapter allowlist
    'consentVersion', // F11-2

    // 6. Community intro state
    'communityIntroState',

    // 7. Legacy field aliases / misc system flags
    'avatarUrl', // F11-2: photoURL alias used by some client paths
    'phone', // F11-2: phoneNumber alias
    'teachingGradeLevels', // F11-2: gradeLevels alias
    'groupsInitialized', // F11-2: server marks true; client may force-rerun
]);

/**
 * F11-3: Phases beyond `language-picked` require that prerequisites are
 * already persisted on the user document. Without this check, a hostile
 * client could POST `{ onboardingPhase: 'exploring' }` and skip the
 * profile-setup screen entirely (then the AI flows fall back to bogus
 * defaults because state/subjects/grades are missing).
 *
 * Rules:
 *  - `language-picked` (Step 0 done): no prerequisites.
 *  - `first-generation` (Step 1 done): requires state, schoolName,
 *     subjects.length > 0, gradeLevels.length > 0.
 *  - `exploring` / `completed` (Step 2 done): same as first-generation.
 *
 * `district` is intentionally NOT in the prerequisite list — the UI's
 * Step 1 captures state, schoolName, subjects, grades but does not require
 * a district (some teachers don't list it). District is treated as
 * desirable-but-optional.
 */
const ONBOARDING_PHASE_PREREQUISITES: Record<string, string[]> = {
    'first-generation': ['state', 'schoolName', 'subjects', 'gradeLevels'],
    'exploring': ['state', 'schoolName', 'subjects', 'gradeLevels'],
    'completed': ['state', 'schoolName', 'subjects', 'gradeLevels'],
};

function hasValue(v: any): boolean {
    if (v === undefined || v === null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
}

export async function updateProfileAction(_userId: string, data: any) {
    const userId = await requireAuth();
    if (_userId !== userId) {
        throw new Error('Forbidden: cannot update another user\'s profile');
    }

    // Strip everything not in the allowlist BEFORE the write.
    const sanitized: Record<string, any> = {};
    if (data && typeof data === 'object') {
        for (const key of Object.keys(data)) {
            if (PROFILE_WRITABLE_FIELDS.has(key)) {
                sanitized[key] = data[key];
            }
        }
    }

    if (Object.keys(sanitized).length === 0) {
        throw new Error('No writable fields in update payload');
    }

    // F11-3: Block onboardingPhase escalation when prerequisites aren't met.
    // Onboarding-phase is in the writable allowlist so legitimate flow can
    // advance it — but writing `exploring` (or `first-generation`, etc.)
    // directly without ever capturing state/subjects/grades was a bypass
    // exploited by malformed clients (and possibly hostile ones).
    if (sanitized.onboardingPhase && ONBOARDING_PHASE_PREREQUISITES[sanitized.onboardingPhase]) {
        const required = ONBOARDING_PHASE_PREREQUISITES[sanitized.onboardingPhase];
        // Build the effective state = existing profile MERGED with the
        // incoming patch. This way a single PATCH that includes both
        // prerequisites and phase is accepted (the legitimate onboarding
        // flow's "save all in one call" pattern works), but a phase-only
        // patch without prerequisites is rejected.
        const existing = await dbAdapter.getUser(userId).catch(() => null);
        const merged: Record<string, any> = { ...(existing ?? {}), ...sanitized };
        const missing = required.filter(field => !hasValue(merged[field]));
        if (missing.length > 0) {
            logger.warn(
                'Rejected onboardingPhase advance: prerequisites missing',
                'PROFILE',
                { userId, phase: sanitized.onboardingPhase, missing },
            );
            throw new Error(
                `Cannot advance onboardingPhase to '${sanitized.onboardingPhase}' — missing prerequisites: ${missing.join(', ')}`
            );
        }
    }

    await dbAdapter.updateUser(userId, sanitized);

    revalidatePath("/my-profile");
}

/**
 * Mark a single onboarding checklist item as completed for the caller.
 *
 * Wave 1: dropped trust-the-client uid. Same spoof attack as updateProfileAction.
 */
const CHECKLIST_ITEM_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export async function markChecklistItemAction(_userId: string, itemId: string) {
    if (!itemId) return;
    if (!CHECKLIST_ITEM_ID_RE.test(itemId)) {
        throw new Error('Invalid checklist item id');
    }
    const userId = await requireAuth();
    if (_userId !== userId) {
        throw new Error('Forbidden: cannot update another user\'s checklist');
    }
    try {
        const { getDb } = await import("@/lib/firebase-admin");
        const db = await getDb();
        await db.collection('users').doc(userId).update({
            [`onboardingChecklistItems.${itemId}`]: true,
        });
    } catch (error) {
        // Non-fatal: checklist tracking is UX-only
        logger.warn(`Failed to mark checklist item ${itemId} for ${userId}`, String(error));
    }
}

export async function getDailyCostsAction(days: number = 7) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');

    if (!userId) throw new Error("Unauthorized");
    await validateAdmin(userId);

    const { costService } = await import("@/lib/services/cost-service");
    const data = await costService.getDailyCosts(days);
    return data;
}
