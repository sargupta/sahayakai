/**
 * Typed client wrappers for the /api/groups/** routes — tranche 5 migration
 * of src/app/actions/groups.ts (docs/API_MIGRATION_PATTERN.md).
 *
 * Function names and signatures match the old server actions exactly so
 * component call sites only swap the import path. Auth: apiFetch attaches
 * the Firebase Bearer token; middleware translates it to the trusted
 * x-user-id header.
 */
import { apiFetch } from '@/lib/api/client';
import type { Group, GroupPost, PostType, PostAttachment, FeedItem } from '@/types/community';

export async function ensureUserGroupsAction(): Promise<string[]> {
    return apiFetch('/api/groups/ensure', { method: 'POST' });
}

export async function getMyGroupsAction(): Promise<Group[]> {
    return apiFetch('/api/groups');
}

export async function getGroupAction(groupId: string): Promise<Group | null> {
    return apiFetch(`/api/groups/${encodeURIComponent(groupId)}`);
}

export async function joinGroupAction(groupId: string): Promise<{ joined: boolean }> {
    return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/membership`, { method: 'POST' });
}

export async function leaveGroupAction(groupId: string): Promise<void> {
    await apiFetch(`/api/groups/${encodeURIComponent(groupId)}/membership`, { method: 'DELETE' });
}

export async function getGroupPostsAction(
    groupId: string,
    limit = 20,
    startAfter?: string,
): Promise<GroupPost[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (startAfter) params.set('startAfter', startAfter);
    return apiFetch(`/api/groups/${encodeURIComponent(groupId)}/posts?${params.toString()}`);
}

export async function createGroupPostAction(
    groupId: string,
    content: string,
    postType: PostType,
    attachments: PostAttachment[] = [],
): Promise<string> {
    const { id } = await apiFetch<{ id: string }>(
        `/api/groups/${encodeURIComponent(groupId)}/posts`,
        { body: { content, postType, attachments } },
    );
    return id;
}

export async function likeGroupPostAction(
    groupId: string,
    postId: string,
): Promise<{ isLiked: boolean; newCount: number }> {
    return apiFetch(
        `/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/like`,
        { method: 'POST' },
    );
}

export async function sendGroupChatMessageAction(
    groupId: string,
    text: string,
    audioUrl?: string,
): Promise<string> {
    const { id } = await apiFetch<{ id: string }>(
        `/api/groups/${encodeURIComponent(groupId)}/chat`,
        { body: { text, audioUrl } },
    );
    return id;
}

export async function discoverGroupsAction(): Promise<Group[]> {
    return apiFetch('/api/groups/discover');
}

export async function getUnifiedFeedAction(
    limit = 20,
    startAfterTimestamp?: string,
): Promise<FeedItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (startAfterTimestamp) params.set('startAfter', startAfterTimestamp);
    return apiFetch(`/api/groups/feed?${params.toString()}`);
}
