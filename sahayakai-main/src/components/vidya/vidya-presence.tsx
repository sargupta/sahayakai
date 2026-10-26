"use client";

/**
 * VidyaPresence — THE visual identity of VIDYA, used everywhere she appears.
 *
 *   landing hero (public)      size="hero"
 *   teacher home (signed in)   size="workspace"
 *   tool pages                 size="compact"   (the persistent floating orb)
 *
 * Design (2026-10, from the SahayakAI website reference): a single warm,
 * product-native orb — one radial fill, one soft shadow, one state ring.
 * No orbital system, glow field, sheen or particles: colour and the ring
 * carry state, so every visual change MEANS something.
 *
 *   idle         warm saffron, rests (very slow float)
 *   connecting   indigo, slow breathe
 *   listening    saffron + ring that follows the teacher's REAL mic level
 *   interrupted  same as listening (the teacher is talking)
 *   thinking     indigo, slow breathe ("working")
 *   speaking     saffron + ring that follows VIDYA's REAL output level
 *   error        muted red ring, no motion
 *
 * Purely presentational: it receives the REAL voice-session state and level
 * readers from `VidyaLiveSession` (ADK / Gemini Live) and never talks to the
 * network itself. One rAF loop (paused off-screen / hidden tab) feeds the live
 * level into ONE CSS custom property — no React re-render per frame. Motion is
 * disabled under prefers-reduced-motion (globals.css).
 */

import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VidyaLiveState } from "@/lib/vidya-live/live-session";

/** Stage proportions kept from the previous design so page layouts (and the
 *  landing page's positioned decorations) do not shift. */
const VB_W = 520;
const VB_H = 340;

type VisualState = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error";

/** Session state → look. Kept exported for the status pills / tests. */
export function toVisualState(s: VidyaLiveState): VisualState {
  switch (s) {
    case "listening":
    case "interrupted":
      return "listening";
    case "connecting":
      return "connecting";
    case "thinking":
      return "processing";
    case "speaking":
      return "speaking";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

export interface VidyaPresenceProps {
  state: VidyaLiveState;
  size?: "hero" | "workspace" | "compact";
  /** Called ~60×/s while listening/speaking; return 0–1. */
  getLevel?: () => number;
  onActivate: () => void;
  /** Accessible name for the orb button (it IS the control). */
  label: string;
  className?: string;
  /** Rendered absolutely around the stage (e.g. landing floating text). */
  decorations?: React.ReactNode;
}

export function VidyaPresence({
  state,
  size = "hero",
  getLevel,
  onActivate,
  label,
  className,
  decorations,
}: VidyaPresenceProps) {
  const visual = toVisualState(state);
  const compact = size === "compact";

  const stageRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<VisualState>(visual);
  visualRef.current = visual;
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;
  const levelRef = useRef(0);

  // Real mic / playback level → --vidya-level (0–1), eased. Only runs while
  // the stage is on screen and the tab is visible.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let raf = 0;
    let visible = true;

    const frame = () => {
      const v = visualRef.current;
      const raw = v === "listening" || v === "speaking" ? getLevelRef.current?.() ?? 0 : 0;
      const k = raw > levelRef.current ? 0.35 : 0.12; // quick attack, soft release
      levelRef.current += (raw - levelRef.current) * k;
      stage.style.setProperty("--vidya-level", levelRef.current.toFixed(3));
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(stage);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.style.setProperty("--vidya-level", "0");
    };
  }, []);

  const active = state !== "idle" && state !== "ended" && state !== "error";

  return (
    <div
      ref={stageRef}
      data-state={visual}
      data-live-state={state}
      data-size={size}
      className={cn(
        "vidya-stage relative",
        size === "hero" && "w-full max-w-[540px]",
        size === "workspace" && "w-full max-w-[640px]",
        compact && "h-16 w-16",
        className,
      )}
      style={compact ? undefined : { aspectRatio: `${VB_W} / ${VB_H}` }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          onClick={onActivate}
          className="vidya-sphere"
          aria-label={label}
          aria-pressed={active}
          data-testid="vidya-presence"
          data-state={state}
        >
          <span aria-hidden className="vidya-ring" />
          <span aria-hidden className="vidya-core">
            <span className="relative z-10 flex flex-col items-center gap-1.5">
              {!active && <Mic className="vidya-icon" strokeWidth={1.9} />}
              {!compact && <span className="vidya-wordmark">VIDYA</span>}
            </span>
          </span>
        </button>
      </div>
      {decorations}
    </div>
  );
}
