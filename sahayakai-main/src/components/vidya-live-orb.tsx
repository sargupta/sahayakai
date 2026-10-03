"use client";

/**
 * Compact VIDYA for tool pages (/lesson-plan, /quiz-generator, …).
 *
 * A VIEW of the app-wide live session (`VidyaLiveProvider`) — the same
 * session the central home VIDYA uses — so a conversation that navigated
 * here keeps going without a new click. Tap to start / end.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { useVidyaLiveSession } from "@/components/vidya/vidya-live-provider";
import { VidyaPresence } from "@/components/vidya/vidya-presence";
import { vidyaStatusKey } from "@/lib/vidya-live/use-vidya-live";

export function VidyaLiveOrb() {
  const { t } = useLanguage();
  const live = useVidyaLiveSession();
  // Portal to <body>: OmniOrb's drag / auto-hide wrapper is transformed, which
  // would make `position: fixed` relative to it (and slide a LIVE
  // conversation out of view on scroll).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!live || !mounted) return null;
  const { state, active, error, caption, hasAnswered } = live;

  return createPortal(
    <div
      className="fixed right-6 z-50 flex flex-col items-end gap-2 md:right-8"
      // Clears the md:hidden MobileBottomNav on phones; harmless on desktop.
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {(active || error) && (
        <div className="flex max-w-[17rem] flex-col items-end gap-2" data-testid="vidya-live-panel">
          {caption && active && (
            <div className="rounded-2xl border border-border bg-card/95 px-3 py-2 text-xs leading-relaxed text-foreground shadow-soft">
              <span className="font-semibold text-primary">{caption.role === "vidya" ? "VIDYA" : t("You")}: </span>
              {caption.text.slice(-140)}
            </div>
          )}
          <div
            role="status"
            aria-live="polite"
            data-state={state}
            data-testid="vidya-live-status"
            className="vidya-status inline-flex items-center gap-2 rounded-full border border-saffron-200/80 bg-card/95 px-3.5 py-1.5 text-[13px] font-medium text-foreground shadow-soft"
          >
            <span aria-hidden className="vidya-status-dot" />
            <span>{error ? t(error) : t(vidyaStatusKey(state, hasAnswered))}</span>
            <button
              type="button"
              onClick={() => (error ? live.dismissError() : live.stop())}
              className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={error ? t("Dismiss") : t("End voice conversation")}
              data-testid="vidya-live-end"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <VidyaPresence
        size="compact"
        state={state}
        getLevel={live.getLevel}
        onActivate={live.toggle}
        label={active ? t("End voice conversation") : t("Talk to VIDYA")}
      />
    </div>
    ,
    document.body,
  );
}
