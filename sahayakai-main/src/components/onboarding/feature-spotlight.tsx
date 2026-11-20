"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

/** Canonical spotlight IDs -- use these constants to avoid typos across consumption sites */
export const SPOTLIGHT_IDS = {
    HOME_VOICE_INPUT: 'home-voice-input',
    SIDEBAR_LESSON_PLAN: 'sidebar-lesson-plan',
    SAVE_TO_LIBRARY: 'save-to-library',
    SHARE_TO_COMMUNITY: 'share-to-community',
} as const;

interface FeatureSpotlightProps {
    id: string;
    message: string;
    seenSpotlights: string[];
    onDismiss: (id: string) => void;
    position?: 'top' | 'bottom' | 'left' | 'right';
    targetRef?: React.RefObject<HTMLElement | null>;
    children: React.ReactNode;
    delay?: number;
}

/**
 * Feature spotlight component -- wraps a UI element and shows a first-time tooltip.
 * Uses a pulse ring around the target and a positioned tooltip.
 * Shown once per feature, tracked via featureSpotlightsSeen[] on the profile.
 */
export function FeatureSpotlight({
    id,
    message,
    seenSpotlights,
    onDismiss,
    position = 'bottom',
    children,
    delay = 500,
}: FeatureSpotlightProps) {
    const { t } = useLanguage();
    const [visible, setVisible] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const tipRef = useRef<HTMLDivElement>(null);
    // Horizontal nudge that keeps the bubble on screen (a centred 256px bubble hung
    // off the edge of a phone when its target was not centred).
    const [shiftX, setShiftX] = useState(0);

    const alreadySeen = seenSpotlights.includes(id);

    useEffect(() => {
        if (alreadySeen) return;

        const timer = setTimeout(() => {
            setVisible(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [alreadySeen, delay]);

    useLayoutEffect(() => {
        if (!visible || !tipRef.current) return;
        const fit = () => {
            const el = tipRef.current;
            if (!el) return;
            el.style.setProperty("--spotlight-shift", "0px");
            const r = el.getBoundingClientRect();
            const margin = 8;
            const vw = document.documentElement.clientWidth;
            let dx = 0;
            if (r.right > vw - margin) dx = vw - margin - r.right;
            if (r.left + dx < margin) dx = margin - r.left;
            setShiftX(Math.round(dx));
        };
        fit();
        window.addEventListener("resize", fit);
        return () => window.removeEventListener("resize", fit);
    }, [visible, position]);

    const handleDismiss = () => {
        setVisible(false);
        onDismiss(id);
    };

    if (alreadySeen) return <>{children}</>;

    return (
        <div ref={wrapperRef} className="relative">
            {children}

            {visible && (
                <>
                    {/* Tooltip */}
                    <div
                        ref={tipRef}
                        data-testid="feature-spotlight-tip"
                        style={{ ["--spotlight-shift" as string]: `${shiftX}px`, translate: `var(--spotlight-shift) 0` }}
                        className={cn(
                        "absolute z-50 w-64 max-w-[calc(100vw-1rem)] p-3 rounded-xl bg-foreground text-background shadow-xl",
                        "animate-in fade-in slide-in-from-bottom-2 duration-300",
                        position === 'bottom' && "top-full left-1/2 -translate-x-1/2 mt-3",
                        position === 'top' && "bottom-full left-1/2 -translate-x-1/2 mb-3",
                        position === 'left' && "right-full top-1/2 -translate-y-1/2 mr-3",
                        position === 'right' && "left-full top-1/2 -translate-y-1/2 ml-3",
                    )}>
                        {/* Arrow (stays pointed at the target when the bubble is nudged) */}
                        <div style={{ translate: `calc(-1 * var(--spotlight-shift)) 0` }} className={cn(
                            "absolute w-3 h-3 bg-foreground rotate-45",
                            position === 'bottom' && "-top-1.5 left-1/2 -translate-x-1/2",
                            position === 'top' && "-bottom-1.5 left-1/2 -translate-x-1/2",
                            position === 'left' && "-right-1.5 top-1/2 -translate-y-1/2",
                            position === 'right' && "-left-1.5 top-1/2 -translate-y-1/2",
                        )} />

                        <p className="text-sm leading-relaxed mb-2">{message}</p>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleDismiss}
                            className="w-full rounded-lg text-xs h-7"
                        >
                            {t("Got it")}
                        </Button>
                    </div>

                    {/* Pulse ring around the target */}
                    <div className="absolute inset-0 rounded-xl ring-2 ring-primary/50 animate-pulse pointer-events-none" />
                </>
            )}
        </div>
    );
}
