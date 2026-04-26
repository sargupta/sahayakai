"use client";

import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import {
    VOICE_QUOTA_WARNING_EVENT_NAME,
    type VoiceQuotaWarningEventDetail,
} from "@/lib/tts";

/**
 * Mounted once in AppShell. Listens for `sahayakai:voice-quota-warning`
 * CustomEvents fired by the TTS client wrapper after a successful
 * /api/tts call returns a `voiceQuota` snapshot whose warning level is
 * `warn-80` or `warn-95`.
 *
 * Soft-cap UX:
 *   - 80% utilisation → friendly nudge ("You've used 240/300 minutes
 *     this month") so the teacher can pace the rest of the month.
 *   - 95% utilisation → harder warning ("Only 15 minutes left") with a
 *     clear path to upgrade or switch to browser voice.
 *   - 100% utilisation → handled server-side (429 USAGE_LIMIT_REACHED),
 *     not here.
 *
 * Each (user, month, threshold) combination shows the toast at most
 * once. Persistence key:
 *     sahayakai-voice-warned-<uid>-<YYYY-MM>-<threshold>
 *
 * If the user is not signed in we skip warnings entirely — anonymous
 * users never have a billable voice quota.
 */
export function VoiceQuotaToastListener() {
    const { toast } = useToast();
    const { t } = useLanguage();
    const lastShownRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handler = (rawEvent: Event) => {
            const event = rawEvent as CustomEvent<VoiceQuotaWarningEventDetail>;
            const detail = event.detail;
            if (!detail || (detail.level !== "warn-80" && detail.level !== "warn-95")) return;

            const uid = auth.currentUser?.uid ?? "anon";
            if (uid === "anon") return; // anonymous calls never bill, skip warnings

            const monthKey = monthKeyForToday();
            const dedupKey = `${uid}-${monthKey}-${detail.level}`;

            // In-session dedup
            if (lastShownRef.current.has(dedupKey)) return;
            lastShownRef.current.add(dedupKey);

            // Cross-session dedup via localStorage. If we've shown this exact
            // (user, month, threshold) before, skip.
            const storageKey = `sahayakai-voice-warned-${dedupKey}`;
            try {
                if (window.localStorage.getItem(storageKey) === "1") return;
                window.localStorage.setItem(storageKey, "1");
            } catch {
                // localStorage may be unavailable (restricted webview) — fall through
            }

            // Compose translated toast.
            const usedRounded = Math.round(detail.used);
            const limitRounded = Math.round(detail.limit);
            const remainingRounded = Math.max(0, Math.round(detail.remaining));

            if (detail.level === "warn-80") {
                toast({
                    title: t("Voice cloud quota: 80% used"),
                    description: t("You've used {used} of {limit} cloud voice minutes this month.")
                        .replace("{used}", String(usedRounded))
                        .replace("{limit}", String(limitRounded)),
                });
            } else {
                // warn-95
                toast({
                    title: t("Voice cloud quota: nearly full"),
                    description: t("Only {remaining} cloud voice minutes left this month. Browser voice stays free.")
                        .replace("{remaining}", String(remainingRounded)),
                    variant: "destructive",
                });
            }
        };

        window.addEventListener(VOICE_QUOTA_WARNING_EVENT_NAME, handler as EventListener);
        return () => window.removeEventListener(VOICE_QUOTA_WARNING_EVENT_NAME, handler as EventListener);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

function monthKeyForToday(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
