"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Megaphone, Plus } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { listCampaigns } from "@/lib/api/sampark";
import type { Campaign } from "@/types/sampark";
import { CampaignStatusBadge, StatusPill } from "@/components/sampark/status-pill";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { useSamparkFormat } from "@/components/sampark/format";
import { useCampaignSummary } from "@/components/sampark/campaign-summary";
import { LIVE_CAMPAIGN_STATUSES, effectiveHoldReason, fmt, holdReasonText, purposeLabel } from "@/components/sampark/labels";

function CampaignRow({ campaign, href }: { campaign: Campaign; href: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { school } = useSamparkSchool();
    const { describe } = useCampaignSummary();
    const d = describe(campaign, school);
    const c = campaign.counts;
    const started = campaign.status !== "draft";
    const hold = effectiveHoldReason(campaign, school.pause);

    return (
        <li>
            <Link
                href={href}
                className="group flex flex-col gap-3 rounded-surface-md border border-border bg-card p-4 shadow-soft transition-colors duration-micro ease-out-quart hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"
            >
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="type-body-lg text-foreground">{purposeLabel(t, campaign.purpose)}</span>
                        <CampaignStatusBadge status={campaign.status} />
                        {hold && (
                            <StatusPill tone="warning" title={holdReasonText(t, hold, campaign)}>
                                {t("On hold")}
                            </StatusPill>
                        )}
                    </div>
                    <p className="type-body text-foreground">{d.facts}</p>
                    <p className="type-body text-muted-foreground">
                        {d.audience} · {fmt(t("Created {when}"), { when: f.dateTime(campaign.createdAt) })}
                    </p>
                    {started && (
                        <p className="type-body text-muted-foreground">
                            {fmt(t("{guardians} families · {heard} heard · {confirmed} confirmed · {optOuts} stopped calls"), {
                                guardians: f.number(c.guardians),
                                heard: f.number(c.heardKeyFact),
                                confirmed: f.number(c.confirmedYes),
                                optOuts: f.number(c.optOuts),
                            })}
                        </p>
                    )}
                </div>
                <ChevronRight aria-hidden="true" className="hidden h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground sm:block" />
            </Link>
        </li>
    );
}

export default function SamparkCampaignsPage() {
    const { t } = useLanguage();
    const { orgId } = useSamparkSchool();
    const base = `/sampark/${encodeURIComponent(orgId)}/campaigns`;

    // Refresh every 10 s while any campaign is rendering or calling.
    const [pollMs, setPollMs] = useState<number | null>(null);
    const query = useSamparkQuery((signal) => listCampaigns(orgId, { signal }), [orgId], { pollMs });
    const campaigns = query.data;
    const anyLive = campaigns?.some((c) => LIVE_CAMPAIGN_STATUSES.includes(c.status)) ?? false;
    useEffect(() => setPollMs(anyLive ? 10_000 : null), [anyLive]);

    const sorted = campaigns ? [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

    return (
        <SectionCard
            title={t("Campaigns")}
            description={t("A campaign calls a group of families with one notice. You approve it before any call goes out.")}
            action={
                <Button asChild>
                    <Link href={`${base}/new`}>
                        <Plus aria-hidden="true" />
                        {t("New campaign")}
                    </Link>
                </Button>
            }
        >
            {!campaigns && query.loading && <LoadingBlock rows={3} />}
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}
            {campaigns && campaigns.length === 0 && (
                <EmptyState
                    icon={Megaphone}
                    title={t("No campaigns yet")}
                    description={t("Start with a PTM invitation, an event invitation or an emergency closure. You will hear exactly what parents hear before you approve.")}
                    cta={{ label: t("New campaign"), href: `${base}/new` }}
                />
            )}
            {sorted.length > 0 && (
                <ul className="space-y-3">
                    {sorted.map((c) => (
                        <CampaignRow key={c.id} campaign={c} href={`${base}/${encodeURIComponent(c.id)}`} />
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
