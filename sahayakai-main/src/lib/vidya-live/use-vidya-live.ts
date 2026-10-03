"use client";

/**
 * React binding for ONE real VIDYA voice session (`VidyaLiveSession`:
 * browser mic → sidecar → Google ADK run_live → Vertex Gemini Live → speaker).
 *
 * Used directly by the public landing hero, and once — inside
 * `VidyaLiveProvider` — for the signed-in app shell so the session survives
 * route changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  VidyaLiveSession,
  type VidyaLiveOptions,
  type VidyaLiveState,
  type VidyaLiveToolCall,
  type VidyaLiveTranscript,
} from "./live-session";

export interface VidyaLiveCaption {
  role: "user" | "vidya";
  text: string;
}

export interface UseVidyaLiveArgs {
  scope: "teacher" | "public";
  getIdToken: () => Promise<string | null>;
  /** Read at start() time, so it always reflects the latest profile/screen. */
  buildSessionInput: () => Pick<VidyaLiveOptions, "startSessionBody" | "setup">;
  onToolCall?: (call: VidyaLiveToolCall) => void;
  /** Observers only (e.g. conversation history) — never affect the session. */
  onTranscript?: (tr: VidyaLiveTranscript) => void;
  onStateChange?: (state: VidyaLiveState) => void;
}

export interface VidyaLiveHandle {
  state: VidyaLiveState;
  /** Friendly, non-technical error text (or null). */
  error: string | null;
  caption: VidyaLiveCaption | null;
  /** True once VIDYA has answered at least once this session ("Go ahead."). */
  hasAnswered: boolean;
  active: boolean;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
  sendText: (text: string) => boolean;
  /** Latest app context for the sidecar `get_app_context` tool (kept across restarts). */
  setAppContext: (context: Record<string, unknown> | null) => void;
  /** 0–1: mic while listening, VIDYA's real output while speaking. */
  getLevel: () => number;
  dismissError: () => void;
}

const FRIENDLY: Record<string, string> = {
  mic_denied: "I need microphone access to hear you. Allow the microphone in your browser, then tap me again.",
  mic_unavailable: "I can't find a microphone on this device.",
  unavailable: "Voice isn't available right now. Please try again shortly.",
  unauthorized: "Please sign in again to talk to me.",
  session_limit: "I'm a little busy right now. Please try again in a moment.",
  idle_timeout: "I paused because it was quiet. Tap me whenever you're ready.",
};
const GENERIC = "I lost the connection. Tap me to start again.";

/** Observer callbacks must never be able to break the live session. */
function observe(fn: () => void): void {
  try {
    fn();
  } catch {
    /* ignore */
  }
}

export function useVidyaLive({ scope, getIdToken, buildSessionInput, onToolCall, onTranscript, onStateChange }: UseVidyaLiveArgs): VidyaLiveHandle {
  const [state, setState] = useState<VidyaLiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState<VidyaLiveCaption | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const sessionRef = useRef<VidyaLiveSession | null>(null);
  const toolRef = useRef(onToolCall);
  toolRef.current = onToolCall;
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;
  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;
  const inputRef = useRef(buildSessionInput);
  inputRef.current = buildSessionInput;
  const appContextRef = useRef<Record<string, unknown> | null>(null);
  const tokenRef = useRef(getIdToken);
  tokenRef.current = getIdToken;

  const active = state !== "idle" && state !== "ended" && state !== "error";

  const start = useCallback(async () => {
    if (sessionRef.current && !["idle", "ended", "error"].includes(sessionRef.current.currentState)) return;
    setError(null);
    setCaption(null);
    setHasAnswered(false);
    const session = new VidyaLiveSession({
      scope,
      getIdToken: () => tokenRef.current(),
      ...inputRef.current(),
      onState: (s) => {
        setState(s);
        observe(() => stateRef.current?.(s));
        if (s === "speaking") setHasAnswered(true);
      },
      onToolCall: (c) => toolRef.current?.(c),
      onTranscript: (tr) => {
        observe(() => transcriptRef.current?.(tr));
        setCaption((prev) =>
          prev && prev.role === tr.role && !tr.final ? { role: tr.role, text: prev.text + tr.text } : { role: tr.role, text: tr.text },
        );
      },
      onError: (code) => setError(FRIENDLY[code] ?? GENERIC),
    });
    sessionRef.current = session;
    session.setAppContext(appContextRef.current); // sent right after setup once the socket opens
    (window as unknown as { __vidyaLive?: VidyaLiveSession }).__vidyaLive = session;
    await session.start();
  }, [scope]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    setCaption(null);
  }, []);

  const toggle = useCallback(() => {
    const s = sessionRef.current?.currentState;
    if (s && !["idle", "ended", "error"].includes(s)) stop();
    else void start();
  }, [start, stop]);

  const sendText = useCallback((text: string) => sessionRef.current?.sendText(text) ?? false, []);

  const setAppContext = useCallback((context: Record<string, unknown> | null) => {
    appContextRef.current = context;
    sessionRef.current?.setAppContext(context);
  }, []);

  const getLevel = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return 0;
    return s.currentState === "speaking" ? s.outputLevel() : s.inputLevel();
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
    setState("idle");
  }, []);

  // Never leave the microphone open behind an unmounted VIDYA.
  useEffect(() => () => sessionRef.current?.stop(), []);

  return { state, error, caption, hasAnswered, active, start, stop, toggle, sendText, setAppContext, getLevel, dismissError };
}

/** Short, calm status copy shared by every VIDYA surface (keys go through t()). */
export function vidyaStatusKey(state: VidyaLiveState, hasAnswered: boolean): string {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "listening":
      return hasAnswered ? "Go ahead." : "I'm listening…";
    case "interrupted":
      return "Go ahead.";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking…";
    default:
      return "Talk to VIDYA";
  }
}
