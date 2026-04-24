"use client";

import { Mic, Square } from "lucide-react";
import { useInlineSpeech } from "@/hooks/use-inline-speech";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

/**
 * InlineMicButton — the small mic icon inside a FieldRow.
 *
 * Uses browser-native SpeechRecognition (free, on-device when available).
 * For richer voice flows (VAD, cloud fallback) use <MicrophoneInput>.
 *
 * The button:
 * - Renders as a 32px square button, positioned by parent.
 * - Toggles listening on tap.
 * - Pulses red while listening; saffron while idle.
 * - Hidden if browser doesn't support SpeechRecognition.
 */
export interface InlineMicButtonProps {
  /** Called with each transcript update. `isFinal` true when locked in. */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** BCP-47 override; defaults to app language. */
  lang?: string;
  className?: string;
  /** Aria label override (i18n). Defaults to a localised "Speak instead". */
  ariaLabel?: string;
}

export function InlineMicButton({
  onTranscript,
  lang,
  className,
  ariaLabel,
}: InlineMicButtonProps) {
  const { t } = useLanguage();
  const { status, toggle } = useInlineSpeech({ onTranscript, lang });

  if (status === "unsupported") return null;

  const listening = status === "listening";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel ?? t("Speak instead of typing")}
      aria-pressed={listening}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-pill",
        "transition-colors duration-micro ease-out-quart",
        listening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-primary/10 text-primary hover:bg-primary/15",
        className,
      )}
    >
      {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
