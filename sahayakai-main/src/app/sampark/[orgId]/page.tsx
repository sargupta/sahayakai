"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { getOverview } from "@/lib/api/sampark";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { useServerNow, useSamparkFormat } from "@/components/sampark/format";
import { fmt } from "@/components/sampark/labels";
import {
    ActivityFeed,
    CallingWindowCard,
    ComingUpCard,
    FamiliesCard,
    HoursCard,
    LanguagesCard,
    LiveCampaignCard,
    RecordsCard,
    RehearsalActivityNote,
    RehearsalsCard,
    TodayKpis,
    nextSteps,
} from "@/components/sampark/today-cards";

/** How often Today re-reads the overview. The overview reads up to 1000 calls and every family, so it stays at 30 s. */
const OVERVIEW_POLL_MS = 30_000;

/**
 * Today: the campaign calling now, the calling window, real calls to families
 * (with 7-day sparklines), the current mode's calls by hour, by language and as
 * a live feed, families and consent, rehearsals, what is coming up, and the
 * school records. Every number is from one GET overview, polled.
 */
export default function SamparkTodayPage() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { orgId, school } = useSamparkSchool();
    const base = `/sampark/${encodeURIComponent(orgId)}`;
    const query = useSamparkQuery((signal) => getOverview(orgId, { signal }), [orgId], { pollMs: OVERVIEW_POLL_MS });
    const o = query.data;
    // The server's clock, not this device's: the window and the current hour follow the server's rules.
    const now = useServerNow(o?.asOf, OVERVIEW_POLL_MS);

    const header = (
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 space-y-1">
                <p className="type-caption text-muted-foreground">
                    {f.longDate(now)} · {fmt(t("{time} IST"), { time: f.time(now.toISOString()) })}
                </p>
                <h1 className="type-h1 text-foreground">{t("Today")}</h1>
                <p className="type-body text-muted-foreground">
                    {fmt(t("Every call to {school} families today, as it happens."), { school: school.displayName })}
                </p>
            </div>
            <Button asChild className="min-h-11">
                <Link href={`${base}/campaigns/new`}>
                    <Plus aria-hidden="true" />
                    {t("New campaign")}
                </Link>
            </Button>
        </header>
    );

    if (!o) {
        return (
            <div className="space-y-6">
                {header}
                {query.error ? <ErrorPanel error={query.error} onRetry={query.reload} /> : <LoadingBlock rows={4} />}
            </div>
        );
    }

    const steps = nextSteps(t, o, base);

    return (
        <div className="space-y-6">
            {header}
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}

            <div className="grid gap-4 xl:grid-cols-5">
                <LiveCampaignCard overview={o} base={base} className="xl:col-span-3" />
                <CallingWindowCard overview={o} now={now} className="xl:col-span-2" />
            </div>

            <TodayKpis overview={o} />

            <RehearsalActivityNote mode={o.activityMode} />

            <div className="grid gap-4 xl:grid-cols-5">
                <HoursCard overview={o} now={now} className="xl:col-span-3" />
                <LanguagesCard overview={o} className="xl:col-span-2" />
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
                <ActivityFeed overview={o} base={base} className="xl:col-span-3" />
                <FamiliesCard overview={o} steps={steps} className="xl:col-span-2" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <RehearsalsCard overview={o} />
                <ComingUpCard overview={o} base={base} />
                <RecordsCard overview={o} steps={steps} base={base} className="md:col-span-2 2xl:col-span-1" />
            </div>
        </div>
    );
}
