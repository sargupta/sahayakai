"use server";

import { getDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { getAuthUserIdOrNull } from "@/lib/auth-helpers";

export type FeedbackData = {
    page: string;
    feature: string;
    rating: 'thumbs-up' | 'thumbs-down';
    comment?: string;
    context?: Record<string, any>;
};

/**
 * Anonymous-friendly: marketing pages submit feedback before sign-in. When the
 * caller IS authenticated, we stamp their uid on the doc so we can attribute
 * later. Wave 1 only adds the uid stamp; auth is intentionally optional.
 */
export async function submitFeedback(data: FeedbackData) {
    try {
        const db = await getDb();

        // Validate comment for thumbs-down
        if (data.rating === 'thumbs-down' && !data.comment) {
            throw new Error("Comment is required for negative feedback.");
        }

        // Cap comment length so this isn't a free-form storage abuse vector.
        if (data.comment && data.comment.length > 2000) {
            throw new Error("Comment too long (max 2000 chars).");
        }

        const userId = await getAuthUserIdOrNull();

        const feedbackRef = db.collection('feedbacks').doc();

        await feedbackRef.set({
            ...data,
            // Server-stamped attribution — never trust client-supplied uid.
            ...(userId ? { userId } : {}),
            timestamp: Timestamp.now(),
        });

        return { success: true, id: feedbackRef.id };
    } catch (error: any) {
        // Graceful Fallback for Development (if DB is not configured)
        if (process.env.NODE_ENV === 'development') {
            logger.warn("⚠️ [DEV MODE] FirebaseDB not available. Feedback logged via logger instead", 'FEEDBACK_DEV');
            logger.info("FEEDBACK PAYLOAD", 'FEEDBACK_DEV', { data });
            logger.error("Backend Error (Ignored in Dev)", error, 'FEEDBACK_DEV');

            return { success: true, id: 'dev-mock-id', warning: "Saved to Dev Console (DB Offline)" };
        }

        logger.error("Error submitting feedback", error, 'FEEDBACK');
        // Wave 2b: don't leak Firebase error details to the client.
        return { success: false, error: 'Could not submit feedback.' };
    }
}
