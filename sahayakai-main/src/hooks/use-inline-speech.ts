"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage, BCP47_MAP } from "@/context/language-context";
import { logger } from "@/lib/client-logger";

/**
 * useInlineSpeech — lightweight hook for inline mic buttons.
 *
 * Distinct from <MicrophoneInput>: that component is the heavy-duty
 * VAD + cloud-fallback voice surface used by VIDYA / OmniOrb / standalone
 * recorders. This hook is for the small mic icon next to a text input
 * inside <FieldRow>. Browser-native SpeechRecognition only — free, no
 * cloud calls, no waveform render.
 *
 * Returns interim + final transcript via onTranscript callback. The
 * caller decides where to put the text (replace input, append, etc).
 */
export interface UseInlineSpeechOptions {
  /** Called on every interim/final result. Pass `final=true` to know it's locked in. */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** BCP-47 lang override; defaults to current app language. */
  lang?: string;
  /** Callback when speech starts. */
  onStart?: () => void;
  /** Callback when speech ends (any reason — manual stop, silence, error). */
  onEnd?: () => void;
}

export type InlineSpeechStatus = "idle" | "listening" | "unsupported";

export function useInlineSpeech({
  onTranscript,
  lang,
  onStart,
  onEnd,
}: UseInlineSpeechOptions) {
  const { language } = useLanguage();
  const [status, setStatus] = useState<InlineSpeechStatus>("idle");
  const recognitionRef = useRef<any>(null);

  // Detect support once on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Sup = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Sup) {
      setStatus("unsupported");
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped — safe to ignore
      }
      recognitionRef.current = null;
    }
    setStatus("idle");
    onEnd?.();
  }, [onEnd]);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const Sup = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Sup) {
      setStatus("unsupported");
      return;
    }
    if (recognitionRef.current) {
      // already running — toggle off
      stop();
      return;
    }

    try {
      const rec = new Sup();
      rec.lang = lang ?? BCP47_MAP[language] ?? "en-IN";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (e: any) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) onTranscript(final.trim(), true);
        else if (interim) onTranscript(interim.trim(), false);
      };

      rec.onend = () => {
        recognitionRef.current = null;
        setStatus("idle");
        onEnd?.();
      };

      rec.onerror = (e: any) => {
        logger.warn("inline speech error", "VOICE", { error: e.error });
        recognitionRef.current = null;
        setStatus("idle");
        onEnd?.();
      };

      rec.start();
      recognitionRef.current = rec;
      setStatus("listening");
      onStart?.();
    } catch (err) {
      logger.warn("inline speech start failed", "VOICE", { err });
      setStatus("idle");
    }
  }, [lang, language, onTranscript, onStart, onEnd, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { status, start, stop, toggle: status === "listening" ? stop : start };
}
