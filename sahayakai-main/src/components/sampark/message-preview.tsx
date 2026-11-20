"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pause, Play } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { previewCampaign, type CampaignDetail } from "@/lib/api/sampark";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { cn } from "@/lib/utils";
import { PARENT_LANGUAGES, type ClipKind, type ParentLanguage, type ScriptPreview } from "@/types/sampark";
import { LanguageSwitcher } from "./language-switcher";
import { clipKindLabel, fmt, variantLabel } from "./labels";
import { ErrorPanel, InlineSpinner } from "./states";
import { useAuthedAudio, type AuthedAudio } from "./use-authed-audio";
import { useSamparkQuery } from "./use-sampark-query";

/** A notice must fit one 60-second billing unit, message and menu together (plan §2, §7). */
export const CALL_SECONDS_BUDGET = 60;

const VARIANT_ORDER = { default: 0, today: 1, tomorrow: 2 } as const;
/** The replies a parent hears after pressing a key, shown beside the message with that key. */
const REPLY_KEYS: Partial<Record<ClipKind, string>> = { confirm_1: "1", confirm_2: "2" };

type Clip = ScriptPreview["clips"][number];

/** Play or stop one rendered clip; says so when the audio is not ready yet. */
function PlayButton({ clip, audio, primary = false }: { clip: Clip; audio: AuthedAudio; primary?: boolean }) {
    const { t } = useLanguage();
    const key = clip.audioKey;
    if (!key) {
        return <span className="shrink-0 text-xs leading-normal text-muted-foreground">{t("Audio not ready yet")}</span>;
    }
    const playing = audio.playingKey === key;
    const loading = audio.loadingKey === key;
    return (
        <Button
            type="button"
            size="icon"
            variant={primary ? "default" : "outline"}
            className={cn("h-11 w-11 shrink-0", primary && "rounded-pill")}
            onClick={() => audio.toggle(key)}
            aria-label={playing ? t("Stop audio") : t("Play audio")}
        >
            {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </Button>
    );
}

function ClipFailed({ clip, audio }: { clip: Clip; audio: AuthedAudio }) {
    const { t } = useLanguage();
    if (!clip.audioKey || audio.errorKey !== clip.audioKey) return null;
    return <p className="type-body text-destructive">{t("This clip could not be played. Try again.")}</p>;
}

/**
 * One language (and one variant, for closures): the message with its play button, the
 * replies to keys 1 and 2 beside it, and every other clip a parent may hear folded below.
 */
function LanguagePreview({ preview, audio }: { preview: ScriptPreview; audio: AuthedAudio }) {
    const { t } = useLanguage();
    const info = PARENT_LANGUAGE_INFO[preview.language];
    const variant = variantLabel(t, preview.variant);
    const overBudget = preview.estimatedSeconds > CALL_SECONDS_BUDGET;
    const message = preview.clips.find((c) => c.kind === "message");
    const replies = preview.clips.filter((c) => REPLY_KEYS[c.kind]);
    const others = preview.clips.filter((c) => c.kind !== "message" && !REPLY_KEYS[c.kind]);

    return (
        <div className="space-y-3">
            {variant && <p className="type-body font-semibold text-foreground">{variant}</p>}

            {overBudget && (
                <p className="flex items-start gap-2 rounded-surface-md border border-destructive/40 bg-destructive/10 p-3 type-body text-foreground">
                    <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-destructive" />
                    {fmt(t("Longer than the {budget}-second budget. Every call would be billed for two minutes."), { budget: CALL_SECONDS_BUDGET })}
                </p>
            )}
            {preview.warnings.length > 0 && (
                <ul className="space-y-1">
                    {preview.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 type-body text-foreground">
                            <AlertTriangle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-warning" />
                            <span className="break-words">{w}</span>
                        </li>
                    ))}
                </ul>
            )}

            <div className="grid gap-4 2xl:grid-cols-3">
                {message && (
                    <div className="space-y-3 rounded-surface-md border border-border p-4 2xl:col-span-2">
                        <div className="flex items-center gap-3">
                            <PlayButton clip={message} audio={audio} primary />
                            <div className="min-w-0 flex-1">
                                <p className="type-body font-semibold text-foreground">{clipKindLabel(t, "message")}</p>
                                <p className={cn("text-xs leading-normal", overBudget ? "font-semibold text-destructive" : "text-muted-foreground")}>
                                    {fmt(t("About {seconds} seconds"), { seconds: Math.round(preview.estimatedSeconds) })}
                                </p>
                            </div>
                        </div>
                        <p lang={info.code} className="text-base leading-relaxed text-foreground">{message.text}</p>
                        <ClipFailed clip={message} audio={audio} />
                    </div>
                )}
                {replies.length > 0 && (
                    <div className="space-y-3">
                        {replies.map((clip) => (
                            <div key={clip.kind} className="space-y-2 rounded-surface-md border border-border p-4">
                                <div className="flex items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-surface-sm text-xs font-bold leading-normal",
                                            clip.kind === "confirm_1" ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                                        )}
                                    >
                                        {REPLY_KEYS[clip.kind]}
                                    </span>
                                    <p className="min-w-0 flex-1 type-body font-semibold text-foreground">{clipKindLabel(t, clip.kind)}</p>
                                    <PlayButton clip={clip} audio={audio} />
                                </div>
                                <p lang={info.code} className="type-body text-foreground">{clip.text}</p>
                                <ClipFailed clip={clip} audio={audio} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {others.length > 0 && (
                <details className="rounded-surface-md border border-border px-4">
                    <summary className="flex min-h-11 cursor-pointer items-center rounded-surface-sm type-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {t("Other things a parent may hear")}
                    </summary>
                    <ul className="divide-y divide-border pb-2">
                        {others.map((clip, i) => (
                            <li key={`${clip.kind}-${i}`} className="space-y-2 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-medium leading-normal text-muted-foreground">{clipKindLabel(t, clip.kind)}</p>
                                    <PlayButton clip={clip} audio={audio} />
                                </div>
                                <p lang={info.code} className="type-body text-foreground">{clip.text}</p>
                                <ClipFailed clip={clip} audio={audio} />
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}

/**
 * What parents will hear, per language, exactly as rendered: the words of every clip and,
 * once the audio has been made, the real recordings (fetched with the signed-in token).
 */
export function WhatParentsHear({ detail }: { detail: CampaignDetail }) {
    const { t } = useLanguage();
    const { campaign } = detail;
    const audio = useAuthedAudio(campaign.orgId);

    // Re-read previews when rendering progresses: audio keys appear as clips are made.
    const previewQuery = useSamparkQuery(
        (signal) => previewCampaign(campaign.orgId, campaign.id, [...PARENT_LANGUAGES], { signal }),
        [campaign.orgId, campaign.id, campaign.status, campaign.renderProgress.done],
    );

    const defaultLang = useMemo<ParentLanguage>(() => {
        const by = detail.audience.byLanguage;
        let best: ParentLanguage = "English";
        let bestN = -1;
        for (const l of PARENT_LANGUAGES) {
            const n = by[l] ?? 0;
            if (n > bestN) {
                best = l;
                bestN = n;
            }
        }
        return best;
    }, [detail.audience.byLanguage]);
    const [language, setLanguage] = useState<ParentLanguage>(defaultLang);
    useEffect(() => setLanguage(defaultLang), [defaultLang]);

    const counts = useMemo(() => {
        const out: Partial<Record<ParentLanguage, number>> = {};
        for (const l of PARENT_LANGUAGES) out[l] = detail.audience.byLanguage[l] ?? 0;
        return out;
    }, [detail.audience.byLanguage]);

    const shown = (previewQuery.data ?? [])
        .filter((p) => p.language === language)
        .sort((a, b) => VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant]);
    // The dispatcher only schedules a campaign whose every clip passed the listening check (H4).
    // Claim the check only when every clip shown actually has audio: the status alone says the
    // render job finished, not that recordings exist for every language and clip on this screen.
    const verified =
        ["scheduled", "dispatching", "completed"].includes(campaign.status) &&
        !!previewQuery.data &&
        previewQuery.data.length > 0 &&
        previewQuery.data.every((p) => p.clips.length > 0 && p.clips.every((c) => !!c.audioKey));

    return (
        <SectionCard
            title={t("What parents will hear")}
            description={t("The exact words in each language. Audio can be played once it has been prepared after approval.")}
        >
            <LanguageSwitcher
                value={language}
                onChange={(l) => {
                    audio.stop();
                    setLanguage(l);
                }}
                counts={counts}
            />
            {previewQuery.loading && !previewQuery.data && <InlineSpinner />}
            {previewQuery.error && <ErrorPanel error={previewQuery.error} onRetry={previewQuery.reload} />}
            {previewQuery.data && shown.length === 0 && <p className="type-body text-muted-foreground">{t("No preview in this language.")}</p>}
            <div className="space-y-6">
                {shown.map((p) => (
                    <LanguagePreview key={`${p.language}-${p.variant}`} preview={p} audio={audio} />
                ))}
            </div>
            {verified && (
                <p className="flex items-center gap-2 type-body font-semibold text-success">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {t("Every recording passed the listening check.")}
                </p>
            )}
        </SectionCard>
    );
}
