"use client";

import { useEffect, useRef } from "react";
import { useJarvisStore } from "@/store/jarvisStore";

/**
 * Syncs a page's form state into the VIDYA (OmniOrb) store so the voice
 * assistant can "see" what the teacher is currently working on, and persists a
 * snapshot to localStorage so that context survives page navigation and browser
 * refreshes.
 *
 * Usage:
 *   const watchedTopic = form.watch("topic");
 *   const watchedGrade = form.watch("gradeLevel");
 *   const savedSnapshot = useVidyaFormSync("worksheet-wizard", {
 *       topic: watchedTopic, gradeLevel: watchedGrade,
 *   });
 *
 * @param pageKey  Stable identifier for the page, e.g. "worksheet-wizard"
 * @param values   Current form field values to publish and persist
 * @returns        The last saved snapshot for this page (use for restore-on-mount)
 */
export function useVidyaFormSync(
    pageKey: string,
    values: Record<string, any>
): Record<string, any> | null {
    const { setStructuredData, saveFormSnapshot, formSnapshots } = useJarvisStore();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Serialise values once so the effect dep is a stable primitive string
    const serialised = JSON.stringify(values);

    useEffect(() => {
        // 1. Immediate live awareness — VIDYA's next voice message will see
        //    the current form state without waiting for the debounce.
        setStructuredData({ page: pageKey, ...values });

        // 2. Debounced persistence — writes to localStorage after 500 ms of
        //    inactivity so we don't spam writes on every keystroke.
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            // Strip imageDataUri — data URIs can be megabytes and blow
            // the localStorage 5 MB budget in a single save.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { imageDataUri, ...safe } = values as any;
            saveFormSnapshot(pageKey, safe);
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageKey, setStructuredData, saveFormSnapshot, serialised]);

    return formSnapshots[pageKey] ?? null;
}
