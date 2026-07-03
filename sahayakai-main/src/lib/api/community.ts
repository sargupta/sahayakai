/**
 * Typed client wrappers for the /api/community/** routes — tranche 5
 * migration of src/app/actions/community.ts (docs/API_MIGRATION_PATTERN.md).
 *
 * Function names and signatures match the old server actions exactly so
 * component call sites only swap the import path. Auth: apiFetch attaches
 * the Firebase Bearer token; middleware translates it to the trusted
 * x-user-id header — the legacy `_userId` / `_saverId` parameters are still
 * accepted and still ignored (identity ALWAYS derives from the session).
 */
import { apiFetch } from '@/lib/api/client';
import type { TeacherSuggestion } from '@/types/community';

export async function getProfilesAction(uids: string[]): Promise<any[]> {
    return apiFetch('/api/community/profiles', { body: { uids } });
}

export async function createPostAction(
    content: string,
    visibility: string = 'public',
    imageUrl?: string,
    gradeLevel?: string,
    subject?: string,
): Promise<string> {
    const { id } = await apiFetch<{ id: string }>('/api/community/posts', {
        body: { content, visibility, imageUrl, gradeLevel, subject },
    });
    return id;
}

export async function toggleLikeAction(postId: string): Promise<void> {
    await apiFetch('/api/community/posts/like', { body: { postId } });
}

export async function getPosts(
    filters: { language?: string; limit?: number; gradeLevels?: string[]; subjects?: string[] } = {},
): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.language) params.set('language', filters.language);
    for (const g of filters.gradeLevels ?? []) params.append('gradeLevels', g);
    for (const s of filters.subjects ?? []) params.append('subjects', s);
    const qs = params.toString();
    return apiFetch(`/api/community/posts${qs ? `?${qs}` : ''}`);
}

export async function followTeacherAction(followingId: string): Promise<void> {
    await apiFetch('/api/community/follows', { body: { followingId } });
}

export async function getFollowingIdsAction(): Promise<string[]> {
    return apiFetch('/api/community/follows');
}

export async function getFollowingPosts(): Promise<any[]> {
    return apiFetch('/api/community/follows/posts');
}

export async function getLibraryResources(
    filters: { type?: string; language?: string; authorId?: string; authorIds?: string[]; excludeTypes?: string[] } = {},
): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.language) params.set('language', filters.language);
    if (filters.authorId) params.set('authorId', filters.authorId);
    for (const a of filters.authorIds ?? []) params.append('authorIds', a);
    for (const t of filters.excludeTypes ?? []) params.append('excludeTypes', t);
    const qs = params.toString();
    return apiFetch(`/api/community/resources${qs ? `?${qs}` : ''}`);
}

export async function trackDownloadAction(resourceId: string): Promise<void> {
    await apiFetch('/api/community/resources/download', { body: { resourceId } });
}

export async function getRecommendedTeachersAction(userId?: string): Promise<TeacherSuggestion[]> {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiFetch(`/api/community/teachers/recommended${qs}`);
}

export async function getAllTeachersAction(currentUserId?: string): Promise<TeacherSuggestion[]> {
    const qs = currentUserId ? `?self=${encodeURIComponent(currentUserId)}` : '';
    return apiFetch(`/api/community/teachers${qs}`);
}

export async function likeResourceAction(
    resourceId: string,
    _userId?: string,
): Promise<{ isLiked: boolean; newCount: number }> {
    void _userId; // legacy parameter — identity comes from the session
    return apiFetch('/api/community/resources/like', { body: { resourceId } });
}

export async function saveResourceToLibraryAction(
    resource: {
        id: string;
        title: string;
        type: string;
        authorId: string;
        language: string;
        gradeLevel?: string;
        subject?: string;
    },
    _saverId?: string,
): Promise<{ alreadySaved: boolean }> {
    void _saverId; // legacy parameter — identity comes from the session
    return apiFetch('/api/community/resources/save', { body: { resource } });
}

export async function publishContentToLibraryAction(
    contentId: string,
    _userId?: string,
): Promise<{ resourceId: string }> {
    void _userId; // legacy parameter — identity comes from the session
    return apiFetch('/api/community/resources/publish', { body: { contentId } });
}

export async function shareLatestContentAction(contentType: string): Promise<{ resourceId: string }> {
    return apiFetch('/api/community/resources/share-latest', { body: { contentType } });
}

export async function sendChatMessageAction(text: string, audioUrl?: string): Promise<void> {
    await apiFetch('/api/community/chat', { body: { text, audioUrl } });
}

export async function getLikedItemIdsAction(): Promise<{
    groupPostIds: string[];
    resourceIds: string[];
}> {
    return apiFetch('/api/community/likes');
}
