/**
 * Typed client for the /api/ncert/chapters boundary — tranche 5.
 *
 * Signature is IDENTICAL to the migrated server action
 * (src/app/actions/ncert.ts, deleted). Preserves the action's
 * graceful-failure semantics: [] on any error (including auth), so the
 * chapter selector falls back to the static bundled dataset.
 */

import { apiFetch } from '@/lib/api/client';
import type { NCERTChapter } from '@/data/ncert';

export async function getNCERTChapters(grade: number, subject?: string): Promise<NCERTChapter[]> {
    try {
        const params = new URLSearchParams({ grade: String(grade) });
        if (subject) params.set('subject', subject);
        return await apiFetch<NCERTChapter[]>(`/api/ncert/chapters?${params.toString()}`);
    } catch {
        return []; // client falls back to static data
    }
}
