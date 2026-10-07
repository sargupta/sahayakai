"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CirclePause } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/context/language-context";
import { getCampaign } from "@/lib/api/sampark";
import { CampaignActions } from "@/components/sampark/campaign-actions";
import { CampaignCallsTable, CampaignFunnel, CampaignOutcomes, CampaignStepper, NotCalledSection } from "@/components/sampark/campaign-detail";
import { WhatParentsHear } from "@/components/sampark/message-preview";
import { PauseCallsButton } from "@/components/sampark/school-pause";
import { CampaignStatusBadge, StatusPill } from "@/components/sampark/status-pill";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { safeDecode, useSamparkFormat } from "@/components/sampark/format";
import { useCampaignSummary } from "@/components/sampark/campaign-summary";
import {
    HOLDABLE_CAMPAIGN_STATUSES,
    LIVE_CAMPAIGN_STATUSES,
    effectiveHoldReason,
    fmt,
    holdReasonText,
    purposeLabel,
} from "@/components/sampark/labels";

/**
 * One campaign: header with status and actions, the five-step progress, the funnel
 * and outcomes once intents exist, who will not be called and why, what parents
 * hear in each language, and the latest calls. Refreshes every 5 s while live.
 */
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

    const back = (
        <Link
            href={`${base}/campaigns`}
            className="inline-flex min-h-11 items-center gap-2 rounded-surface-sm type-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t("All campaigns")}
        </Link>
    );

    if (!detail) {
        return (
            <div className="space-y-6">
                {back}
                {query.error ? <ErrorPanel error={query.error} onRetry={query.reload} /> : <LoadingBlock rows={4} />}
            </div>
        );
    }

    const { campaign } = detail;
    const d = describe(campaign, school);
    const rp = campaign.renderProgress;
    const showRender = campaign.status === "rendering" || campaign.status === "render_failed" || rp.failures.length > 0;
    const hold = effectiveHoldReason(campaign, school.pause);
    const hasIntents = campaign.counts.guardians > 0;
    const dialable = HOLDABLE_CAMPAIGN_STATUSES.includes(campaign.status);

    return (
        <div className="space-y-6">
            {back}

            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="type-h1 text-foreground break-words">
                            {purposeLabel(t, campaign.purpose)} · {d.audience}
                        </h1>
                        <CampaignStatusBadge status={campaign.status} />
                        {hold && <StatusPill tone="warning">{t("On hold")}</StatusPill>}
                    </div>
                    <p className="type-body-lg text-foreground">{d.facts}</p>
                    <p className="type-body text-muted-foreground">
                        {fmt(t("Created {when}"), { when: f.dateTime(campaign.createdAt) })}
                        {campaign.approvedAt && <> · {fmt(t("Approved {when}"), { when: f.dateTime(campaign.approvedAt) })}</>}
                    </p>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                    {/* There is no per-campaign pause: pausing stops every school call, and says so. */}
                    {dialable && <PauseCallsButton />}
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
            </header>

            {hold && (
                <p role="status" className="flex items-start gap-2 rounded-surface-md border border-warning/40 bg-warning/10 p-3 type-body text-foreground">
                    <CirclePause aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-warning" />
                    <span>{holdReasonText(t, hold, campaign)}</span>
                </p>
            )}

            {live && (
                <p className="type-body text-muted-foreground" aria-live="polite">
                    {t("This page refreshes itself every few seconds.")}
                </p>
            )}

            <CampaignStepper campaign={campaign} hold={hold} />

            {showRender && (
                <SectionCard title={campaign.status === "render_failed" ? t("Audio check failed") : t("Preparing audio")}>
                    <p className="type-body text-muted-foreground">{fmt(t("{done} of {total} clips"), { done: rp.done, total: rp.total })}</p>
                    <Progress value={rp.total > 0 ? (rp.done / rp.total) * 100 : 0} aria-label={t("Audio progress")} className="h-2 bg-muted" />
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
                </SectionCard>
            )}

            {hasIntents && (
                <div className="grid gap-4 2xl:grid-cols-3">
                    <CampaignFunnel campaign={campaign} className="2xl:col-span-2" />
                    <CampaignOutcomes campaign={campaign} />
                </div>
            )}

            <NotCalledSection detail={detail} />
            <WhatParentsHear detail={detail} />
            {hasIntents && <CampaignCallsTable campaign={campaign} pollMs={pollMs} />}
        </div>
    );
}
