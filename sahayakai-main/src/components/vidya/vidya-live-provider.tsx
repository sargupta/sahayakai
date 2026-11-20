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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useVidyaLive, type VidyaLiveHandle } from "@/lib/vidya-live/use-vidya-live";
import { createLiveConversationRecorder } from "@/lib/vidya-live/live-conversation";
import type { VidyaLiveOptions, VidyaLiveToolCall } from "@/lib/vidya-live/live-session";

type SessionInput = Pick<VidyaLiveOptions, "startSessionBody" | "setup">;

interface VidyaLiveContextValue extends VidyaLiveHandle {
  /**
   * True only when this build has Live VIDYA AND the server says this teacher may
   * use it (/api/vidya-voice/eligibility). Every VIDYA surface shows the hands-free
   * orb only when this is true, and the tap-to-talk VIDYA otherwise: a teacher
   * outside the Live cohort, or a deployment whose voice service is down, never
   * gets a voice orb that can only say "not available".
   */
  liveEnabled: boolean;
  registerToolHandler: (fn: ((call: VidyaLiveToolCall) => void) | null) => void;
  registerInputBuilder: (fn: (() => SessionInput) | null) => void;
}

const Ctx = createContext<VidyaLiveContextValue | null>(null);

/** This build includes Live VIDYA. Whether THIS teacher gets it is `liveEnabled` (server-decided). */
export const VIDYA_LIVE_VOICE_ENABLED = process.env.NEXT_PUBLIC_VIDYA_LIVE_VOICE === "1";

/** Asks the server whether the signed-in teacher may use Live VIDYA. Any failure means no. */
async function fetchLiveEligibility(getIdToken: () => Promise<string | null>): Promise<boolean> {
  try {
    const token = await getIdToken();
    if (!token) return false;
    const res = await fetch("/api/vidya-voice/eligibility", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { live?: unknown } | null;
    return body?.live === true;
  } catch {
    return false;
  }
}

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

  // Server-decided per teacher; false until the answer arrives, so nobody sees a
  // Live orb the server would refuse. Re-asked whenever the signed-in user changes.
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    if (!VIDYA_LIVE_VOICE_ENABLED) return;
    let current = 0;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const ask = ++current;
      if (!user) {
        setEligible(false);
        return;
      }
      void fetchLiveEligibility(getIdToken).then((ok) => {
        if (ask === current) setEligible(ok);
      });
    });
    return () => {
      current += 1;
      unsubscribe();
    };
  }, [getIdToken]);

  // If a session is refused anyway (voice service down, cohort changed), go back
  // to the tap-to-talk VIDYA for the rest of this page's life.
  const onErrorCode = useCallback((code: string) => {
    if (code === "unavailable") setEligible(false);
  }, []);

  const live = useVidyaLive({
    scope: "teacher",
    getIdToken,
    buildSessionInput: () => (inputRef.current ?? fallbackInput)(),
    onToolCall: (call) => toolRef.current?.(call),
    onTranscript: recorder.onTranscript,
    onStateChange: recorder.onState,
    onErrorCode,
  });

  const registerToolHandler = useCallback((fn: ((call: VidyaLiveToolCall) => void) | null) => {
    toolRef.current = fn;
  }, []);
  const registerInputBuilder = useCallback((fn: (() => SessionInput) | null) => {
    inputRef.current = fn;
  }, []);

  const liveEnabled = VIDYA_LIVE_VOICE_ENABLED && eligible;
  const value = useMemo(
    () => ({ ...live, liveEnabled, registerToolHandler, registerInputBuilder }),
    [live, liveEnabled, registerToolHandler, registerInputBuilder],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The app-wide VIDYA session, or null outside the signed-in app shell / when the flag is off. */
export function useVidyaLiveSession(): VidyaLiveContextValue | null {
  return useContext(Ctx);
}
