"use server";

import { dbAdapter } from "@/lib/db/adapter";
import { User } from "firebase/auth";
import { UserProfile } from "@/types";
import { logger } from "@/lib/logger";

export async function syncUserAction(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) {
    if (!user || !user.uid) {
        return { success: false, error: "Invalid user data" };
    }

    try {
        const profileData: Partial<UserProfile> = {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
        };

        // This uses dbAdapter.updateUser which performs a set({ ... }, { merge: true })
        // effectively acting as an upsert (create if not exists)
        await dbAdapter.updateUser(user.uid, profileData);

        return { success: true };
    } catch (error) {
        logger.error("Failed to sync user profile", error, 'AUTH', { uid: user.uid });
        return { success: false, error: "Failed to sync user profile" };
    }
}
export async function getUserProfileAction(uid: string) {
    if (!uid) return { success: false, error: "Missing UID" };
    try {
        const profile = await dbAdapter.getUser(uid);
        return { success: true, profile: dbAdapter.serialize(profile) };
    } catch (error) {
        logger.error("Failed to fetch user profile", error, 'AUTH', { uid });
        return { success: false, error: "Failed to fetch user profile" };
    }
}
