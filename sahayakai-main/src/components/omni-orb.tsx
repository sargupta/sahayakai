"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useJarvisStore } from "@/store/jarvisStore";
import { useAuth } from "@/context/auth-context";
import { auth } from "@/lib/firebase";
import { MicrophoneInput } from "@/components/microphone-input";
import { Button } from "@/components/ui/button";
import { Trash2, BrainCircuit, Sparkles } from "lucide-react";
import { tts } from "@/lib/tts";

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
    const {
        chatHistory,
        addMessage,
        setScreenContext,
        resetContext,
        structuredData,
        teacherProfile,
        updateTeacherProfile,
        mergeTeacherProfile,
    } = useJarvisStore();

    const [orbPos, setOrbPos] = useState({ x: 0, y: 0 });
    const [isClient, setIsClient] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [orbOpen, setOrbOpen] = useState(false);
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
    useEffect(() => {
        setIsClient(true);
        // structuredData is read from store (set by individual pages) and passed
        // through as uiState so VIDYA can "see" active form fields.
        setScreenContext({ path: pathname, uiState: structuredData });
    }, [pathname, setScreenContext, structuredData]);

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

        // Start a new Firestore session on the very first message of a conversation
        if (chatHistory.length === 0 && user) {
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
            const res = await vidyaApiFetch("/api/assistant", {
                method: "POST",
                body: JSON.stringify({
                    message: transcript,
                    chatHistory,
                    // Pass live form fields so VIDYA can "see" the screen
                    currentScreenContext: { path: pathname, uiState: structuredData },
                    // Pass long-term teacher profile for personalised context
                    teacherProfile,
                    // Pass detected speech language so VIDYA responds in the same language
                    detectedLanguage: detectedLang ?? null,
                }),
            });

            if (!res) throw new Error("Not authenticated — please sign in to use VIDYA");
            if (!res.ok) throw new Error("Assistant failed to process request");

            const { response, action } = await res.json();

            if (response) {
                addMessage("model", response);
                tts.speak(response, bcp47Lang);
            }

            // Build the full updated message list for Firestore sync.
            // chatHistory in this closure reflects state BEFORE the addMessage()
            // calls above (Zustand state updates are batched to the next render),
            // so we build the updated list explicitly here.
            const updatedMessages = [
                ...chatHistory,
                { role: "user" as const, parts: [{ text: transcript }] },
                { role: "model" as const, parts: [{ text: response ?? "" }] },
            ];

            if (action && action.type === "NAVIGATE_AND_FILL") {
                // Learn teacher preferences from agentic actions
                const profilePatch: Record<string, string> = {};
                if (action.params?.gradeLevel) {
                    updateTeacherProfile({ preferredGrade: action.params.gradeLevel });
                    profilePatch.preferredGrade = action.params.gradeLevel;
                }
                if (action.params?.subject) {
                    updateTeacherProfile({ preferredSubject: action.params.subject });
                    profilePatch.preferredSubject = action.params.subject;
                }
                if (action.params?.language) {
                    updateTeacherProfile({ preferredLanguage: action.params.language });
                    profilePatch.preferredLanguage = action.params.language;
                }
                // Persist profile patch to Firestore (fire-and-forget)
                if (Object.keys(profilePatch).length > 0) syncProfilePatch(profilePatch);

                // Persist session turn with the triggered action
                syncSessionTurn(updatedMessages, { flow: action.flow, params: action.params });

                // If VIDYA couldn't extract a topic (vague follow-up like "those locations"),
                // fall back to the last user message from chatHistory as context.
                if (!action.params.topic && !action.params.question && !action.params.prompt) {
                    const lastUserMsg = [...chatHistory].reverse().find(m => m.role === "user");
                    if (lastUserMsg) {
                        action.params.topic = lastUserMsg.parts.map((p: { text: string }) => p.text).join("").trim();
                    }
                }

                const queryParams = new URLSearchParams();
                if (action.params.topic) queryParams.set("topic", action.params.topic);
                if (action.params.question) queryParams.set("question", action.params.question);
                if (action.params.assignmentDescription) queryParams.set("assignmentDescription", action.params.assignmentDescription);
                if (action.params.prompt) queryParams.set("prompt", action.params.prompt);
                if (action.params.subject) queryParams.set("subject", action.params.subject);
                if (action.params.gradeLevel) queryParams.set("gradeLevel", action.params.gradeLevel);
                if (action.params.language) queryParams.set("language", action.params.language);

                router.push(`/${action.flow}?${queryParams.toString()}`);
            } else {
                // Conversational turn — persist without action metadata
                syncSessionTurn(updatedMessages, null);
            }
        } catch (e) {
            tts.speak("I'm sorry, I encountered an issue connecting to my network. Please try again.", bcp47Lang);
        }
    };

    if (!isClient) return null;

    // ── Exclude Orb from specific pages ─────────────────────────────────
    const excludedPages = ["/onboarding", "/"];
    if (excludedPages.includes(pathname)) return null;

    return (
        <div
            ref={orbRef}
            className={`fixed bottom-4 right-4 sm:bottom-12 sm:right-12 z-[90] ${
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
                            {user && <span className="ml-1 opacity-60">(synced ☁️)</span>}
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
                        <div className="absolute -inset-3 rounded-full bg-primary/30 animate-ping pointer-events-none" style={{ animationDuration: "3s" }} />
                        <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse pointer-events-none" style={{ animationDuration: "2s" }} />
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-primary bg-white px-3 py-1.5 rounded-full shadow-md animate-bounce pointer-events-none border border-primary/20 flex items-center gap-1">
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
