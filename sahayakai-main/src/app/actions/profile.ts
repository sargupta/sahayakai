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
export async function updateProfileAction(_userId: string, data: any) {
    const userId = await requireAuth();
    if (_userId !== userId) {
        throw new Error('Forbidden: cannot update another user\'s profile');
    }

    await dbAdapter.updateUser(userId, data);

    revalidatePath("/my-profile");
}

/**
 * Mark a single onboarding checklist item as completed for the caller.
 *
 * Wave 1: dropped trust-the-client uid. Same spoof attack as updateProfileAction.
 */
export async function markChecklistItemAction(_userId: string, itemId: string) {
    if (!itemId) return;
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
