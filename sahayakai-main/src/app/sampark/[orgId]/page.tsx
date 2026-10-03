"use client";

import Link from "next/link";
import {
    ArrowRight,
    CheckCircle2,
    Clock,
    Database,
    Ear,
    Megaphone,
    PhoneCall,
    PhoneOff,
    ShieldCheck,
    Users,
} from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { getOverview } from "@/lib/api/sampark";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { PARENT_LANGUAGES, type SamparkOverview } from "@/types/sampark";
import { KpiTile } from "@/components/sampark/kpi-tile";
import { ImportStatusBadge, StatusPill } from "@/components/sampark/status-pill";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { hourLabel, useSamparkFormat } from "@/components/sampark/format";
import { fmt, languageName } from "@/components/sampark/labels";

interface NextStep {
    key: string;
    text: string;
    href: string;
    action: string;
}

function nextSteps(t: (k: string) => string, o: SamparkOverview, base: string): NextStep[] {
    const steps: NextStep[] = [];
    if (!o.school.crm) {
        steps.push({ key: "connect", text: t("Connect your school records so Sampark knows your classes and families."), href: `${base}/settings`, action: t("Connect records") });
    } else if (!o.lastImport) {
        steps.push({ key: "import", text: t("Import your school data. Nothing can be sent until families are imported."), href: `${base}/settings`, action: t("Import now") });
    } else if (o.lastImport.status === "failed") {
        steps.push({ key: "import-failed", text: t("The last import failed. Check the rejected rows and import again."), href: `${base}/settings`, action: t("See import") });
    }
    const noConsent = o.guardians.total - o.guardians.withNoticesConsent;
    if (o.guardians.total > 0 && noConsent > 0) {
        steps.push({
            key: "consent",
            text: fmt(t("{count} families have no consent recorded for recorded notices. They will not be called."), { count: noConsent }),
            href: `${base}/families`,
            action: t("Review families"),
        });
    }
    const unknownLang = o.guardians.byLanguage.unknown ?? 0;
    if (unknownLang > 0) {
        steps.push({
            key: "language",
            text: fmt(t("{count} families have no language recorded."), { count: unknownLang }),
            href: `${base}/families?language=unknown`,
            action: t("Record languages"),
        });
    }
    if (o.guardians.total > 0 && o.activeCampaigns === 0) {
        steps.push({ key: "campaign", text: t("No campaign is running. Invite families to a PTM or an event, or send an emergency closure."), href: `${base}/campaigns/new`, action: t("New campaign") });
    }
    return steps;
}

export default function SamparkTodayPage() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { orgId } = useSamparkSchool();
    const base = `/sampark/${encodeURIComponent(orgId)}`;
    const query = useSamparkQuery((signal) => getOverview(orgId, { signal }), [orgId], { pollMs: 30_000 });
    const o = query.data;

    if (!o) {
        if (query.error) return <ErrorPanel error={query.error} onRetry={query.reload} />;
        return <LoadingBlock rows={4} />;
    }

    const w = o.school.callingWindow;
    const steps = nextSteps(t, o, base);
    const langs = [...PARENT_LANGUAGES, "unknown"] as const;

    return (
        <div className="space-y-6">
            {query.error && <ErrorPanel error={query.error} onRetry={query.reload} />}

            {steps.length > 0 && (
                <SectionCard title={t("Next steps")} icon={ArrowRight}>
                    <ul className="space-y-3">
                        {steps.map((s) => (
                            <li key={s.key} className="flex flex-col gap-2 rounded-surface-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="type-body text-foreground">{s.text}</p>
                                <Button asChild variant="outline" size="sm" className="shrink-0">
                                    <Link href={s.href}>{s.action}</Link>
                                </Button>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            )}

            <section aria-label={t("Today")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiTile icon={PhoneCall} label={t("Calls today")} value={f.number(o.today.calls)} />
                <KpiTile
                    icon={Ear}
                    label={t("Heard the key fact")}
                    value={f.number(o.today.heardKeyFact)}
                    sub={o.today.calls > 0 ? fmt(t("{percent} of calls"), { percent: f.percent(o.today.heardKeyFact, o.today.calls) }) : undefined}
                    emphasis="success"
                />
                <KpiTile icon={CheckCircle2} label={t("Confirmed (pressed 1)")} value={f.number(o.today.confirmedYes)} />
                <KpiTile
                    icon={PhoneOff}
                    label={t("Asked to stop calls")}
                    value={f.number(o.today.optOuts)}
                    emphasis={o.today.optOuts > 0 ? "warning" : "default"}
                />
            </section>

            <div className="grid gap-6 md:grid-cols-2">
                <SectionCard title={t("Calling window")} icon={Clock}>
                    <div className="flex flex-wrap items-center gap-2">
                        {o.windowOpenNow ? (
                            <StatusPill tone="success">{t("Open now")}</StatusPill>
                        ) : (
                            <StatusPill tone="neutral">{t("Closed now")}</StatusPill>
                        )}
                        <span className="type-body text-foreground">
                            {fmt(t("{start} to {end} IST"), { start: hourLabel(w.startHour), end: hourLabel(w.endHour) })}
                        </span>
                    </div>
                    {!o.windowOpenNow && o.nextWindowOpensAt && (
                        <p className="type-body text-muted-foreground">
                            {fmt(t("Next opens {when}"), { when: f.dateTime(o.nextWindowOpensAt) })}
                        </p>
                    )}
                    {w.offDays.length > 0 && (
                        <p className="type-body text-muted-foreground">
                            {fmt(t("No routine calls on {days}"), { days: w.offDays.map((d) => f.weekday(d)).join(", ") })}
                        </p>
                    )}
                    <p className="type-body text-muted-foreground">
                        {t("Emergency closures may call from 6 am to 9 pm on any day.")}
                    </p>
                </SectionCard>

                <SectionCard title={t("Campaigns")} icon={Megaphone}>
                    <p className="type-body text-foreground">
                        {fmt(t("{count} active campaigns"), { count: o.activeCampaigns })}
                    </p>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`${base}/campaigns`}>{t("See campaigns")}</Link>
                    </Button>
                </SectionCard>
            </div>

            <SectionCard title={t("Families")} icon={Users}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <KpiTile label={t("Families")} value={f.number(o.guardians.total)} />
                    <KpiTile
                        icon={ShieldCheck}
                        label={t("Consent for recorded notices")}
                        value={f.percent(o.guardians.withNoticesConsent, o.guardians.total)}
                        sub={fmt(t("{count} of {total} families"), { count: f.number(o.guardians.withNoticesConsent), total: f.number(o.guardians.total) })}
                    />
                    <KpiTile
                        icon={PhoneOff}
                        label={t("Calls stopped")}
                        value={f.number(o.guardians.suppressed)}
                        sub={t("Families who asked to stop calls")}
                    />
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-medium leading-normal text-muted-foreground">{t("Families by language")}</p>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {langs.map((lang) => {
                            const count = o.guardians.byLanguage[lang] ?? 0;
                            const info = lang === "unknown" ? null : PARENT_LANGUAGE_INFO[lang];
                            return (
                                <li key={lang} className="rounded-surface-md border border-border bg-muted/30 p-3 space-y-1">
                                    <p className="type-body text-foreground">
                                        {info ? <span lang={info.code}>{info.nativeLabel}</span> : languageName(t, "unknown")}
                                    </p>
                                    <p className="font-headline text-lg font-semibold leading-normal text-foreground">{f.number(count)}</p>
                                    <p className="text-xs leading-normal text-muted-foreground">{f.percent(count, o.guardians.total)}</p>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </SectionCard>

            <SectionCard title={t("Last import")} icon={Database}>
                {o.lastImport ? (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <ImportStatusBadge status={o.lastImport.status} />
                            {o.lastImport.finishedAt && (
                                <span className="type-body text-muted-foreground">{f.dateTime(o.lastImport.finishedAt)}</span>
                            )}
                        </div>
                        <p className="type-body text-foreground">
                            {fmt(t("{students} students, {guardians} guardians, {rejected} rejected rows"), {
                                students: f.number(o.lastImport.counts.students),
                                guardians: f.number(o.lastImport.counts.guardians),
                                rejected: f.number(o.lastImport.counts.rejected),
                            })}
                        </p>
                    </div>
                ) : (
                    <p className="type-body text-muted-foreground">{t("No import yet.")}</p>
                )}
                <Button asChild variant="outline" size="sm">
                    <Link href={`${base}/settings`}>{t("Import settings")}</Link>
                </Button>
            </SectionCard>
        </div>
    );
}
