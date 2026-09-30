"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Headphones, ListChecks, PhoneCall, Users } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/context/language-context";
import { getCampaign, previewCampaign, type CampaignDetail } from "@/lib/api/sampark";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { PARENT_LANGUAGES, type BlockReason, type Campaign, type ParentLanguage } from "@/types/sampark";
import { CampaignActions } from "@/components/sampark/campaign-actions";
import { KpiTile } from "@/components/sampark/kpi-tile";
import { LanguageSwitcher } from "@/components/sampark/language-switcher";
import { ScriptPreviewCard } from "@/components/sampark/script-preview-card";
import { CampaignStatusBadge } from "@/components/sampark/status-pill";
import { ErrorPanel, InlineSpinner, LoadingBlock } from "@/components/sampark/states";
import { useAuthedAudio } from "@/components/sampark/use-authed-audio";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { safeDecode, useSamparkFormat } from "@/components/sampark/format";
import { useCampaignSummary } from "@/components/sampark/campaign-summary";
import {
    LIVE_CAMPAIGN_STATUSES,
    blockReasonLabel,
    fmt,
    languageName,
    purposeLabel,
} from "@/components/sampark/labels";

const VARIANT_ORDER = { default: 0, today: 1, tomorrow: 2 } as const;

function CountsGrid({ campaign }: { campaign: Campaign }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const c = campaign.counts;
    const tiles: { label: string; value: number; emphasis?: "success" | "warning" | "info" }[] = [
        { label: t("Families"), value: c.guardians },
        { label: t("Blocked"), value: c.blocked, emphasis: c.blocked > 0 ? "warning" : undefined },
        { label: t("Waiting to call"), value: c.queued },
        { label: t("On a call now"), value: c.inFlight, emphasis: c.inFlight > 0 ? "info" : undefined },
        { label: t("Heard the key fact"), value: c.heardKeyFact, emphasis: "success" },
        { label: t("Confirmed (pressed 1)"), value: c.confirmedYes },
        { label: t("Pressed 2 or other"), value: c.declinedOrOther },
        { label: t("No answer"), value: c.noAnswer },
        { label: t("Could not connect"), value: c.failed },
        { label: t("Asked to stop calls"), value: c.optOuts, emphasis: c.optOuts > 0 ? "warning" : undefined },
    ];
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {tiles.map((tile) => (
                <KpiTile key={tile.label} label={tile.label} value={f.number(tile.value)} emphasis={tile.emphasis} />
            ))}
        </div>
    );
}

function AudienceSummary({ detail }: { detail: CampaignDetail }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const a = detail.audience;
    const blocked = (Object.entries(a.blocked) as [BlockReason, number | undefined][])
        .filter(([, n]) => (n ?? 0) > 0)
        .sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0));
    const blockedTotal = blocked.reduce((s, [, n]) => s + (n ?? 0), 0);
    const langs = [...PARENT_LANGUAGES, "unknown"] as const;

    return (
        <SectionCard title={t("Who will be called")} icon={Users} description={t("A dry run of the rules against the current records. Nothing has been sent.")}>
            <p className="type-body-lg text-foreground">
                {fmt(t("{reachable} of {total} families can be called"), {
                    reachable: f.number(Math.max(0, a.guardians - blockedTotal)),
                    total: f.number(a.guardians),
                })}
            </p>
            <ul className="flex flex-wrap gap-2">
                {langs.map((lang) => {
                    const n = a.byLanguage[lang] ?? 0;
                    if (n === 0) return null;
                    const info = lang === "unknown" ? null : PARENT_LANGUAGE_INFO[lang];
                    return (
                        <li key={lang} className="rounded-pill border border-border bg-muted/30 px-3 py-1 type-body text-foreground">
                            {info ? <span lang={info.code}>{info.nativeLabel}</span> : languageName(t, "unknown")} · {f.number(n)}
                        </li>
                    );
                })}
            </ul>
            {blocked.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium leading-normal text-muted-foreground">
                        {fmt(t("{count} families will not be called, and why"), { count: f.number(blockedTotal) })}
                    </p>
                    <ul className="divide-y divide-border rounded-surface-md border border-border">
                        {blocked.map(([reason, n]) => (
                            <li key={reason} className="flex items-start justify-between gap-3 p-3">
                                <span className="type-body text-foreground">{blockReasonLabel(t, reason)}</span>
                                <span className="shrink-0 type-body font-semibold text-foreground">{f.number(n ?? 0)}</span>
                            </li>
                        ))}
                    </ul>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/sampark/${encodeURIComponent(detail.campaign.orgId)}/families`}>{t("Review families")}</Link>
                    </Button>
                </div>
            )}
        </SectionCard>
    );
}

function PreviewSection({ detail }: { detail: CampaignDetail }) {
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

    const shown = (previewQuery.data ?? [])
        .filter((p) => p.language === language)
        .sort((a, b) => VARIANT_ORDER[a.variant] - VARIANT_ORDER[b.variant]);

    const counts = useMemo(() => {
        const out: Partial<Record<ParentLanguage, number>> = {};
        for (const l of PARENT_LANGUAGES) out[l] = detail.audience.byLanguage[l] ?? 0;
        return out;
    }, [detail.audience.byLanguage]);

    return (
        <SectionCard
            title={t("What parents will hear")}
            icon={Headphones}
            description={t("The exact words in each language. Audio can be played once it has been prepared after approval.")}
        >
            <LanguageSwitcher value={language} onChange={(l) => { audio.stop(); setLanguage(l); }} counts={counts} />
            {previewQuery.loading && !previewQuery.data && <InlineSpinner />}
            {previewQuery.error && <ErrorPanel error={previewQuery.error} onRetry={previewQuery.reload} />}
            {previewQuery.data && shown.length === 0 && (
                <p className="type-body text-muted-foreground">{t("No preview in this language.")}</p>
            )}
            <div className="grid gap-3">
                {shown.map((p) => (
                    <ScriptPreviewCard key={`${p.language}-${p.variant}`} preview={p} audio={audio} />
                ))}
            </div>
        </SectionCard>
    );
}

export default function SamparkCampaignPage() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const params = useParams<{ id: string }>();
    const campaignId = params?.id ? safeDecode(params.id) : "";
    const { orgId, school } = useSamparkSchool();
    const { describe } = useCampaignSummary();
    const base = `/sampark/${encodeURIComponent(orgId)}`;

    const [pollMs, setPollMs] = useState<number | null>(null);
    const query = useSamparkQuery(
        campaignId ? (signal) => getCampaign(orgId, campaignId, { signal }) : null,
        [orgId, campaignId],
        { pollMs },
    );
    const detail = query.data;
    const live = detail ? LIVE_CAMPAIGN_STATUSES.includes(detail.campaign.status) : false;
    useEffect(() => setPollMs(live ? 5_000 : null), [live]);

    if (!detail) {
        if (query.error) return <ErrorPanel error={query.error} onRetry={query.reload} />;
        return <LoadingBlock rows={4} />;
    }

    const { campaign } = detail;
    const d = describe(campaign, school);
    const rp = campaign.renderProgress;
    const showRender = campaign.status === "rendering" || campaign.status === "render_failed" || rp.failures.length > 0;
    const started = !["draft", "rendering", "render_failed"].includes(campaign.status);

    return (
        <div className="space-y-6">
            <Link
                href={`${base}/campaigns`}
                className="inline-flex items-center gap-2 rounded-surface-sm type-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {t("All campaigns")}
            </Link>

            <SectionCard>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="type-h2 text-foreground">{purposeLabel(t, campaign.purpose)}</h2>
                            <CampaignStatusBadge status={campaign.status} />
                        </div>
                        <p className="type-body-lg text-foreground">{d.facts}</p>
                        <p className="type-body text-muted-foreground">
                            {d.audience} · {fmt(t("Created {when}"), { when: f.dateTime(campaign.createdAt) })}
                            {campaign.approvedAt && <> · {fmt(t("Approved {when}"), { when: f.dateTime(campaign.approvedAt) })}</>}
                        </p>
                        <p className="type-body text-muted-foreground">
                            {fmt(t("No new calls after {when}"), { when: f.dateTime(campaign.expiresAt) })}
                        </p>
                    </div>
                    <CampaignActions
                        campaign={campaign}
                        audience={detail.audience}
                        school={school}
                        onChange={(next) => {
                            query.setData((prev) => (prev ? { ...prev, campaign: next } : { campaign: next, audience: detail.audience }));
                            query.reload();
                        }}
                    />
                </div>

                {live && (
                    <p className="type-body text-muted-foreground" aria-live="polite">
                        {t("This page refreshes itself every few seconds.")}
                    </p>
                )}

                {showRender && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <p className="type-body font-medium text-foreground">{t("Preparing audio")}</p>
                            <p className="type-body text-muted-foreground">
                                {fmt(t("{done} of {total} clips"), { done: rp.done, total: rp.total })}
                            </p>
                        </div>
                        <Progress value={rp.total > 0 ? (rp.done / rp.total) * 100 : 0} aria-label={t("Audio progress")} />
                        {rp.failures.length > 0 && (
                            <div className="space-y-1 rounded-surface-md border border-destructive/40 bg-destructive/10 p-3">
                                <p className="flex items-center gap-2 type-body font-semibold text-foreground">
                                    <AlertTriangle aria-hidden="true" className="h-4 w-4 text-destructive" />
                                    {t("Some recordings failed the listening check. Nothing will be sent until they pass.")}
                                </p>
                                <ul className="list-disc space-y-1 pl-5 type-body text-muted-foreground">
                                    {rp.failures.map((failure, i) => (
                                        <li key={i} className="break-words">{failure}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </SectionCard>

            {started && (
                <SectionCard
                    title={t("Progress")}
                    icon={ListChecks}
                    action={
                        <Button asChild variant="outline" size="sm">
                            <Link href={`${base}/calls?campaignId=${encodeURIComponent(campaign.id)}`}>
                                <PhoneCall aria-hidden="true" />
                                {t("See calls")}
                            </Link>
                        </Button>
                    }
                >
                    <CountsGrid campaign={campaign} />
                </SectionCard>
            )}

            <AudienceSummary detail={detail} />
            <PreviewSection detail={detail} />
        </div>
    );
}
