"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useJarvisStore } from "@/store/jarvisStore";
import { useAuth } from "@/context/auth-context";
import { useFeatureFlag } from "@/context/feature-flags-context";
import { stripRedundantGreeting } from "@/lib/vidya-greeting-suppressor";
import { auth } from "@/lib/firebase";
import { MicrophoneInput } from "@/components/microphone-input";
import { Button } from "@/components/ui/button";
import { Trash2, BrainCircuit, Sparkles, Cloud, Bookmark } from "lucide-react";
import { tts } from "@/lib/tts";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import type { VidyaAction } from "@/lib/sidecar/types.generated";
import { buildVidyaAppContext, subscribeVidyaAppContext } from "@/lib/vidya/app-context-registry";
import { buildLiveAppContextFrame, liveToolCallToAppAction, LIVE_APP_TOOL_NAMES } from "@/lib/vidya/live-app-context";
import { validateAppAction, type VidyaAppAction } from "@/lib/vidya/app-context-contract";
import { runAppAction } from "@/lib/vidya/run-app-action";
import { normaliseVidyaLanguage } from "@/lib/vidya-action-normalizer";
import { logger } from '@/lib/client-logger';
import { VidyaLiveOrb } from "@/components/vidya-live-orb";
import { useVidyaLiveSession } from "@/components/vidya/vidya-live-provider";
import type { VidyaLiveToolCall } from "@/lib/vidya-live/live-session";

// Hands-free voice (Google ADK / Gemini Live via the sidecar /stream socket).
// Off by default: the turn-based STT → /api/assistant → TTS mic stays the
// shipped path until the live path is rolled out. Server-side access is still
// gated by VIDYA_VOICE_LIVE_ENABLED + VIDYA_VOICE_LIVE_ALLOWED_UIDS.
const LIVE_VOICE_ENABLED = process.env.NEXT_PUBLIC_VIDYA_LIVE_VOICE === "1";

// ADK tool name (`open_lesson_plan`) → routable flow id (`lesson-plan`).
// Anything not in KNOWN_FLOWS is dropped, same guard as the text path.
function liveToolToAction(call: VidyaLiveToolCall): VidyaAction | null {
    if (!call.name.startsWith("open_")) return null;
    const flow = call.name.slice(5).replace(/_/g, "-") as VidyaAction["flow"];
    if (!KNOWN_FLOWS.has(flow)) return null;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return {
        type: "NAVIGATE_AND_FILL",
        flow,
        params: {
            topic: str(call.args.topic),
            gradeLevel: str(call.args.gradeLevel),
            subject: str(call.args.subject),
            language: str(call.args.language),
        },
    };
}

// Known routable flow ids. Mirrors the wire enum in
// `src/lib/sidecar/types.generated.ts` (`VidyaAction.flow`) and the
// `FLOW_LABEL` map below. Used to guard against a model hallucinating
// a flow name we have no page for — e.g. "lesson-plan-tutorial" or
// "quiz" (instead of "quiz-generator"). Without this guard, the client
// silently `router.push`es to a 404 and the teacher sees nothing happen.
const KNOWN_FLOWS = new Set<VidyaAction['flow']>([
    'lesson-plan',
    'quiz-generator',
    'visual-aid-designer',
    'worksheet-wizard',
    'virtual-field-trip',
    'teacher-training',
    'rubric-generator',
    'exam-paper',
    'video-storyteller',
    'instant-answer',
]);

// Phase N.1 + P5: when the supervisor authors >1 actions for a compound
// intent ("make a quiz AND a worksheet on photosynthesis"), the client
// renders one chip per action instead of auto-navigating. Teacher taps
// each chip to dispatch its flow.
//
// Friendly labels by flow id — used as chip text. Falls back to
// `action.flow` for any future flow added without a label.
const FLOW_LABEL: Record<VidyaAction['flow'], string> = {
    'lesson-plan': 'Lesson plan',
    'quiz-generator': 'Quiz',
    'visual-aid-designer': 'Visual aid',
    'worksheet-wizard': 'Worksheet',
    'virtual-field-trip': 'Field trip',
    'teacher-training': 'Training',
    'rubric-generator': 'Rubric',
    'exam-paper': 'Exam paper',
    'video-storyteller': 'Video',
    'instant-answer': 'Instant Answer',
};

// ── Authenticated fetch helper ────────────────────────────────────────────────
// Attaches a fresh Firebase ID token to every /api/vidya/* request.
// Returns null (and never throws) when the user is not signed in so all
// Firestore sync can be treated as fire-and-forget by callers.
async function vidyaApiFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return null;
        return fetch(path, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`,
                ...(options.headers ?? {}),
            },
        });
    } catch {
        return null;
    }
}

export function OmniOrb() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const { t, language: uiLanguage } = useLanguage();
    // Feature flag: vidyaGreetingSuppressor
    //   ENABLED (default) — strip redundant opening greetings ("Namaste",
    //                       "Sure", "Of course") after the first model
    //                       turn so VIDYA doesn't sound like a chatbot
    //                       in a multi-turn conversation. See
    //                       src/lib/vidya-greeting-suppressor.ts.
    //   DISABLED          — leave the LLM output untouched (revert to
    //                       pre-suppressor behavior).
    const greetingSuppressorEnabled = useFeatureFlag('vidyaGreetingSuppressor');
    const {
        chatHistory,
        addMessage,
        setScreenContext,
        resetContext,
        structuredData,
        teacherProfile,
        updateTeacherProfile,
        mergeTeacherProfile,
        clearStructuredDataIfStale,
        markQueryCompleted,
        bindOwner,
    } = useJarvisStore();

    // 2026-04-26: hide OmniOrb when the page-mounted VoiceAssistant chat
    // dialog is open. Prevents two voice surfaces (floating mic + chat
    // dialog with its own mic) from competing for the teacher's attention.
    const voiceDialogOpen = useJarvisStore(s => s.voiceDialogOpen);

    const [orbPos, setOrbPos] = useState({ x: 0, y: 0 });
    const [isClient, setIsClient] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [orbOpen, setOrbOpen] = useState(false);
    // P5 — compound-intent chips. Populated when the supervisor returns
    // `plannedActions[]` with >1 item. Cleared on conversational turn,
    // chip tap, or chat-clear.
    const [pendingActions, setPendingActions] = useState<VidyaAction[]>([]);
    // Auto-hide-on-scroll: keeps voice-first prominence on idle, gets out
    // of the way while the teacher is reading generated output. Shown again
    // on scroll-up, near top, or when the memory drawer is open.
    const [hiddenByScroll, setHiddenByScroll] = useState(false);
    // Proactive greeting: shown once per browser session when profile exists
    const [proactiveTip, setProactiveTip] = useState<string | null>(null);
    const proactiveShown = useRef(false);

    // Stable session identifier for the current conversation.
    // Regenerated whenever resetContext() is called (new conversation starts).
    const currentSessionRef = useRef<string | null>(null);
    // Tracks whether the current session doc has been created in Firestore yet
    const sessionIsNewRef = useRef(true);

    const dragStartPos = useRef({ x: 0, y: 0 });
    const initialOrbPos = useRef({ x: 0, y: 0 });
    const orbRef = useRef<HTMLDivElement>(null);

    // ── Sync URL path to store + publish live form context ───────────────
    // 2026-05-19 (NCERT demo fix): clearing stale `structuredData` on
    // pathname change closes a state-pollution hole — pages that do NOT
    // call `useVidyaFormSync` (e.g. `/exam-paper`) would otherwise inherit
    // the previous page's form fields and VIDYA would "see" them as
    // current context. Symptom: founder said "for Class 10" on `/exam-paper`
    // and the orb routed to `quiz-generator` with Class 7 / Science /
    // photosynthesis from a prior `/quiz-generator` query.
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        // Pre-publish stale-clearing must run BEFORE we forward the
        // payload to VIDYA — otherwise the first query on a page that
        // doesn't claim ownership leaks the prior page's form fields.
        clearStructuredDataIfStale(pathname);
        // Pull the (possibly-just-cleared) value from the store so the
        // screen-context publish reflects reality, not the closure's
        // pre-clear snapshot.
        const fresh = useJarvisStore.getState().structuredData;
        setScreenContext({ path: pathname, uiState: fresh });
        // eslint-disable-next-line no-console
        console.debug('[OmniOrb] screen-context published', {
            path: pathname,
            uiStateKeys: Object.keys(fresh ?? {}),
        });
    }, [pathname, clearStructuredDataIfStale, setScreenContext, structuredData]);

    // ── Aggressive auto-hide (2026-05-27 rewrite) ────────────────────────
    // Previous behaviour was "hide on scroll-down only" but most teachers
    // reported the orb felt persistent on read-heavy pages because short
    // pages never crossed the 120px threshold and trackpad inertia kept
    // re-triggering scroll-up which restored it.
    //
    // New behaviour:
    //   • Hide on ANY scroll (either direction) — even 1px of scrolling
    //     dismisses the orb while the teacher reads.
    //   • Restore after IDLE_DELAY ms of no scroll activity (no scroll
    //     events for ~1.4s).
    //   • Also hide after 6s of full inactivity (no scroll, no pointer
    //     movement) on read-heavy pages — those pages added to the
    //     READ_HEAVY_PATHS allowlist below. Pointer movement restores.
    //   • Listens to BOTH window.scroll and the captured-scroll event so
    //     pages mounted inside an internal overflow-auto container also
    //     trigger hide.
    useEffect(() => {
        if (!isClient) return;
        const IDLE_AFTER_SCROLL_MS = 1400;
        const READ_HEAVY_PATHS = [
            '/lesson-plan',
            '/teacher-training',
            '/instant-answer',
            '/community',
            '/community-library',
            '/library',
            '/messages',
            '/privacy-for-teachers',
        ];
        const READ_HEAVY_IDLE_MS = 6000;
        let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
        let pointerIdleTimer: ReturnType<typeof setTimeout> | null = null;

        const isReadHeavy = READ_HEAVY_PATHS.some(p => pathname?.startsWith(p));

        const hide = () => setHiddenByScroll(true);
        const restoreSoon = (ms: number) => {
            if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
            scrollIdleTimer = setTimeout(() => setHiddenByScroll(false), ms);
        };

        const onScroll = () => {
            hide();
            restoreSoon(IDLE_AFTER_SCROLL_MS);
        };

        const onPointerActivity = () => {
            // Pointer activity = teacher engaged. Restore immediately.
            setHiddenByScroll(false);
            if (pointerIdleTimer) clearTimeout(pointerIdleTimer);
            if (isReadHeavy) {
                pointerIdleTimer = setTimeout(() => setHiddenByScroll(true), READ_HEAVY_IDLE_MS);
            }
        };

        window.addEventListener("scroll", onScroll, { passive: true, capture: true });
        window.addEventListener("pointermove", onPointerActivity, { passive: true });
        window.addEventListener("touchstart", onPointerActivity, { passive: true });

        // On read-heavy pages, start in idle countdown so the orb hides
        // 6s after page load if the teacher doesn't interact.
        if (isReadHeavy) {
            pointerIdleTimer = setTimeout(() => setHiddenByScroll(true), READ_HEAVY_IDLE_MS);
        }

        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true } as any);
            window.removeEventListener("pointermove", onPointerActivity);
            window.removeEventListener("touchstart", onPointerActivity);
            if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
            if (pointerIdleTimer) clearTimeout(pointerIdleTimer);
        };
    }, [isClient, pathname]);

    // ── Respect prefers-reduced-motion: when user wants less motion, the
    // orb still hides on scroll but without the slide/opacity transition.
    const [reducedMotion, setReducedMotion] = useState(false);
    useEffect(() => {
        if (!isClient) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReducedMotion(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [isClient]);

    // ── Proactive daily-inspiration greeting (once per session) ──────────
    useEffect(() => {
        if (proactiveShown.current) return;
        if (!isClient) return;
        if (chatHistory.length > 0) return; // already in a conversation

        const { preferredGrade, preferredSubject } = teacherProfile;
        if (!preferredGrade && !preferredSubject) return; // no profile yet

        const hour = new Date().getHours();
        const greeting = hour < 12 ? t("Good Morning") : hour < 17 ? t("Good Afternoon") : t("Good Evening");
        // Translate grade + subject tokens individually so each side of the · resolves correctly in the active UI language.
        const context = [preferredGrade, preferredSubject].filter(Boolean).map(s => t(s as string)).join(" · ");
        const tip = `${greeting}! ${t("Ready to prep your")} ${context} ${t("class? Just ask me to generate anything.")}`;

        setProactiveTip(tip);
        proactiveShown.current = true;
    }, [isClient, chatHistory.length, teacherProfile]);

    // ── Firestore restore on login ────────────────────────────────────────
    // When the user signs in, pull their teacher profile and latest conversation
    // from Firestore. This enables cross-device memory — a teacher who logs in
    // on a different device gets their context back immediately.
    useEffect(() => {
        // Memory isolation: the persisted VIDYA memory (chat history, profile,
        // form drafts) belongs to ONE teacher. Once auth has settled, a
        // different uid — or sign-out — wipes it before anything reads it,
        // so teacher B on a shared school device never sees teacher A's.
        if (authLoading) return;
        const uid = user?.uid ?? null;
        if (useJarvisStore.getState().ownerUid !== uid) {
            bindOwner(uid);
            currentSessionRef.current = null;
            sessionIsNewRef.current = true;
        }
        if (!user) return;

        // 1. Restore teacher profile (Firestore wins if more recent than local)
        vidyaApiFetch("/api/vidya/profile")
            .then((res) => res?.json())
            .then((data) => {
                if (data?.profile) mergeTeacherProfile(data.profile);
            })
            .catch(console.warn);

        // 2. Restore latest conversation (only if store is empty — no override)
        if (useJarvisStore.getState().chatHistory.length === 0) {
            vidyaApiFetch("/api/vidya/session")
                .then((res) => res?.json())
                .then((data) => {
                    if (!data?.messages?.length) return;
                    // Guard against a race where messages were added while fetching
                    if (useJarvisStore.getState().chatHistory.length > 0) return;
                    data.messages.forEach((msg: { role: "user" | "model"; parts: { text: string }[] }) => {
                        msg.parts.forEach((part) => addMessage(msg.role, part.text));
                    });
                    // Reconnect to the existing Firestore session — don't create a new one
                    currentSessionRef.current = data.sessionId;
                    sessionIsNewRef.current = false;
                })
                .catch(console.warn);
        }
    // Re-run only when the logged-in user identity changes (login / logout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, authLoading]);

    // ── Sync a conversation turn pair to Firestore (fire-and-forget) ─────
    const syncSessionTurn = useCallback(
        (
            updatedMessages: { role: "user" | "model"; parts: { text: string }[] }[],
            actionTriggered?: { flow: string; params: Record<string, any> } | null,
        ) => {
            if (!user || !currentSessionRef.current) return;
            const isNew = sessionIsNewRef.current;
            if (isNew) sessionIsNewRef.current = false; // first write creates the doc

            vidyaApiFetch("/api/vidya/session", {
                method: "POST",
                body: JSON.stringify({
                    sessionId: currentSessionRef.current,
                    messages: updatedMessages,
                    isNew,
                    actionTriggered: actionTriggered ?? undefined,
                    screenPath: pathname,
                }),
            }).catch(console.warn);
        },
        [user, pathname],
    );

    // ── Explicitly save (bookmark) the current conversation ──────────────
    // Bookmarks the teacher's own Firestore session; it then shows under
    // My Library → Conversations. The conversation is synced first so the
    // saved copy contains everything on screen.
    const saveCurrentConversation = useCallback(async () => {
        if (!user || chatHistory.length === 0) return;
        if (!currentSessionRef.current) {
            currentSessionRef.current = `sess_${user.uid.slice(0, 8)}_${Date.now()}`;
            sessionIsNewRef.current = true;
        }
        const sessionId = currentSessionRef.current;
        try {
            const isNew = sessionIsNewRef.current;
            sessionIsNewRef.current = false;
            const synced = await vidyaApiFetch("/api/vidya/session", {
                method: "POST",
                body: JSON.stringify({ sessionId, messages: chatHistory, isNew, screenPath: pathname }),
            });
            if (!synced?.ok) throw new Error("sync failed");
            const res = await vidyaApiFetch("/api/vidya/session", {
                method: "PATCH",
                body: JSON.stringify({ sessionId, saved: true }),
            });
            if (!res?.ok) throw new Error("save failed");
            toast({ title: t("Conversation saved"), description: t("My Library") });
        } catch {
            toast({ title: t("Something went wrong"), description: t("Please try again."), variant: "destructive" });
        }
    }, [user, chatHistory, pathname, toast, t]);

    // ── Sync a teacher profile patch to Firestore (fire-and-forget) ──────
    const syncProfilePatch = useCallback(
        (patch: Record<string, string>) => {
            if (!user) return;
            vidyaApiFetch("/api/vidya/profile", {
                method: "POST",
                body: JSON.stringify({ profile: patch }),
            }).catch(console.warn);
        },
        [user],
    );

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!orbRef.current) return;
        (e.target as Element).setPointerCapture(e.pointerId);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        initialOrbPos.current = { ...orbPos };
        setIsDragging(false);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!orbRef.current || !(e.target as Element).hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) setIsDragging(true);
        if (isDragging) setOrbPos({ x: initialOrbPos.current.x + dx, y: initialOrbPos.current.y + dy });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if ((e.target as Element).hasPointerCapture(e.pointerId)) {
            (e.target as Element).releasePointerCapture(e.pointerId);
        }
        setTimeout(() => setIsDragging(false), 50);
    };

    // Map voice-to-text 2-letter codes → BCP-47 codes accepted by the TTS API
    const LANG_TO_BCP47: Record<string, string> = {
        en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN',
        te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', gu: 'gu-IN',
        pa: 'pa-IN', mr: 'hi-IN', // Marathi shares Devanagari voice
        or: 'en-IN',              // No Odia TTS voice — fall back to English
    };

    const processTranscription = async (transcript: string, detectedLang?: string) => {
        if (!transcript) return;

        // ── Per-query reset (2026-05-19, NCERT demo fix) ──────────────────
        // Each mic press is a FRESH query. Three things to wipe so a prior
        // intent does not bleed in:
        //   1. `pendingActions` — compound-intent chips authored by the
        //      previous turn. Tapping a chip later is fine; carrying them
        //      silently into a NEW utterance is not.
        //   2. Stale `structuredData` — published by a page the user has
        //      since navigated away from. The navigation effect already
        //      calls `clearStructuredDataIfStale(pathname)`, but a
        //      lingering page-mount race could leave it set; clear again
        //      defensively here.
        //   3. Long-gap chat history — if the previous turn happened
        //      >5 minutes ago, or on a DIFFERENT screen, treat this
        //      utterance as a fresh conversation rather than a follow-up.
        //      Otherwise VIDYA's `SAHAYAK_SOUL_PROMPT` cross-turn context
        //      resolution rule (see `src/ai/soul.ts` line 121) inherits
        //      gradeLevel / subject / topic / intent from the prior query.
        setPendingActions([]);
        clearStructuredDataIfStale(pathname);

        const FRESH_QUERY_WINDOW_MS = 5 * 60 * 1000; // 5 min
        const storeSnapshot = useJarvisStore.getState();
        const sinceLastQuery = storeSnapshot.lastQueryAt
            ? Date.now() - storeSnapshot.lastQueryAt
            : Infinity;
        const samePageAsLast = storeSnapshot.lastQueryPath === pathname;
        const carryHistory = sinceLastQuery < FRESH_QUERY_WINDOW_MS && samePageAsLast;
        const effectiveChatHistory = carryHistory ? chatHistory : [];
        const effectiveStructuredData = storeSnapshot.structuredData;
        // Live application context: which screen this is, what it shows, and
        // which real actions it offers (see app-context-registry). Snapshot
        // at request time; the fingerprint guards against acting on a screen
        // that changed while VIDYA was thinking.
        const appContext = buildVidyaAppContext(pathname);

        // eslint-disable-next-line no-console
        console.info('[OmniOrb] new query — staging cleared', {
            path: pathname,
            transcript: transcript.slice(0, 80),
            chatHistoryCarried: carryHistory,
            sinceLastQueryMs: sinceLastQuery === Infinity ? null : sinceLastQuery,
            lastQueryPath: storeSnapshot.lastQueryPath,
            structuredDataKeys: Object.keys(effectiveStructuredData ?? {}),
        });

        // Start a new Firestore session on the very first message of a conversation
        // OR when the previous query was stale (>5 min gap / different screen).
        // Mirroring the carry-history rule keeps session boundaries aligned
        // with intent boundaries — a fresh classifier scope gets a fresh
        // Firestore doc too, so analytics aren't muddled by mixed intents.
        const startingFreshSession = !carryHistory || chatHistory.length === 0;
        if (startingFreshSession && user) {
            currentSessionRef.current = `sess_${user.uid.slice(0, 8)}_${Date.now()}`;
            sessionIsNewRef.current = true;
        }

        addMessage("user", transcript);
        setOrbOpen(false);
        setProactiveTip(null); // dismiss proactive tip on first interaction

        // Determine TTS language: detected speech lang > profile preference > en-IN fallback
        const profileLang = teacherProfile.preferredLanguage;
        const bcp47Lang = (detectedLang && LANG_TO_BCP47[detectedLang])
            ?? (profileLang && LANG_TO_BCP47[profileLang])
            ?? 'en-IN';

        try {
            logger.info('POST /api/assistant', 'VIDYA OmniOrb', {
                transcriptLen: transcript.length,
                detectedLang: detectedLang ?? null,
                pathname,
                chatHistoryLen: chatHistory.length,
            });

            const res = await vidyaApiFetch("/api/assistant", {
                method: "POST",
                body: JSON.stringify({
                    message: transcript,
                    // Send a SCOPED history — empty on a fresh-intent query
                    // so VIDYA's cross-turn context resolution doesn't pull
                    // gradeLevel / subject / topic from a prior query.
                    chatHistory: effectiveChatHistory,
                    // Pass live form fields so VIDYA can "see" the screen —
                    // but only when they belong to the current page (the
                    // store's `clearStructuredDataIfStale` already wiped
                    // mismatched payloads on navigation; this is read-back).
                    currentScreenContext: { path: pathname, uiState: effectiveStructuredData, app: appContext },
                    // Pass long-term teacher profile for personalised context
                    teacherProfile,
                    // Pass detected speech language so VIDYA responds in the same language
                    detectedLanguage: detectedLang ?? null,
                    // 2026-12 STT fix: also send the teacher's EXPLICIT UI
                    // language. The server prefers this over detectedLanguage
                    // so a Bengali-UI teacher gets a Bengali answer even if
                    // STT misclassified the utterance script.
                    uiLanguage: LANGUAGE_TO_ISO[uiLanguage] ?? null,
                }),
            });

            if (!res) throw new Error("Not authenticated — please sign in to use VIDYA");
            if (!res.ok) {
                // Read the body so the toast surfaces the actual server error
                // (auth failure, plan-limit, sidecar exhaustion, …) instead of
                // the generic "Assistant failed" string the user saw before.
                let serverMsg = `HTTP ${res.status}`;
                try {
                    const errBody = await res.json();
                    if (errBody?.error) serverMsg = String(errBody.error);
                } catch { /* body wasn't JSON */ }
                throw new Error(serverMsg);
            }

            // Parse JSON in its own try so a malformed body surfaces a
            // distinct error rather than getting confused with a network
            // failure in the outer catch.
            let payload: { response?: string; action?: VidyaAction | null; plannedActions?: VidyaAction[]; appAction?: unknown };
            try {
                payload = await res.json();
            } catch (parseErr) {
                // eslint-disable-next-line no-console
                console.error('[VIDYA OmniOrb] response JSON parse failed', parseErr);
                throw new Error('Assistant returned malformed response');
            }
            const { response, action, plannedActions } = payload;
            logger.info('/api/assistant response', 'VIDYA OmniOrb', {
                hasResponse: Boolean(response),
                responseLen: (response ?? '').length,
                actionType: action?.type ?? null,
                actionFlow: (action as { flow?: string } | null)?.flow ?? null,
                plannedCount: plannedActions?.length ?? 0,
            });

            if (response) {
                // Apply greeting suppressor when the user is mid-conversation
                // (effectiveChatHistory already has at least one model turn).
                // First-turn replies keep their warm opener.
                const prevHadModelTurn = effectiveChatHistory.some(
                    (m) => m.role === 'model',
                );
                const finalResponse = greetingSuppressorEnabled
                    ? stripRedundantGreeting(response, { prevHadModelTurn })
                    : response;
                addMessage("model", finalResponse);
                tts.speak(finalResponse, bcp47Lang);
            } else {
                // Empty response WITH no action is the silent-failure mode
                // we hit on demo day before. Surface it so the teacher
                // doesn't think the mic ate their request.
                // eslint-disable-next-line no-console
                console.warn('[VIDYA OmniOrb] empty response from assistant', { action, plannedActions });
                if (!action && !(plannedActions && plannedActions.length > 0)) {
                    toast({
                        title: t('VIDYA had nothing to say'),
                        description: t('Try rephrasing your question.'),
                        variant: 'default',
                    });
                }
            }

            // ── Mark this query completed so the next mic press can decide
            //    whether to carry chat history (same screen + <5 min) or
            //    treat itself as a fresh intent. Must be called AFTER the
            //    response lands so a thrown error during the fetch above
            //    does not stamp `lastQueryAt` for a query that never made
            //    it to the model.
            markQueryCompleted(pathname);

            // Build the message list for Firestore sync.
            // chatHistory in this closure reflects state BEFORE the addMessage()
            // calls above (Zustand state updates are batched to the next render),
            // so we build the updated list explicitly here.
            // CRITICAL: when this was a fresh-intent query (cross-page or
            // long gap), the Firestore session was just rotated above —
            // persist ONLY the current turn pair so analytics / replay see
            // a session boundary that matches the classifier scope rather
            // than smuggling the prior (unrelated) turns into a fresh doc.
            const updatedMessages = startingFreshSession
                ? [
                    { role: "user" as const, parts: [{ text: transcript }] },
                    { role: "model" as const, parts: [{ text: response ?? "" }] },
                ]
                : [
                    ...chatHistory,
                    { role: "user" as const, parts: [{ text: transcript }] },
                    { role: "model" as const, parts: [{ text: response ?? "" }] },
                ];

            // P5 — compound intent: 2-3 actions render as confirm-chips so
            // the teacher taps each explicitly. Single action keeps the
            // legacy auto-navigate behaviour to avoid extra-tap regression
            // for the 90% one-flow case.
            //
            // Demo-day hardening: also drop actions whose `flow` isn't in
            // the KNOWN_FLOWS set. A hallucinated flow (e.g. "lessonplan"
            // or "quiz") routes to a 404 on this client and the teacher
            // sees nothing happen — same symptom as the original silent
            // failure. Toast the model's bad output so the demo audience
            // sees we're catching it, not silently dropping it.
            const allActions = (plannedActions ?? []).filter(
                (a) => a && a.type === "NAVIGATE_AND_FILL",
            );
            const validActions = allActions.filter((a) => KNOWN_FLOWS.has(a.flow));
            if (allActions.length !== validActions.length) {
                const droppedFlows = allActions
                    .filter((a) => !KNOWN_FLOWS.has(a.flow))
                    .map((a) => a.flow);
                // eslint-disable-next-line no-console
                console.error('[VIDYA OmniOrb] dropping unknown flow(s)', droppedFlows);
            }
            const isCompound = validActions.length > 1;

            if (isCompound) {
                // Persist the conversation + the planned-action list (no flow
                // dispatched yet — teacher will tap individually). Auto-open
                // the panel so the chips are visible immediately; the panel
                // was closed at processTranscription start to keep the orb
                // unobtrusive.
                syncSessionTurn(updatedMessages, null);
                setPendingActions(validActions);
                setOrbOpen(true);
            } else if (action && action.type === "NAVIGATE_AND_FILL" && KNOWN_FLOWS.has(action.flow)) {
                executeAction(action, updatedMessages, transcript);
            } else if (validActions.length === 1) {
                // Sidecar/Genkit emitted a single valid planned action but the
                // top-level `action` was missing/unknown. Auto-execute it.
                // This closes the gap between `action` and `plannedActions[0]`
                // when the dispatcher's backward-compat assignment misfires.
                executeAction(validActions[0], updatedMessages, transcript);
            } else if (action && action.type === "NAVIGATE_AND_FILL" && !KNOWN_FLOWS.has(action.flow)) {
                // Model hallucinated a flow we don't have a page for.
                // Don't navigate (would 404); tell the teacher.
                // eslint-disable-next-line no-console
                console.error('[VIDYA OmniOrb] action with unknown flow', action.flow);
                toast({
                    title: t('VIDYA picked a tool I do not recognise'),
                    description: `Flow "${action.flow}" is not available. Please rephrase your request.`,
                    variant: 'destructive',
                });
                syncSessionTurn(updatedMessages, null);
                setPendingActions([]);
            } else {
                // Conversational turn. May carry an in-app action (navigate /
                // invoke a real on-screen action) — re-validated here against
                // what this screen offered, then run through the app's own
                // handler. Plain answers persist without action metadata.
                const appAction = validateAppAction(payload.appAction, appContext);
                const appActionRecord = !appAction ? null
                    : appAction.type === 'NAVIGATE'
                        ? { flow: `app:${appAction.destination}`, params: {} }
                        : { flow: `app:${appAction.capability}`, params: appAction.params ?? {} };
                syncSessionTurn(updatedMessages, appActionRecord);
                setPendingActions([]);
                if (appAction) executeAppAction(appAction, appContext.fingerprint, response ?? '');
            }
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            // eslint-disable-next-line no-console
            console.error('[VIDYA OmniOrb] processTranscription failed', e);
            tts.speak("I'm sorry, I encountered an issue connecting to my network. Please try again.", bcp47Lang);
            // User-visible toast — the previous silent-failure mode meant
            // founders saw "voice captured, nothing happens" and could not
            // diagnose live. Now the teacher sees the actual reason on
            // demo day instead of just hearing an apology.
            toast({
                title: t('VIDYA could not act on that'),
                description: errMsg.slice(0, 200),
                variant: 'destructive',
            });
        }
    };

    // Single action dispatcher — extracted from the legacy single-action
    // path so chip taps reuse the same code path. Behaviour-equivalent
    // to the previous inline block.
    const executeAction = useCallback((
        action: VidyaAction,
        updatedMessages: { role: "user" | "model"; parts: { text: string }[] }[],
        // The original transcript triggers fall-back-to-last-user-message
        // when params lack topic. Optional: chip taps replay the same
        // logic from the existing chatHistory closure.
        _originalTranscript?: string,
    ) => {
        // Learn teacher preferences from agentic actions.
        //
        // LANGUAGE POISONING GUARD (2026-05-19): NEVER persist `language`
        // here. A voice utterance like "lesson plan for grade 7 science"
        // gets a `language` param from VIDYA's intent classifier (often
        // derived from the *speech* language detector, not an explicit
        // teacher preference). Writing that into the long-term profile
        // silently flipped subsequent generations to Hindi even when the
        // form dropdown showed English — the leak that hit the NCERT demo.
        //
        // Persistent language preference is set EXPLICITLY at onboarding
        // and Settings only. Action params still flow to the destination
        // form via the URL (see queryParams below), so the one-off intent
        // is honoured without poisoning the profile.
        const profilePatch: Record<string, string> = {};
        if (action.params?.gradeLevel) {
            updateTeacherProfile({ preferredGrade: action.params.gradeLevel });
            profilePatch.preferredGrade = action.params.gradeLevel;
        }
        if (action.params?.subject) {
            updateTeacherProfile({ preferredSubject: action.params.subject });
            profilePatch.preferredSubject = action.params.subject;
        }
        // INTENTIONALLY OMITTED: action.params.language → profile write.
        // Honour as a session-level hint only (URL param below).
        if (Object.keys(profilePatch).length > 0) syncProfilePatch(profilePatch);

        // Persist session turn with the triggered action
        syncSessionTurn(updatedMessages, { flow: action.flow, params: action.params });

        // If VIDYA couldn't extract a topic (vague follow-up like "those locations"),
        // fall back to the last user message from chatHistory as context.
        // Cast to writable shape for the local fallback patch — `params` is
        // bound to the supervisor's emitted object, so editing it here only
        // affects the route hand-off below, not the persisted record above.
        const params = action.params as Record<string, string | undefined | null>;
        if (!params.topic && !params.question && !params.prompt) {
            const lastUserMsg = [...chatHistory].reverse().find(m => m.role === "user");
            if (lastUserMsg) {
                params.topic = lastUserMsg.parts.map((p: { text: string }) => p.text).join("").trim();
            }
        }

        // Normalise language to an ISO-2 code BEFORE it lands in the URL.
        // The destination forms (lesson-plan, quiz-generator, …) drive
        // <LanguageSelector> with ISO values ("en", "hi"). VIDYA's
        // supervisor sometimes emits the display name ("English") which
        // the selector then rejects and falls back to the default — that
        // is the second half of the "form shows English, output Hindi"
        // bug. Shared with the destination forms via
        // `@/lib/vidya-action-normalizer` so both ends agree.
        const queryParams = new URLSearchParams();
        if (params.topic) queryParams.set("topic", params.topic);
        if (params.question) queryParams.set("question", params.question);
        if (params.assignmentDescription) queryParams.set("assignmentDescription", params.assignmentDescription);
        if (params.prompt) queryParams.set("prompt", params.prompt);
        if (params.subject) queryParams.set("subject", params.subject);
        if (params.gradeLevel) queryParams.set("gradeLevel", params.gradeLevel);
        const normalisedLang = normaliseVidyaLanguage(params.language);
        if (normalisedLang) queryParams.set("language", normalisedLang);

        const targetUrl = `/${action.flow}?${queryParams.toString()}`;
        logger.info('navigating to', 'VIDYA OmniOrb', { targetUrl });

        // ── Make the navigation VISIBLE ──────────────────────────────────
        // Without this, the orb panel stays mounted on top of the
        // destination page and the teacher sees only the chat bubble
        // saying "Generating now!" while the screen appears unchanged.
        const flowLabel = FLOW_LABEL[action.flow] ?? action.flow.replace(/-/g, ' ');
        const contextBits = [params.gradeLevel, params.subject, params.topic]
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
            .join(' · ');
        toast({
            title: `Opening ${flowLabel}`,
            description: contextBits || undefined,
        });
        setOrbOpen(false);

        // ── Same-URL repeat handling ─────────────────────────────────────
        // router.push to the SAME path+query is a no-op. When the teacher
        // re-asks an identical request (signal they didn't see the result),
        // router.refresh() forces a re-mount.
        const currentUrlWithQuery = pathname + (typeof window !== 'undefined' ? window.location.search : '');
        if (targetUrl === currentUrlWithQuery) {
            router.refresh();
        }
        router.push(targetUrl);
    }, [chatHistory, router, pathname, toast, updateTeacherProfile, syncProfilePatch, syncSessionTurn]);

    // ── In-app actions (navigate / invoke a real on-screen action) ───────
    // VIDYA only REQUESTS; `runAppAction` decides against the live screen
    // (manifest routes only; registered + enabled handlers only; screen
    // unchanged since the request; data-saving actions need Confirm). This
    // callback only supplies the UI: router, toasts, confirm button.
    const executeAppAction = useCallback((
        appAction: VidyaAppAction,
        requestFingerprint: string,
        spokenResponse: string,
    ) => {
        const outcome = runAppAction(appAction, requestFingerprint, {
            livePath: () => window.location.pathname,
            navigate: (section) => {
                toast({ title: t(section.label) });
                setOrbOpen(false);
                router.push(section.route);
            },
            requestConfirmation: (proceed) => toast({
                title: t('Confirm'),
                description: spokenResponse.slice(0, 200) || undefined,
                action: (
                    <ToastAction altText={t('Confirm')} onClick={proceed}>
                        {t('Confirm')}
                    </ToastAction>
                ),
            }),
            onRefused: (reason) => {
                logger.warn('app action refused', 'VIDYA OmniOrb', { appAction, reason });
                toast({ title: t('Something went wrong'), description: t('Please try again.'), variant: 'destructive' });
            },
        });
        logger.info('app action', 'VIDYA OmniOrb', { appAction, outcome });
    }, [router, t, toast]);

    // ── Hands-free live voice (ADK) wiring ───────────────────────────────
    const buildLiveSessionInput = useCallback(() => {
        const iso = LANGUAGE_TO_ISO[uiLanguage] ?? teacherProfile.preferredLanguage ?? "en";
        const clamp = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : undefined);
        return {
            startSessionBody: {
                teacherProfile: teacherProfile as unknown as Record<string, unknown>,
                currentScreenContext: { path: pathname || "/", uiState: structuredData ?? undefined },
                detectedLanguage: iso,
            },
            setup: {
                grade: clamp(teacherProfile.preferredGrade, 50),
                subject: clamp(teacherProfile.preferredSubject, 100),
                schoolContext: clamp(teacherProfile.schoolContext, 2000),
                language: clamp(iso, 10),
                screenPath: clamp(pathname || "/", 500),
            },
        };
    }, [uiLanguage, teacherProfile, pathname, structuredData]);

    const onLiveToolCall = useCallback((call: VidyaLiveToolCall) => {
        // App navigation / on-screen actions: the SAME validated path text
        // VIDYA uses (manifest routes only; only actions this screen offers;
        // stale-screen refusal; Confirm before anything is saved).
        if (LIVE_APP_TOOL_NAMES.has(call.name)) {
            const request = liveToolCallToAppAction(call, window.location.pathname);
            if (!request) {
                logger.warn('live app tool refused (not offered on this screen)', 'VIDYA OmniOrb', { name: call.name });
                toast({ title: t('Something went wrong'), description: t('Please try again.'), variant: 'destructive' });
                return;
            }
            const { action: appAction } = request;
            syncSessionTurn(chatHistory, appAction.type === 'NAVIGATE'
                ? { flow: `app:${appAction.destination}`, params: {} }
                : { flow: `app:${appAction.capability}`, params: appAction.params ?? {} });
            executeAppAction(appAction, request.fingerprint, request.description);
            return;
        }
        const action = liveToolToAction(call);
        if (!action) {
            logger.warn('live voice tool call ignored', 'VIDYA OmniOrb', { name: call.name });
            return;
        }
        // Voice session stays open across the navigation: OmniOrb lives in the
        // app shell, which persists over client-side route changes.
        executeAction(action, chatHistory);
    }, [executeAction, executeAppAction, syncSessionTurn, chatHistory, toast, t]);

    // Hand the guarded executor + teacher context to the app-wide live session
    // (VidyaLiveProvider) so the central home VIDYA and the compact tool-page
    // VIDYA both act through exactly this code path.
    const liveSession = useVidyaLiveSession();
    const registerToolHandler = liveSession?.registerToolHandler;
    const registerInputBuilder = liveSession?.registerInputBuilder;
    useEffect(() => {
        if (!LIVE_VOICE_ENABLED || !registerToolHandler || !registerInputBuilder) return;
        registerToolHandler(onLiveToolCall);
        registerInputBuilder(buildLiveSessionInput);
    }, [registerToolHandler, registerInputBuilder, onLiveToolCall, buildLiveSessionInput]);
    useEffect(() => () => {
        registerToolHandler?.(null);
        registerInputBuilder?.(null);
    }, [registerToolHandler, registerInputBuilder]);

    // Keep the live session's app context fresh — the same screen snapshot
    // text VIDYA sends per request — on every route change and whenever a
    // screen publishes state or (un)registers an action. Debounced; it is
    // stored by the sidecar for `get_app_context`, never spoken as a turn.
    // An enhancement only: any failure here leaves voice untouched.
    const setLiveAppContext = liveSession?.setAppContext;
    useEffect(() => {
        if (!LIVE_VOICE_ENABLED || !setLiveAppContext) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const push = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                try {
                    setLiveAppContext(buildLiveAppContextFrame(window.location.pathname) as unknown as Record<string, unknown>);
                } catch (err) {
                    logger.warn('live app context push failed', 'VIDYA OmniOrb', { err: String(err) });
                }
            }, 250);
        };
        push();
        const unsubscribe = subscribeVidyaAppContext(push);
        return () => {
            if (timer) clearTimeout(timer);
            unsubscribe();
        };
    }, [setLiveAppContext, pathname]);

    // Chip tap handler — pops the action from pendingActions and dispatches.
    // Chips render one-shot so consecutive taps cleanly chain navigations.
    const onChipTap = useCallback((action: VidyaAction) => {
        const updatedMessages = [...chatHistory];
        executeAction(action, updatedMessages);
        setPendingActions(prev => prev.filter(a => a !== action));
    }, [chatHistory, executeAction]);

    if (!isClient) return null;

    // ── Exclude Orb from specific pages ─────────────────────────────────
    const excludedPages = ["/onboarding", "/"];
    if (excludedPages.includes(pathname)) return null;

    // 2026-04-26: hide when the page-mounted VoiceAssistant chat dialog
    // is open. Prevents two simultaneous voice surfaces (UX bug).
    if (voiceDialogOpen) return null;

    return (
        <div
            ref={orbRef}
            className={`fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] right-4 sm:bottom-12 sm:right-12 z-[90] ${
                reducedMotion ? "" : "transition-[transform,opacity] duration-300"
            } ${
                hiddenByScroll && !orbOpen && !isDragging
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100"
            }`}
            style={{
                transform: `translate(${orbPos.x}px, ${
                    orbPos.y + (hiddenByScroll && !orbOpen && !isDragging ? 120 : 0)
                }px)`,
            }}
        >
            {/* Explicit Memory Drawer */}
            {orbOpen && (
                <div className="absolute bottom-24 right-0 w-[calc(100vw-2rem)] max-w-xs sm:w-80 bg-card text-card-foreground rounded-3xl shadow-2xl border border-border p-4 animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="font-bold flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-primary" />
                            {t("VIDYA Memory")}
                        </h3>
                        <div className="flex items-center gap-1">
                        {/* Explicit bookmark: the ONLY way a conversation appears
                            under My Library → Conversations. It stays in the
                            session store; it never becomes a Generations artifact. */}
                        {user && chatHistory.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                onClick={saveCurrentConversation}
                                title={t("Save conversation")}
                                aria-label={t("Save conversation")}
                            >
                                <Bookmark className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                                resetContext();
                                // Reset session so the next message starts a fresh Firestore doc
                                currentSessionRef.current = null;
                                sessionIsNewRef.current = true;
                                // Drop any unconsumed compound-intent chips
                                setPendingActions([]);
                                setOrbOpen(false);
                            }}
                            title={t("Clear Context")}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                    </div>

                    {/* Teacher profile summary */}
                    {(teacherProfile.preferredGrade || teacherProfile.preferredSubject) && (
                        <div className="mb-3 p-2 bg-primary/5 rounded-xl text-xs text-primary border border-primary/10">
                            <span className="font-semibold">{t("Your profile:")} </span>
                            {[teacherProfile.preferredGrade, teacherProfile.preferredSubject, teacherProfile.schoolContext]
                                .filter(Boolean).join(" · ")}
                            {user && (
                                <Cloud
                                    className="ml-1 inline-block h-3 w-3 opacity-60 align-middle"
                                    aria-label={t("Synced to cloud")}
                                />
                            )}
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto flex flex-col gap-3 text-sm">
                        {chatHistory.length === 0 ? (
                            <p className="text-muted-foreground italic text-center py-4">{t("Memory is clear. I have no context of prior conversations.")}</p>
                        ) : (
                            chatHistory.map((msg, i) => (
                                <div key={i} className={"p-3 rounded-2xl " + (msg.role === "user" ? "bg-muted self-end ml-4" : "bg-primary/10 self-start mr-4")}>
                                    {msg.parts.map((p) => p.text).join("")}
                                </div>
                            ))
                        )}
                    </div>

                    {/* P5 — compound-intent chips. Render only when the
                        supervisor authored 2+ planned actions for the last
                        turn. Tapping a chip dispatches just that flow and
                        removes the chip; the others stay until taken or
                        dismissed by another conversational turn. */}
                    {pendingActions.length > 1 && (
                        <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                                {t("Pick what to generate next:")}
                            </p>
                            <div className="flex flex-wrap gap-2" data-testid="planned-action-chips">
                                {pendingActions.map((a, idx) => (
                                    <button
                                        key={`${a.flow}-${idx}`}
                                        type="button"
                                        onClick={() => onChipTap(a)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium border border-primary/20 transition-colors"
                                        data-testid={`planned-action-chip-${a.flow}`}
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        {FLOW_LABEL[a.flow] ?? a.flow}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* The Draggable Orb */}
            <div
                className="relative group cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                {/* Proactive daily-inspiration tip */}
                {proactiveTip && (
                    <div
                        className="absolute bottom-20 right-0 w-[calc(100vw-2rem)] max-w-[18rem] sm:w-72 bg-card border border-primary/20 rounded-2xl shadow-xl p-3 text-xs text-foreground animate-in fade-in slide-in-from-bottom-4 pointer-events-none"
                    >
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>{proactiveTip}</span>
                        </div>
                    </div>
                )}

                {chatHistory.length > 0 && (
                    <>
                        {/* NCERT demo polish (2026-05-19): simplified the
                            previous triple-animation stack (animate-ping +
                            animate-pulse + animate-bounce) to a single ring
                            and a static tooltip. Three concurrent infinite
                            animations were ~12ms of per-frame compositing
                            on low-end Android, contributing to the founder's
                            "lagging" report. Reduced-motion users see no
                            ring at all. */}
                        {!reducedMotion && (
                            <div
                                className="absolute -inset-2 rounded-full bg-primary/25 animate-pulse pointer-events-none"
                                style={{ animationDuration: "2.4s" }}
                            />
                        )}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-primary bg-card px-3 py-1.5 rounded-full shadow-md pointer-events-none border border-primary/20 flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" />
                            {t("Tap to reply")}
                        </div>
                    </>
                )}

                <div className="relative z-10 pointer-events-auto">
                    {LIVE_VOICE_ENABLED ? (
                        // Home ("/") shows VIDYA large and central in the
                        // workspace itself; everywhere else the SAME session
                        // is shown as a compact presence. Never two mics.
                        pathname !== "/" ? <VidyaLiveOrb /> : null
                    ) : (
                        <MicrophoneInput
                            onTranscriptChange={processTranscription}
                            isFloating={true}
                            iconSize="lg"
                            className="shadow-2xl transition-transform hover:scale-105"
                        />
                    )}
                </div>

                {/* Toggle Memory Button */}
                <Button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDragging) setOrbOpen(!orbOpen);
                    }}
                    className="absolute -top-4 -left-4 h-10 w-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-card text-primary hover:bg-muted border pointer-events-auto"
                    size="icon"
                    title={t("View Memory")}
                >
                    <BrainCircuit className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
