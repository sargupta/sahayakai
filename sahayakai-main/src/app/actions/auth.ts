"use server";

import { dbAdapter } from "@/lib/db/adapter";
import { User } from "firebase/auth";
import { UserProfile } from "@/types";

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
            updatedAt: new Date().toISOString(), // Will be handled as server timestamp by adapter where possible or string
        };

        // This uses dbAdapter.updateUser which performs a set({ ... }, { merge: true })
        // effectively acting as an upsert (create if not exists)
        await dbAdapter.updateUser(user.uid, profileData);

        return { success: true };
    } catch (error) {
        console.error("Failed to sync user profile:", error);
        return { success: false, error: "Failed to sync user profile" };
    }
}
