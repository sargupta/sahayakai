/**
 * Typed client wrapper for POST /api/feedback/app (tranche 5 migration of
 * src/app/actions/feedback.ts). Signature and `{ success, ... }` result
 * contract identical to the old server action — never throws.
 */
import { apiFetch } from '@/lib/api/client';

export type FeedbackData = {
    page: string;
    feature: string;
    rating: 'thumbs-up' | 'thumbs-down';
    comment?: string;
    context?: Record<string, any>;
};

export async function submitFeedback(
    data: FeedbackData,
): Promise<{ success: boolean; id?: string; warning?: string; error?: string }> {
    try {
        return await apiFetch(`/api/feedback/app`, { method: 'POST', body: data });
    } catch {
        // Action contract: failures come back as a result object, not a throw.
        return { success: false, error: 'Could not submit feedback.' };
    }
}
