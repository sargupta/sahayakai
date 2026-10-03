"use client";

/**
 * One VIDYA voice session for the whole signed-in app.
 *
 * Mounted once in the app shell, ABOVE the routed page, so a conversation
 * started on the home workspace keeps running when VIDYA's tools navigate to
 * /lesson-plan etc. Every VIDYA surface (the central home presence, the
 * compact presence on tool pages) is a VIEW of this single session — there
 * is never a second microphone.
 *
 * The teacher context + guarded action executor live in OmniOrb (they already
 * power text VIDYA); OmniOrb registers them here so voice reuses exactly the
 * same `executeAction` path instead of duplicating business logic.
 */

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { auth } from "@/lib/firebase";
import { useVidyaLive, type VidyaLiveHandle } from "@/lib/vidya-live/use-vidya-live";
import { createLiveConversationRecorder } from "@/lib/vidya-live/live-conversation";
import type { VidyaLiveOptions, VidyaLiveToolCall } from "@/lib/vidya-live/live-session";

type SessionInput = Pick<VidyaLiveOptions, "startSessionBody" | "setup">;

interface VidyaLiveContextValue extends VidyaLiveHandle {
  registerToolHandler: (fn: ((call: VidyaLiveToolCall) => void) | null) => void;
  registerInputBuilder: (fn: (() => SessionInput) | null) => void;
}

const Ctx = createContext<VidyaLiveContextValue | null>(null);

export const VIDYA_LIVE_VOICE_ENABLED = process.env.NEXT_PUBLIC_VIDYA_LIVE_VOICE === "1";

function fallbackInput(): SessionInput {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  return {
    startSessionBody: { teacherProfile: {}, currentScreenContext: { path }, detectedLanguage: "en" },
    setup: { language: "en", screenPath: path },
  };
}

export function VidyaLiveProvider({ children }: { children: React.ReactNode }) {
  const toolRef = useRef<((call: VidyaLiveToolCall) => void) | null>(null);
  const inputRef = useRef<(() => SessionInput) | null>(null);

  const getIdToken = useCallback(async () => {
    try {
      return (await auth.currentUser?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }, []);

  // A Live talk is a normal VIDYA conversation: its transcript is retained in
  // My Library → Conversations (vidya_sessions), never as a Generation.
  const recorder = useMemo(
    () => createLiveConversationRecorder({
      getUid: () => auth.currentUser?.uid ?? null,
      getIdToken,
      getScreenPath: () => (typeof window !== "undefined" ? window.location.pathname : undefined),
    }),
    [getIdToken],
  );

  const live = useVidyaLive({
    scope: "teacher",
    getIdToken,
    buildSessionInput: () => (inputRef.current ?? fallbackInput)(),
    onToolCall: (call) => toolRef.current?.(call),
    onTranscript: recorder.onTranscript,
    onStateChange: recorder.onState,
  });

  const registerToolHandler = useCallback((fn: ((call: VidyaLiveToolCall) => void) | null) => {
    toolRef.current = fn;
  }, []);
  const registerInputBuilder = useCallback((fn: (() => SessionInput) | null) => {
    inputRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({ ...live, registerToolHandler, registerInputBuilder }),
    [live, registerToolHandler, registerInputBuilder],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The app-wide VIDYA session, or null outside the signed-in app shell / when the flag is off. */
export function useVidyaLiveSession(): VidyaLiveContextValue | null {
  return useContext(Ctx);
}
