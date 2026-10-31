/**
 * Generic Storage + Firestore persist helpers (Phase K).
 *
 * Sidecar canary/full mode dispatchers replicate the Genkit flows'
 * Storage persistence so the user's library still gets the artefact
 * regardless of which AI path served the request.
 *
 * The Genkit flows write the JSON output to Firebase Storage at
 * `users/{uid}/{collection}/{ts}_{slug}.json` and a content-doc to
 * the unified `users/{uid}/content/{contentId}` Firestore subcollection
 * via `dbAdapter.saveContent`. Before Phase K only `avatar-generator`
 * mirrored this in its dispatcher; the other 9 flows silently dropped
 * the artefact on canary/full so the teacher's library never saw it.
 *
 * Fail-soft: a Storage or Firestore write failure is logged but does
 * not propagate. The user has already received the response — we don't
 * want a transient backend outage to convert a successful generation
 * into a 500.
 *
 * Artifact boundary: these helpers run only AFTER the sidecar returned a
 * validated output, so a successful write is the moment a real Library
 * artifact exists — hence `status: 'ready'`. The doc id is the caller's
 * stable `contentId` when supplied (see `@/lib/content-id`), so a sidecar
 * persist and a racing Genkit persist of the same generation land on one
 * row instead of two.
 */
import 'server-only';
import type { BaseContent, ContentType, GradeLevel, Language, Subject } from '@/types/index';
import { logger } from '@/lib/logger';
import { resolveContentId } from '@/lib/content-id';

export interface PersistJSONInput<T> {
    /** Authenticated user ID. The artefact is filed under this user's library. */
    uid: string;
    /**
     * Storage subdir under `users/{uid}/`. e.g. `quizzes`, `exam-papers`,
     * `lesson-plans`. Mirrors the Genkit flow's existing storage layout
     * so My Library URLs continue to work.
     */
    collection: string;
    /**
     * Firestore content `type` discriminator. Determines which My Library
     * tab the artefact appears under.
     */
    contentType: ContentType;
    /** Display title — used for the slug and the content doc's `title`. */
    title: string;
    /** The full JSON payload returned to the API caller. */
    output: T;
    /**
     * Per-flow Firestore content-doc fields. The helper fills `id`,
     * `title`, `storagePath`, `createdAt`, `updatedAt`, `data`, `type`,
     * `isPublic`, `isDraft`. Callers supply the search/filter metadata
     * (gradeLevel, subject, topic, language).
     */
    metadata: {
        gradeLevel: GradeLevel | string;
        subject: Subject | string;
        topic: string;
        language: Language | string;
    };
    /**
     * Skip the redundant Storage JSON blob and persist to Firestore `data`
     * only. Used by content types (e.g. exam-paper) that are viewed/downloaded
     * straight from `data`. Default false → all other types keep the blob.
     */
    skipStorageBlob?: boolean;
    /** Stable artifact id minted per generation; a fresh UUID when absent/invalid. */
    contentId?: string;
}

export interface PersistJSONResult {
    contentId: string;
    storagePath?: string;
}

/** yyyyMMdd_HHmmss timestamp matching the Genkit flows' Storage paths. */
function formatTimestamp(now: Date): string {
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return (
        `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
        `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    );
}

function slugify(s: string): string {
    return (
        s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50) || 'untitled'
    );
}

/**
 * Persist a sidecar-produced JSON artefact to Storage + Firestore.
 *
 * Returns `{ contentId, storagePath }` on success, or `null` on any
 * failure (logged at WARN level). Fail-soft is intentional — see file
 * header.
 */
export async function persistSidecarJSON<T>(
    input: PersistJSONInput<T>,
): Promise<PersistJSONResult | null> {
    try {
        const { dbAdapter } = await import('@/lib/db/adapter');
        const { Timestamp } = await import('firebase-admin/firestore');

        const now = new Date();
        const contentId = resolveContentId(input.contentId);

        let storagePath: string | undefined;
        if (!input.skipStorageBlob) {
            const { getStorageInstance } = await import('@/lib/firebase-admin');
            const fileName = `${formatTimestamp(now)}_${slugify(input.title)}.json`;
            storagePath = `users/${input.uid}/${input.collection}/${fileName}`;
            const storage = await getStorageInstance();
            const file = storage.bucket().file(storagePath);
            await file.save(JSON.stringify(input.output, null, 2), {
                resumable: false,
                metadata: { contentType: 'application/json' },
            });
        }

        const contentDoc: BaseContent<T> = {
            id: contentId,
            type: input.contentType,
            title: input.title,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gradeLevel: input.metadata.gradeLevel as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subject: input.metadata.subject as any,
            topic: input.metadata.topic,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            language: input.metadata.language as any,
            ...(storagePath ? { storagePath } : {}),
            isPublic: false,
            isDraft: false,
            status: 'ready',
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: input.output,
        };

        await dbAdapter.saveContent(input.uid, contentDoc);

        return { contentId, storagePath };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
            `[persist] failed for ${input.collection}/${input.uid}: ${msg}`,
            'PERSIST',
            {
                uid: input.uid,
                collection: input.collection,
                contentType: input.contentType,
            },
        );
        return null;
    }
}


export interface PersistImageInput {
    /** Authenticated user ID. */
    uid: string;
    /**
     * Storage subdir under `users/{uid}/`. e.g. `visual-aids`, `avatars`.
     */
    collection: string;
    /** Firestore content `type` discriminator. */
    contentType: ContentType;
    /** Display title — used for the slug. */
    title: string;
    /**
     * Image as a `data:image/<subtype>;base64,<body>` URI. The helper
     * strips the prefix and writes the raw bytes.
     */
    imageDataUri: string;
    /** Per-flow Firestore content-doc filter fields. */
    metadata: {
        gradeLevel: GradeLevel | string;
        subject: Subject | string;
        topic: string;
        language: Language | string;
    };
    /**
     * Optional extra fields merged into the content doc's `data`
     * field. Used by visual-aid for `pedagogicalContext` /
     * `discussionSpark`.
     */
    extraData?: Record<string, unknown>;
    /** Stable artifact id minted per generation; a fresh UUID when absent/invalid. */
    contentId?: string;
}

/**
 * Persist a sidecar-produced image to Storage + Firestore.
 *
 * Strips the `data:image/<subtype>;base64,` prefix, writes raw bytes
 * to `users/{uid}/{collection}/{ts}_{slug}.png`, and a content doc to
 * `users/{uid}/content/{contentId}` via `dbAdapter.saveContent`.
 *
 * Returns `{ contentId, storagePath }` on success, `null` on any
 * failure (logged at WARN level). Fail-soft — see file header.
 */
export async function persistSidecarImage(
    input: PersistImageInput,
): Promise<PersistJSONResult | null> {
    try {
        const { getStorageInstance } = await import('@/lib/firebase-admin');
        const { dbAdapter } = await import('@/lib/db/adapter');
        const { Timestamp } = await import('firebase-admin/firestore');

        const now = new Date();
        const timestamp = formatTimestamp(now);
        const contentId = resolveContentId(input.contentId);
        const slug = slugify(input.title);
        const fileName = `${timestamp}_${slug}.png`;
        const storagePath = `users/${input.uid}/${input.collection}/${fileName}`;

        // Strip data URI prefix; preserve raw payload.
        const base64 = input.imageDataUri.includes(',')
            ? input.imageDataUri.split(',')[1]
            : input.imageDataUri;
        const buffer = Buffer.from(base64, 'base64');

        const storage = await getStorageInstance();
        const file = storage.bucket().file(storagePath);
        await file.save(buffer, {
            resumable: false,
            metadata: { contentType: 'image/png' },
        });

        const dataPayload = {
            ...(input.extraData ?? {}),
            storageRef: storagePath,
        };

        const contentDoc: BaseContent<typeof dataPayload> = {
            id: contentId,
            type: input.contentType,
            title: input.title,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gradeLevel: input.metadata.gradeLevel as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subject: input.metadata.subject as any,
            topic: input.metadata.topic,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            language: input.metadata.language as any,
            storagePath,
            isPublic: false,
            isDraft: false,
            status: 'ready',
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: dataPayload,
        };

        await dbAdapter.saveContent(input.uid, contentDoc);

        return { contentId, storagePath };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(
            `[persist] image failed for ${input.collection}/${input.uid}: ${msg}`,
            'PERSIST',
            {
                uid: input.uid,
                collection: input.collection,
                contentType: input.contentType,
            },
        );
        return null;
    }
}
