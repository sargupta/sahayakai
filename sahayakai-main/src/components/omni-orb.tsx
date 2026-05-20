"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useJarvisStore } from "@/store/jarvisStore";
import { useAuth } from "@/context/auth-context";
import { auth } from "@/lib/firebase";
import { MicrophoneInput } from "@/components/microphone-input";
import { Button } from "@/components/ui/button";
import { Trash2, BrainCircuit, Sparkles, Cloud } from "lucide-react";
import { tts } from "@/lib/tts";
import { useToast } from "@/hooks/use-toast";
import type { VidyaAction } from "@/lib/sidecar/types.generated";
import { normaliseVidyaLanguage } from "@/lib/vidya-action-normalizer";

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
    const { user } = useAuth();
    const { toast } = useToast();
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

    // ── Auto-hide on scroll-down, restore on scroll-up ───────────────────
    // Audited in outputs/ux_review_2026_04_21/FLOATING_CHROME_AUDIT.md §6.
    // Near-top always shows. A 24 px delta absorbs trackpad micro-scroll
    // and iOS rubber-band; anything further triggers the transition.
    useEffect(() => {
        if (!isClient) return;
        let lastY = window.scrollY;
        let ticking = false;
        const NEAR_TOP = 120;
        const DELTA = 24;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const y = window.scrollY;
                const delta = y - lastY;
                if (y < NEAR_TOP) {
                    setHiddenByScroll(false);
                } else if (delta > DELTA) {
                    setHiddenByScroll(true);
                } else if (delta < -DELTA) {
                    setHiddenByScroll(false);
                }
                lastY = y;
                ticking = false;
            });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [isClient]);

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
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        const context = [preferredGrade, preferredSubject].filter(Boolean).join(" · ");
        const tip = `${greeting}! Ready to prep your ${context} class? Just ask me to generate anything.`;

        setProactiveTip(tip);
        proactiveShown.current = true;
    }, [isClient, chatHistory.length, teacherProfile]);

    // ── Firestore restore on login ────────────────────────────────────────
    // When the user signs in, pull their teacher profile and latest conversation
    // from Firestore. This enables cross-device memory — a teacher who logs in
    // on a different device gets their context back immediately.
    useEffect(() => {
        if (!user) return;

        // 1. Restore teacher profile (Firestore wins if more recent than local)
        vidyaApiFetch("/api/vidya/profile")
            .then((res) => res?.json())
            .then((data) => {
                if (data?.profile) mergeTeacherProfile(data.profile);
            })
            .catch(console.warn);

        // 2. Restore latest conversation (only if store is empty — no override)
        if (chatHistory.length === 0) {
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
    }, [user?.uid]);

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
            // eslint-disable-next-line no-console
            console.log('[VIDYA OmniOrb] POST /api/assistant', {
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
                    currentScreenContext: { path: pathname, uiState: effectiveStructuredData },
                    // Pass long-term teacher profile for personalised context
                    teacherProfile,
                    // Pass detected speech language so VIDYA responds in the same language
                    detectedLanguage: detectedLang ?? null,
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
            let payload: { response?: string; action?: VidyaAction | null; plannedActions?: VidyaAction[] };
            try {
                payload = await res.json();
            } catch (parseErr) {
                // eslint-disable-next-line no-console
                console.error('[VIDYA OmniOrb] response JSON parse failed', parseErr);
                throw new Error('Assistant returned malformed response');
            }
            const { response, action, plannedActions } = payload;
            // eslint-disable-next-line no-console
            console.log('[VIDYA OmniOrb] /api/assistant response', {
                hasResponse: Boolean(response),
                responseLen: (response ?? '').length,
                actionType: action?.type ?? null,
                actionFlow: (action as { flow?: string } | null)?.flow ?? null,
                plannedCount: plannedActions?.length ?? 0,
            });

            if (response) {
                addMessage("model", response);
                tts.speak(response, bcp47Lang);
            } else {
                // Empty response WITH no action is the silent-failure mode
                // we hit on demo day before. Surface it so the teacher
                // doesn't think the mic ate their request.
                // eslint-disable-next-line no-console
                console.warn('[VIDYA OmniOrb] empty response from assistant', { action, plannedActions });
                if (!action && !(plannedActions && plannedActions.length > 0)) {
                    toast({
                        title: 'VIDYA had nothing to say',
                        description: 'Try rephrasing your question.',
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
                    title: 'VIDYA picked a tool I do not recognise',
                    description: `Flow "${action.flow}" is not available. Please rephrase your request.`,
                    variant: 'destructive',
                });
                syncSessionTurn(updatedMessages, null);
                setPendingActions([]);
            } else {
                // Conversational turn — persist without action metadata
                syncSessionTurn(updatedMessages, null);
                setPendingActions([]);
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
                title: 'VIDYA could not act on that',
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
        // eslint-disable-next-line no-console
        console.log('[VIDYA OmniOrb] navigating to', targetUrl);
        router.push(targetUrl);
    }, [chatHistory, router, updateTeacherProfile, syncProfilePatch, syncSessionTurn]);

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
                <div className="absolute bottom-24 right-0 w-[calc(100vw-2rem)] max-w-xs sm:w-80 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 p-4 animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="font-bold flex items-center gap-2">
                            <BrainCircuit className="h-5 w-5 text-primary" />
                            VIDYA Memory
                        </h3>
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
                            title="Clear Context"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Teacher profile summary */}
                    {(teacherProfile.preferredGrade || teacherProfile.preferredSubject) && (
                        <div className="mb-3 p-2 bg-primary/5 rounded-xl text-xs text-primary border border-primary/10">
                            <span className="font-semibold">Your profile: </span>
                            {[teacherProfile.preferredGrade, teacherProfile.preferredSubject, teacherProfile.schoolContext]
                                .filter(Boolean).join(" · ")}
                            {user && (
                                <Cloud
                                    className="ml-1 inline-block h-3 w-3 opacity-60 align-middle"
                                    aria-label="Synced to cloud"
                                />
                            )}
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto flex flex-col gap-3 text-sm">
                        {chatHistory.length === 0 ? (
                            <p className="text-slate-500 italic text-center py-4">Memory is clear. I have no context of prior conversations.</p>
                        ) : (
                            chatHistory.map((msg, i) => (
                                <div key={i} className={"p-3 rounded-2xl " + (msg.role === "user" ? "bg-slate-100 self-end ml-4" : "bg-primary/10 self-start mr-4")}>
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
                                Pick what to generate next:
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
                        className="absolute bottom-20 right-0 w-[calc(100vw-2rem)] max-w-[18rem] sm:w-72 bg-white border border-primary/20 rounded-2xl shadow-xl p-3 text-xs text-slate-700 animate-in fade-in slide-in-from-bottom-4 pointer-events-none"
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
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-primary bg-white px-3 py-1.5 rounded-full shadow-md pointer-events-none border border-primary/20 flex items-center gap-1">
                            <BrainCircuit className="h-3 w-3" />
                            Tap to reply
                        </div>
                    </>
                )}

                <div className="relative z-10 pointer-events-auto">
                    <MicrophoneInput
                        onTranscriptChange={processTranscription}
                        isFloating={true}
                        iconSize="lg"
                        className="shadow-2xl transition-transform hover:scale-105"
                    />
                </div>

                {/* Toggle Memory Button */}
                <Button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDragging) setOrbOpen(!orbOpen);
                    }}
                    className="absolute -top-4 -left-4 h-10 w-10 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity bg-white text-primary hover:bg-slate-100 border pointer-events-auto"
                    size="icon"
                    title="View Memory"
                >
                    <BrainCircuit className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
