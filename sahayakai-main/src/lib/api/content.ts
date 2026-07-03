/**
 * Typed client for the /api/content/{library,search,pdf-download,storage-test}
 * boundary — tranche 5.
 *
 * Signatures are IDENTICAL to the migrated server actions
 * (src/app/actions/content.ts, deleted), including the vestigial `_userId`
 * first parameter (Wave 1 stopped trusting it; the server derives uid from
 * the verified header). Components only change their import path.
 */

import { apiFetch, ApiError } from '@/lib/api/client';
import type { BaseContent, ContentType } from '@/types';

/**
 * Get the caller's own content. Fails soft ([]) on non-auth errors, matching
 * the action; auth failures still throw so callers can prompt sign-in.
 */
export async function getUserContent(_userId?: string): Promise<BaseContent[]> {
    void _userId;
    try {
        return await apiFetch<BaseContent[]>('/api/content/library');
    } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
        return [];
    }
}

/**
 * Context-aware smart search for the Library.
 */
export async function searchContentAction(_userId: string, query: string): Promise<BaseContent[]> {
    void _userId;
    try {
        return await apiFetch<BaseContent[]>(`/api/content/search?q=${encodeURIComponent(query)}`);
    } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
        return [];
    }
}

/**
 * Save content to the caller's library. Result-object contract preserved:
 * never throws — returns { success: false, error } on failure.
 */
export async function saveToLibrary(
    _userId: string,
    type: ContentType,
    title: string,
    data: any,
): Promise<{ success: boolean; id?: string; error?: string }> {
    void _userId;
    try {
        return await apiFetch('/api/content/library', { method: 'POST', body: { type, title, data } });
    } catch (err) {
        return {
            success: false,
            error: err instanceof ApiError ? err.message : 'Failed to save. Please try again.',
        };
    }
}

/**
 * Record a PDF download (binary → Storage + tracking doc). Result-object
 * contract preserved: never throws.
 */
export async function recordPdfDownload(
    _userId: string,
    title: string,
    base64Data: string,
    type: ContentType = 'lesson-plan',
): Promise<{ success: boolean; path?: string; error?: string }> {
    void _userId;
    try {
        return await apiFetch('/api/content/pdf-download', {
            method: 'POST',
            body: { title, base64Data, type },
        });
    } catch (err) {
        return {
            success: false,
            error: err instanceof ApiError ? err.message : 'Failed to record PDF download.',
        };
    }
}

/**
 * Admin-only Storage diagnostic.
 */
export async function testStorageConnection(
    _userId: string = 'user-123',
): Promise<{ success: boolean; message: string }> {
    void _userId;
    try {
        return await apiFetch('/api/content/storage-test', { method: 'POST', body: {} });
    } catch (err) {
        return {
            success: false,
            message: err instanceof ApiError ? err.message : 'Storage test failed.',
        };
    }
}
