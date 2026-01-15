"use server";

import { getDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export type FeedbackData = {
    page: string;
    feature: string;
    rating: 'thumbs-up' | 'thumbs-down';
    comment?: string;
    context?: Record<string, any>;
};

export async function submitFeedback(data: FeedbackData) {
    try {
        const db = await getDb();

        // Validate comment for thumbs-down
        if (data.rating === 'thumbs-down' && !data.comment) {
            throw new Error("Comment is required for negative feedback.");
        }

        const feedbackRef = db.collection('feedbacks').doc();

        await feedbackRef.set({
            ...data,
            timestamp: Timestamp.now(),
            // In production, we'd add userId from Auth context here
        });

        return { success: true, id: feedbackRef.id };
    } catch (error: any) {
        // Graceful Fallback for Development (if DB is not configured)
        if (process.env.NODE_ENV === 'development') {
            console.warn("⚠️ [DEV MODE] FirebaseDB not available. Feedback logged to console instead:");
            console.log("FEEDBACK PAYLOAD:", JSON.stringify(data, null, 2));
            console.error("Backend Error (Ignored in Dev):", error.message);

            return { success: true, id: 'dev-mock-id', warning: "Saved to Dev Console (DB Offline)" };
        }

        console.error("Error submitting feedback:", error);
        return { success: false, error: error.message };
    }
}
