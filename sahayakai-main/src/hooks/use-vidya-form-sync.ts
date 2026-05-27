"use client";

import { useEffect, useRef } from "react";
import { useJarvisStore } from "@/store/jarvisStore";
import { useLanguage } from "@/context/language-context";

/**
 * Syncs a page's form state into the VIDYA (OmniOrb) store so the voice
 * assistant can "see" what the teacher is currently working on, and persists a
 * snapshot to localStorage so that context survives page navigation and browser
 * refreshes.
 *
 * Cross-language snapshot guard (2026-05-27):
 *   Every saved snapshot is tagged with the UI language it was authored in
 *   (`__uiLang`). On read, if the saved language ≠ current UI language we
 *   return `null` so the consumer does NOT restore stale text. This fixes the
 *   "mixed Devanagari + Bengali in the same textarea" bug — a Hindi-typed
 *   question would silently bleed into the Bengali UI after a language switch.
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
 * @returns        The last saved snapshot for this page (null if saved in a
 *                 different UI language than the current one)
 */
export function useVidyaFormSync(
    pageKey: string,
    values: Record<string, any>
): Record<string, any> | null {
    const { setStructuredData, saveFormSnapshot, formSnapshots } = useJarvisStore();
    const { language: uiLanguage } = useLanguage();
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
            // Tag with the UI language at save time so we can detect language
            // mismatch on restore (see guard below).
            saveFormSnapshot(pageKey, { ...safe, __uiLang: uiLanguage });
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            // 2026-05-19 (NCERT demo fix): on unmount, if we are still the
            // publisher of the live `structuredData` payload, clear it.
            // Without this, navigating from a sync'd page (e.g. quiz-
            // generator) to a NON-sync'd page (e.g. exam-paper) would leave
            // the prior page's form fields visible to VIDYA, who would then
            // mistake them for the new page's active state.
            const current = useJarvisStore.getState().structuredData;
            if (current?.page === pageKey) {
                useJarvisStore.getState().setStructuredData({});
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageKey, setStructuredData, saveFormSnapshot, serialised, uiLanguage]);

    const snapshot = formSnapshots[pageKey];
    if (!snapshot) return null;
    // Snapshot pre-dating this guard has no __uiLang; treat as English so a
    // non-English UI doesn't restore it. (Prevents the legacy bleed too.)
    const snapshotLang = snapshot.__uiLang ?? 'English';
    if (snapshotLang !== uiLanguage) return null;
    return snapshot;
}
