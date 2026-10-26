"use client";

/**
 * VIDYA in the landing hero — "Meet VIDYA".
 *
 * The same `VidyaPresence` visual the signed-in workspace uses, driven by a
 * REAL voice session (browser mic → sidecar → Google ADK → Vertex Gemini
 * Live → speaker) in PUBLIC scope: anonymous visitors get a genuine
 * conversation, but the sidecar serves it with no tools and no account
 * context (enforced server-side — see /api/vidya-voice/public-session).
 *
 * One tap starts the conversation; the visitor then just talks. Tap again to
 * end. Around her: a few quiet, slowly floating capability words — support,
 * not competition.
 */

import { useCallback, useEffect } from "react";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { VidyaPresence } from "@/components/vidya/vidya-presence";
import { useVidyaLive, vidyaStatusKey } from "@/lib/vidya-live/use-vidya-live";

const FLOATING = [
  { label: "Lesson plans", pos: { left: "3%", top: "12%" }, float: "mark-float-a" },
  { label: "Assessments", pos: { right: "2%", top: "18%" }, float: "mark-float-b" },
  { label: "Parent messages", pos: { left: "0%", bottom: "16%" }, float: "mark-float-c" },
  { label: "11 languages", pos: { right: "4%", bottom: "10%" }, float: "mark-float-a" },
] as const;

export function LandingVoiceOrb() {
  const { t, language } = useLanguage();

  // The previous turn-based flow redirected with `?voice_intent=1`; strip any
  // stale flag so it never re-triggers.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("voice_intent") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("voice_intent");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const buildSessionInput = useCallback(() => {
    const iso = LANGUAGE_TO_ISO[language] ?? "en";
    return { startSessionBody: { detectedLanguage: iso }, setup: { language: iso } };
  }, [language]);

  const live = useVidyaLive({
    scope: "public",
    getIdToken: async () => null,
    buildSessionInput,
  });

  const status = live.error ? live.error : vidyaStatusKey(live.state, live.hasAnswered);

  return (
    <div className="relative flex w-full flex-col items-center">
      <VidyaPresence
        size="hero"
        state={live.state}
        getLevel={live.getLevel}
        onActivate={live.error ? () => { live.dismissError(); void live.start(); } : live.toggle}
        label={live.active ? t("End conversation with VIDYA") : t("Talk to VIDYA")}
        decorations={
          <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
            {FLOATING.map((f) => (
              <span
                key={f.label}
                className={`${f.float} absolute whitespace-nowrap text-[12.5px] font-medium tracking-wide text-neutral-500`}
                style={{ ...f.pos, opacity: 0.85 }}
              >
                {t(f.label)}
              </span>
            ))}
          </div>
        }
      />

      <p
        role="status"
        aria-live="polite"
        data-state={live.state}
        data-testid="vidya-hero-status"
        className="vidya-status relative z-10 -mt-3 inline-flex items-center gap-2.5 rounded-full border border-saffron-200/80 bg-white/85 px-5 py-2 text-[14px] font-medium text-foreground shadow-[0_8px_24px_-14px_hsl(var(--saffron-800)/0.35)] backdrop-blur-sm"
      >
        <span aria-hidden className="vidya-status-dot" />
        {live.state === "idle" || live.state === "ended" ? t("Meet VIDYA — tap and talk") : t(status)}
        {live.active && (
          <button
            type="button"
            onClick={live.stop}
            className="ml-1 text-[12px] font-medium text-neutral-500 underline-offset-2 hover:text-foreground hover:underline"
            data-testid="vidya-hero-end"
          >
            {t("End")}
          </button>
        )}
      </p>

      {live.caption && live.active && (
        <p className="mt-3 max-w-[34ch] text-center text-[13px] leading-relaxed text-neutral-500">
          {live.caption.role === "vidya" ? "" : `“`}
          {live.caption.text.slice(-120)}
          {live.caption.role === "vidya" ? "" : `”`}
        </p>
      )}
    </div>
  );
}
