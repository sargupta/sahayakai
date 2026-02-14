"use server";

import { dbAdapter } from "@/lib/db/adapter";
import { certificationService } from "@/lib/services/certification-service";
import { getAuthInstance } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";

export async function getProfileData(userId: string) {
    try {
        const [profile, certifications] = await Promise.all([
            dbAdapter.getUser(userId),
            certificationService.getCertificationsByUser(userId)
        ]);

        return dbAdapter.serialize({ profile, certifications });
    } catch (error) {
        console.error("Failed to fetch profile data:", error);
        return { profile: null, certifications: [] };
    }
}

export async function addCertificationAction(formData: FormData) {
    const userId = formData.get("userId") as string;
    const certName = formData.get("certName") as string;
    const issuingBody = formData.get("issuingBody") as string;
    const issueDate = formData.get("issueDate") as string;

    if (!userId || !certName) throw new Error("Missing required fields");

    await certificationService.addCertification({
        userId,
        certName,
        issuingBody,
        issueDate,
        status: 'pending'
    } as any);

    revalidatePath("/my-profile");
}

export async function updateProfileAction(userId: string, data: any) {
    if (!userId) throw new Error("Unauthorized");

    await dbAdapter.updateUser(userId, data);

    revalidatePath("/my-profile");
}
