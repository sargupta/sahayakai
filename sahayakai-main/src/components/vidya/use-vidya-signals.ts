"use client";

/**
 * The two app-wide signals every VIDYA orb reads: whether VIDYA's voice is playing
 * (tts.subscribeSpeaking — true only while audio actually plays) and the user's
 * reduced-motion preference. Each orb adds its own mic status and request state.
 */

import { useEffect, useState } from "react";

import { tts } from "@/lib/tts";

export function useVidyaSpeaking(): boolean {
    const [speaking, setSpeaking] = useState(false);
    useEffect(() => {
        setSpeaking(tts.isSpeaking());
        return tts.subscribeSpeaking(setSpeaking);
    }, []);
    return speaking;
}

export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);
    return reduced;
}
