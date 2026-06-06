"use server";

import { headers } from "next/headers";
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
 * this with a different uid. We locked uid down to the session-verified value
 * but still trusted the client-supplied email/displayName/photoURL.
 *
 * F1-06 fix (2026-06-06): a signed-in attacker could still call
 * `syncUserAction({ uid: ownUid, email: 'victim@evil.com', ... })` to
 * overwrite their OWN Firestore email with anything they wanted — letting
 * them appear as someone else in mutual-contact, connection-request, and
 * teacher-directory surfaces (which read these fields without re-verifying
 * against Firebase Auth). The fix: trust ONLY the middleware-injected
 * `x-user-email` and `x-user-name` headers, which are populated from the
 * verified Firebase ID-token claims (`email`, `name`). The client-supplied
 * `user` payload is kept for backward-compat but ignored except for
 * `photoURL` (which Firebase Auth does not always populate in token claims,
 * and which is low-risk vs. email/name).
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

    // F1-06: read identity from middleware-injected headers, NOT from the
    // client-supplied user payload. These headers are set ONLY by
    // src/middleware.ts after `verifyIdToken` succeeds — they cannot be
    // forged from outside (the middleware strips any inbound copies).
    const h = await headers();
    const trustedEmail = h.get('x-user-email') ?? '';
    const trustedName = h.get('x-user-name') ?? '';

    // Log if the client tried to send a different email/name than the token
    // says — useful signal for detecting attempted spoof, even though we
    // don't reject the request (a stale display name in the client is a
    // benign cause of mismatch too).
    if (user.email && trustedEmail && user.email !== trustedEmail) {
        logger.warn('syncUserAction: client-supplied email differs from verified token email', 'AUTH', {
            uid: callerUid,
            clientEmail: user.email,
            tokenEmail: trustedEmail,
        });
    }

    try {
        const profileData: Partial<UserProfile> = {
            uid: callerUid,
            email: trustedEmail,
            displayName: trustedName,
            // photoURL is not a token claim by default; it's safe to mirror
            // the client copy of Firebase Auth's `photoURL` field (the worst
            // an attacker can do is set their OWN avatar to an arbitrary
            // URL, which is already allowed by the profile-edit flow).
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
