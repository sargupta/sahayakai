/**
 * Shared utility to trigger AI reactive replies.
 * Used by both community chat and group chat actions.
 */

/** Allowed collection path patterns for AI replies */
const ALLOWED_PATHS = /^(community_chat|groups\/[a-zA-Z0-9_-]+\/chat)$/;

export function isAllowedChatPath(path: string): boolean {
    return ALLOWED_PATHS.test(path);
}

/**
 * Fire-and-forget internal call to the AI reactive reply endpoint.
 * Validates the collection path and includes an internal secret.
 */
export function triggerAIReactiveReply(
    collectionPath: string,
    messageText: string,
    authorName: string,
) {
    // Don't trigger for empty messages (e.g. audio-only)
    if (!messageText) return;

    // Don't trigger for AI teacher messages
    if (authorName.startsWith('AI_')) return;

    if (!isAllowedChatPath(collectionPath)) return;

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
            || 'http://localhost:3000';

        const secret = process.env.AI_INTERNAL_SECRET || '';

        fetch(`${baseUrl}/api/jobs/ai-reactive-reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': secret,
            },
            body: JSON.stringify({ collectionPath, messageText, authorName }),
        }).catch(() => {});
    } catch {
        // Non-critical — never fail the user's message send
    }
}
