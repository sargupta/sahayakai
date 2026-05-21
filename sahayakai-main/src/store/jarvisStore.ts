import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ScreenContext = {
    path: string;
    uiState: Record<string, any>;
};

/**
 * Long-term teacher profile — persists across sessions.
 * Populated from usage patterns and explicit user settings.
 */
export type TeacherProfile = {
    preferredGrade: string | null;
    preferredSubject: string | null;
    preferredLanguage: string | null;
    schoolContext: string | null; // e.g. "village school, Rajasthan, no projector"
    lastActiveAt: number | null;  // unix ms — for daily-inspiration freshness check
};

interface JarvisState {
    // ── Session memory (last 20 turns) ───────────────────────────────────
    chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[];
    currentScreenContext: ScreenContext | null;
    // Live form fields published by the active page so VIDYA can "see" them.
    // CRITICAL: this is page-scoped via the `page` key. The OmniOrb client
    // strips this from the API payload whenever `structuredData.page` does
    // not match the current pathname — otherwise a stale form from a prior
    // page would bleed into the next intent classification.
    structuredData: Record<string, any>;

    // ── Long-term teacher profile ─────────────────────────────────────────
    teacherProfile: TeacherProfile;

    // ── Persisted per-page form snapshots ────────────────────────────────
    // Keyed by page name (e.g. "worksheet-wizard"). Survives navigation AND
    // page refresh. Cleared after a successful generation so stale data
    // doesn't re-populate when the teacher starts a new request.
    formSnapshots: Record<string, Record<string, any>>;

    // ── Voice surface coordination (2026-04-26) ──────────────────────────
    // Two voice surfaces exist: the global OmniOrb (floating mic, mounted
    // in app-shell) and the page-mounted VoiceAssistant chat dialog
    // (currently used by /teacher-training, may extend to other pages).
    // When the dialog is open, OmniOrb hides itself to prevent the
    // "two competing voice UIs at once" UX bug. Set by VoiceAssistant on
    // open/close; read by OmniOrb in its render guard.
    voiceDialogOpen: boolean;

    // ── Per-query staging state (2026-05-19, NCERT demo prep) ────────────
    // `lastQueryAt`  — unix-ms timestamp of the last completed voice query.
    //                  Used by OmniOrb to decide whether the chatHistory
    //                  should be carried into the next query (short gap =
    //                  follow-up; long gap = fresh intent).
    // `lastQueryPath` — pathname of the screen on which the previous query
    //                  was issued. Cross-page transitions are treated as a
    //                  fresh intent rather than a continuation, so
    //                  "for Class 10" on `/exam-paper` does NOT inherit
    //                  "quiz, Class 7, Science, photosynthesis" from the
    //                  prior `/quiz-generator` query.
    // Neither is persisted across browser sessions (only in-memory).
    lastQueryAt: number | null;
    lastQueryPath: string | null;

    // ── Actions ───────────────────────────────────────────────────────────
    addMessage: (role: 'user' | 'model', text: string) => void;
    setScreenContext: (context: ScreenContext) => void;
    setStructuredData: (data: Record<string, any>) => void;
    /**
     * Wipe `structuredData` only when the currently-published payload
     * belongs to a different page (i.e. the user navigated away from the
     * page that owned it and the new page never claimed ownership).
     * Lets pages without `useVidyaFormSync` avoid leaking the previous
     * page's form state into the next OmniOrb query.
     */
    clearStructuredDataIfStale: (currentPath: string) => void;
    setVoiceDialogOpen: (open: boolean) => void;
    /** Merge partial profile update — never wipes the whole profile */
    updateTeacherProfile: (patch: Partial<TeacherProfile>) => void;
    /**
     * Merge a profile fetched from Firestore into local state.
     * Firestore wins only when it is more recent than the local copy,
     * so a teacher who just updated a preference on this device won't
     * have it silently overwritten by a stale cloud value.
     */
    mergeTeacherProfile: (firestoreProfile: Partial<TeacherProfile>) => void;
    saveFormSnapshot: (page: string, data: Record<string, any>) => void;
    clearFormSnapshot: (page: string) => void;
    /** Mark a query as just-completed so freshness checks can use it. */
    markQueryCompleted: (path: string) => void;
    /** Clears only session memory; profile and snapshots are intentionally preserved */
    resetContext: () => void;
}

const DEFAULT_PROFILE: TeacherProfile = {
    preferredGrade: null,
    preferredSubject: null,
    preferredLanguage: null,
    schoolContext: null,
    lastActiveAt: null,
};

export const useJarvisStore = create<JarvisState>()(
    persist(
        (set) => ({
            chatHistory: [],
            currentScreenContext: null,
            structuredData: {},
            teacherProfile: DEFAULT_PROFILE,
            formSnapshots: {},
            voiceDialogOpen: false,
            lastQueryAt: null,
            lastQueryPath: null,

            setVoiceDialogOpen: (open) => set({ voiceDialogOpen: open }),

            clearStructuredDataIfStale: (currentPath) =>
                set((state) => {
                    const sdPage = state.structuredData?.page;
                    // No `page` field means no page has claimed ownership —
                    // safest to clear so VIDYA isn't fed orphan form data.
                    if (!sdPage) return Object.keys(state.structuredData).length > 0
                        ? { structuredData: {} }
                        : {};
                    // Compare the publisher's pageKey against the screen's
                    // pathname slug. `worksheet-wizard` ↔ `/worksheet-wizard`,
                    // case-insensitive trim of leading slash.
                    const slug = currentPath.replace(/^\//, '').split('/')[0] || '';
                    if (slug && slug.toLowerCase() === String(sdPage).toLowerCase()) {
                        return {}; // same page, keep
                    }
                    return { structuredData: {} };
                }),

            markQueryCompleted: (path) =>
                set({ lastQueryAt: Date.now(), lastQueryPath: path }),

            addMessage: (role, text) =>
                set((state) => {
                    // Keep only the last 20 messages to avoid payload bloat
                    const newHistory = [...state.chatHistory, { role, parts: [{ text }] }];
                    if (newHistory.length > 20) newHistory.shift();
                    return { chatHistory: newHistory };
                }),

            setScreenContext: (context) => set({ currentScreenContext: context }),

            setStructuredData: (data) => set({ structuredData: data }),

            updateTeacherProfile: (patch) =>
                set((state) => ({
                    teacherProfile: {
                        ...state.teacherProfile,
                        ...patch,
                        lastActiveAt: Date.now(),
                    },
                })),

            mergeTeacherProfile: (firestoreProfile) =>
                set((state) => {
                    const firestoreTs = (firestoreProfile.lastActiveAt as number) ?? 0;
                    const localTs = state.teacherProfile.lastActiveAt ?? 0;
                    // Firestore wins when it is newer OR when no local data exists yet
                    if (localTs > firestoreTs) return {}; // local is fresher — no change
                    return {
                        teacherProfile: {
                            ...state.teacherProfile,
                            ...firestoreProfile,
                        },
                    };
                }),

            saveFormSnapshot: (page, data) =>
                set((state) => ({
                    formSnapshots: { ...state.formSnapshots, [page]: data },
                })),

            clearFormSnapshot: (page) =>
                set((state) => {
                    const next = { ...state.formSnapshots };
                    delete next[page];
                    return { formSnapshots: next };
                }),

            /** Only wipe session state — profile and snapshots survive reset intentionally */
            resetContext: () =>
                set({
                    chatHistory: [],
                    currentScreenContext: null,
                    structuredData: {},
                    lastQueryAt: null,
                    lastQueryPath: null,
                }),
        }),
        {
            name: 'jarvis-storage',
            version: 1,
            // Explicitly list keys to persist so future additions don't auto-persist sensitive data
            partialize: (state) => ({
                chatHistory: state.chatHistory,
                teacherProfile: state.teacherProfile,
                formSnapshots: state.formSnapshots,
            }),
            // Runs whenever the persisted schema version is older than `version`.
            // Normalises any stale localStorage data to the current shape.
            migrate: (persisted: any, _version: number) => {
                const state = persisted as Partial<JarvisState>;
                return {
                    chatHistory: Array.isArray(state.chatHistory) ? state.chatHistory : [],
                    teacherProfile: (typeof state.teacherProfile === 'object' && state.teacherProfile)
                        ? { ...DEFAULT_PROFILE, ...state.teacherProfile }
                        : DEFAULT_PROFILE,
                    formSnapshots: (typeof state.formSnapshots === 'object' && state.formSnapshots)
                        ? state.formSnapshots
                        : {},
                };
            },
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.warn('[jarvisStore] Rehydration failed — using defaults', error);
                }
            },
        }
    )
);
