"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Loader2, Square } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import type { Language } from "@/types";

/**
 * Floating "Listen in your language" button for marketing pages.
 *
 * Uses the browser's SpeechSynthesis API (zero cost, no auth required, works
 * for anonymous cold visitors). This is intentionally NOT the higher-quality
 * Google Cloud TTS we use inside the app — marketing audio should work without
 * account, quota, or network round-trip.
 *
 * The button extracts readable text from the <main> element and reads it in
 * the user's current language.
 *
 * Degrades gracefully: if SpeechSynthesis is unavailable (older browser, iOS
 * Lockdown mode, some in-app webviews), the button hides itself.
 */

const BCP47: Record<Language, string> = {
    English: "en-IN",
    Hindi: "hi-IN",
    Kannada: "kn-IN",
    Tamil: "ta-IN",
    Telugu: "te-IN",
    Marathi: "mr-IN",
    Bengali: "bn-IN",
    Gujarati: "gu-IN",
    Punjabi: "pa-IN",
    Malayalam: "ml-IN",
    Odia: "or-IN",
};

type Props = {
    /** CSS selector for the element whose text should be read. Defaults to <main>. */
    selector?: string;
};

export function PageAudio({ selector }: Props) {
    const { language, t } = useLanguage();
    const [supported, setSupported] = useState<boolean | null>(null);
    const [state, setState] = useState<"idle" | "preparing" | "playing">("idle");
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") {
            setSupported(false);
            return;
        }
        setSupported("speechSynthesis" in window);
    }, []);

    useEffect(() => {
        return () => {
            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // Cancel audio when user switches language mid-read
    useEffect(() => {
        if (state !== "idle" && typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            setState("idle");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    const extractText = (): string => {
        if (typeof document === "undefined") return "";
        const root = selector
            ? (document.querySelector(selector) as HTMLElement | null)
            : (document.querySelector("main") as HTMLElement | null) ?? document.body;
        if (!root) return "";

        const clone = root.cloneNode(true) as HTMLElement;
        // Strip chrome + controls we don't want read aloud
        clone.querySelectorAll("nav, footer, button, [data-nospeech], script, style").forEach((el) =>
            el.remove()
        );
        return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
    };

    const pickVoice = (langCode: string): SpeechSynthesisVoice | null => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;
        return (
            voices.find((v) => v.lang === langCode) ||
            voices.find((v) => v.lang.toLowerCase().startsWith(langCode.split("-")[0])) ||
            voices[0]
        );
    };

    const handleClick = () => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

        if (state === "playing" || state === "preparing") {
            window.speechSynthesis.cancel();
            setState("idle");
            return;
        }

        const text = extractText();
        if (!text) return;

        setState("preparing");
        const utter = new SpeechSynthesisUtterance(text.slice(0, 4500));
        const langCode = BCP47[language] ?? "en-IN";
        utter.lang = langCode;
        utter.rate = 0.95;
        utter.pitch = 1.0;

        const tryPick = () => {
            const voice = pickVoice(langCode);
            if (voice) utter.voice = voice;
            window.speechSynthesis.speak(utter);
            setState("playing");
        };

        if (window.speechSynthesis.getVoices().length === 0) {
            let picked = false;
            const handler = () => {
                window.speechSynthesis.removeEventListener("voiceschanged", handler);
                if (!picked) {
                    picked = true;
                    tryPick();
                }
            };
            window.speechSynthesis.addEventListener("voiceschanged", handler);
            setTimeout(() => {
                if (!picked) {
                    picked = true;
                    tryPick();
                }
            }, 800);
        } else {
            tryPick();
        }

        utter.onend = () => setState("idle");
        utter.onerror = () => setState("idle");
        utteranceRef.current = utter;
    };

    if (supported === false || supported === null) return null;

    const label =
        state === "playing" || state === "preparing" ? t("Stop listening") : t("Listen in your language");

    return (
        <button
            type="button"
            data-nospeech
            onClick={handleClick}
            aria-label={label}
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 text-[13px] font-medium px-[14px] py-[10px] rounded-full bg-saffron text-white shadow-[0_14px_28px_-12px_hsl(28_70%_45%/0.45)] hover:bg-saffron-600 transition-colors cursor-pointer"
        >
            {state === "preparing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === "playing" ? (
                <Square className="h-4 w-4" strokeWidth={2.2} />
            ) : (
                <Volume2 className="h-4 w-4" strokeWidth={2.2} />
            )}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}
