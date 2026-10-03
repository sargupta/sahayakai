"use client";

import { useRef } from "react";

/**
 * The My Library id a result display saves under.
 *
 * `contentId` is the id the server filed this generation under
 * (`useGenerator().contentId`) or the restored item's id, so Save updates
 * that row instead of creating a duplicate.
 *
 * Without one (legacy callers, locally cached results), the fallback is
 * keyed to the `artifact` object: repeated Save clicks on the same result
 * upsert one row, while a DIFFERENT result shown in the same mounted
 * display gets a new id — so it can never overwrite the previous save.
 */
export function useLibraryId(contentId: string | null | undefined, artifact: unknown): string {
    const fallback = useRef<{ artifact: unknown; id: string } | null>(null);
    if (!fallback.current || fallback.current.artifact !== artifact) {
        fallback.current = { artifact, id: crypto.randomUUID() };
    }
    return contentId || fallback.current.id;
}
