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
    // Live form fields published by the active page so VIDYA can "see" them
    structuredData: Record<string, any>;

    // ── Long-term teacher profile ─────────────────────────────────────────
    teacherProfile: TeacherProfile;

    // ── Persisted per-page form snapshots ────────────────────────────────
    // Keyed by page name (e.g. "worksheet-wizard"). Survives navigation AND
    // page refresh. Cleared after a successful generation so stale data
    // doesn't re-populate when the teacher starts a new request.
    formSnapshots: Record<string, Record<string, any>>;

    // ── Actions ───────────────────────────────────────────────────────────
    addMessage: (role: 'user' | 'model', text: string) => void;
    setScreenContext: (context: ScreenContext) => void;
    setStructuredData: (data: Record<string, any>) => void;
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
                set({ chatHistory: [], currentScreenContext: null, structuredData: {} }),
        }),
        {
            name: 'jarvis-storage',
            // Explicitly list keys to persist so future additions don't auto-persist sensitive data
            partialize: (state) => ({
                chatHistory: state.chatHistory,
                teacherProfile: state.teacherProfile,
                formSnapshots: state.formSnapshots,
            }),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.warn('[jarvisStore] Rehydration failed — using defaults', error);
                    return;
                }
                if (state) {
                    if (!Array.isArray(state.chatHistory)) state.chatHistory = [];
                    if (typeof state.teacherProfile !== 'object' || !state.teacherProfile)
                        state.teacherProfile = DEFAULT_PROFILE;
                    if (typeof state.formSnapshots !== 'object' || !state.formSnapshots)
                        state.formSnapshots = {};
                }
            },
        }
    )
);
