"use server";

import { dbAdapter } from "@/lib/db/adapter";
import { UserProfile } from "@/types";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * Sync the auth user's profile into Firestore on sign-in.
 *
 * Wave 1: previously the caller passed the entire user object including uid,
 * and the server merged it into Firestore — meaning any signed-in user could
 * overwrite ANY other user's profile (display name, email, photo) by calling
 * this with a different uid. This was the most severe spoofing hole in the
 * codebase.
 *
 * Now: uid is derived from session. The supplied uid in the user object is
 * checked against the session and rejected if mismatched. The other fields
 * (displayName, photoURL, email) are still trusted from the client because
 * they reflect what Firebase Auth populated — but they can only be written
 * to the caller's own profile.
 */
export async function syncUserAction(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) {
    if (!user || !user.uid) {
        return { success: false, error: "Invalid user data" };
    }

    let callerUid: string;
    try {
        callerUid = await requireAuth();
    } catch (e) {
        return { success: false, error: "Unauthorized" };
    }

    if (user.uid !== callerUid) {
        logger.warn('syncUserAction called with mismatched uid — possible spoof attempt', 'AUTH', {
            callerUid,
            suppliedUid: user.uid,
        });
        return { success: false, error: "Forbidden: uid mismatch" };
    }

    try {
        const profileData: Partial<UserProfile> = {
            uid: callerUid,
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
        };

        // This uses dbAdapter.updateUser which performs a set({ ... }, { merge: true })
        // effectively acting as an upsert (create if not exists)
        await dbAdapter.updateUser(callerUid, profileData);

        return { success: true };
    } catch (error) {
        logger.error("Failed to sync user profile", error, 'AUTH', { uid: callerUid });
        return { success: false, error: "Failed to sync user profile" };
    }
}

/**
 * Get the caller's own profile.
 *
 * Wave 1: dropped trust-the-client uid. The legacy `_uid` parameter is
 * preserved for compat — value is rejected if it doesn't match the session.
 *
 * Note: for reading OTHER users' public profiles (e.g. teacher cards),
 * use the sanitised actions in community.ts that strip PII.
 */
export async function getUserProfileAction(_uid?: string) {
    let uid: string;
    try {
        uid = await requireAuth();
    } catch {
        return { success: false, error: "Unauthorized" };
    }
    if (_uid && _uid !== uid) {
        return { success: false, error: "Forbidden: cannot read another user's full profile" };
    }
    try {
        const profile = await dbAdapter.getUser(uid);
        return { success: true, profile: dbAdapter.serialize(profile) };
    } catch (error) {
        logger.error("Failed to fetch user profile", error, 'AUTH', { uid });
        return { success: false, error: "Failed to fetch user profile" };
    }
}
