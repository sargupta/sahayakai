/**
 * Rendered audio for the console's preview player. Org-scoped: the clip's
 * metadata lives under the school, and its `orgId` must match, so one school
 * can never fetch another's audio by guessing a content hash.
 */

import { z } from 'zod';

import type { AudioStore } from '@/lib/sampark/ports';
import { notFound } from '@/server/sampark/errors';
import type { SamparkCtx } from '@/server/sampark/http';
import { getSchoolOrThrow } from '@/server/sampark/school';

/** Content-hash keys: letters, digits, '-', '_', '.', never a path. */
export const AudioKeySchema = z
    .string()
    .regex(/^[A-Za-z0-9_.-]{8,200}$/, 'invalid audio key')
    .refine((k) => !k.includes('..'), 'invalid audio key');

export async function getClipAudio(
    ctx: SamparkCtx,
    store: AudioStore,
    orgId: string,
    key: string,
): Promise<{ audio: Buffer; mimeType: string }> {
    await getSchoolOrThrow(ctx, orgId);
    const clip = await ctx.repo.getClip(orgId, key);
    if (!clip || clip.orgId !== orgId) throw notFound('AUDIO_NOT_FOUND', 'Audio not found');
    const stored = await store.get(key);
    if (!stored) throw notFound('AUDIO_NOT_FOUND', 'Audio not found');
    return stored;
}
