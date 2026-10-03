"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PhoneCall, RefreshCw } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { listCalls, listCampaigns } from "@/lib/api/sampark";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import type { CallLogEntry, CallState } from "@/types/sampark";
import { CallStateBadge, HeardBadge, StatusPill } from "@/components/sampark/status-pill";
import { ErrorPanel, LoadingBlock } from "@/components/sampark/states";
import { useSamparkQuery } from "@/components/sampark/use-sampark-query";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { useSamparkFormat } from "@/components/sampark/format";
import { useCampaignSummary } from "@/components/sampark/campaign-summary";
import {
    HEARD_LEVELS,
    callStateLabel,
    callStateMeaning,
    fmt,
    heardLabel,
    heardMeaning,
    outcomeLabel,
    purposeLabel,
    variantLabel,
} from "@/components/sampark/labels";

const ALL = "__all__";
const CALL_LIMIT = 200;
const LEGEND_STATES: CallState[] = ["completed", "no_answer", "busy", "failed", "unknown"];

function Duration({ call }: { call: CallLogEntry }) {
    const { t } = useLanguage();
    if (call.durationSeconds === null && call.billedSeconds === null) return <span className="text-muted-foreground">—</span>;
    return (
        <span>
            {call.durationSeconds !== null ? fmt(t("{seconds} s"), { seconds: call.durationSeconds }) : "—"}
            {call.billedSeconds !== null && (
                <span className="text-muted-foreground"> · {fmt(t("billed {seconds} s"), { seconds: call.billedSeconds })}</span>
            )}
        </span>
    );
}

function Outcome({ call }: { call: CallLogEntry }) {
    const { t } = useLanguage();
    const o = outcomeLabel(t, call);
    return o ? <StatusPill tone={o.tone}>{o.label}</StatusPill> : null;
}

function Family({ call }: { call: CallLogEntry }) {
    const { t } = useLanguage();
    return (
        <div className="min-w-0">
            <p className="text-foreground break-words">{call.guardianDisplayName}</p>
            {call.studentDisplayNames.length > 0 && (
                <p className="text-muted-foreground break-words">{call.studentDisplayNames.join(", ")}</p>
            )}
            <p className="text-xs leading-normal text-muted-foreground">
                {fmt(t("Phone ending {last4}"), { last4: call.phoneLast4 })}
                {call.carrier === "simulated" && <> · {t("Simulated")}</>}
            </p>
            <p className="text-xs leading-normal text-muted-foreground">
                {call.callerId ? fmt(t("Parent sees {number}"), { number: call.callerId }) : t("Calling number not set")}
            </p>
        </div>
    );
}

function Language({ call }: { call: CallLogEntry }) {
    const { t } = useLanguage();
    const info = PARENT_LANGUAGE_INFO[call.language];
    const v = variantLabel(t, call.variant);
    return (
        <span>
            <span lang={info?.code}>{info?.nativeLabel ?? call.language}</span>
            {v && <span className="block text-xs leading-normal text-muted-foreground">{v}</span>}
        </span>
    );
}

function Keys({ call }: { call: CallLogEntry }) {
    return call.outcome.digits ? (
        <span className="font-mono text-foreground">{call.outcome.digits.split("").join(" ")}</span>
    ) : (
        <span className="text-muted-foreground">—</span>
    );
}

function CallsTable({ calls }: { calls: CallLogEntry[] }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    return (
        <>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-surface-md border border-border md:block">
                <table className="w-full text-left type-body">
                    <caption className="sr-only">{t("Call log")}</caption>
                    <thead className="bg-muted/30">
                        <tr className="border-b border-border">
                            {[t("Time"), t("Family"), t("Language"), t("Result"), t("What they heard"), t("Keys pressed"), t("Duration"), t("Attempt")].map((h) => (
                                <th key={h} scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {calls.map((c) => (
                            <tr key={c.id} className="border-b border-border align-top last:border-b-0">
                                <td className="px-3 py-3 whitespace-nowrap text-foreground">{f.dateTime(c.createdAt)}</td>
                                <td className="px-3 py-3"><Family call={c} /></td>
                                <td className="px-3 py-3 text-foreground"><Language call={c} /></td>
                                <td className="px-3 py-3">
                                    <div className="flex flex-col items-start gap-1">
                                        <CallStateBadge state={c.state} />
                                        <Outcome call={c} />
                                    </div>
                                </td>
                                <td className="px-3 py-3"><HeardBadge heard={c.outcome.heard} /></td>
                                <td className="px-3 py-3"><Keys call={c} /></td>
                                <td className="px-3 py-3 whitespace-nowrap text-foreground"><Duration call={c} /></td>
                                <td className="px-3 py-3 text-foreground">{c.attempt}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile: cards */}
            <ul className="space-y-3 md:hidden">
                {calls.map((c) => (
                    <li key={c.id} className="rounded-surface-md border border-border bg-card p-4 space-y-3 type-body">
                        <div className="flex items-start justify-between gap-3">
                            <Family call={c} />
                            <span className="shrink-0 text-xs leading-normal text-muted-foreground">{f.dateTime(c.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <CallStateBadge state={c.state} />
                            <HeardBadge heard={c.outcome.heard} />
                            <Outcome call={c} />
                        </div>
                        <dl className="grid grid-cols-2 gap-2">
                            <div>
                                <dt className="text-xs leading-normal text-muted-foreground">{t("Language")}</dt>
                                <dd className="text-foreground"><Language call={c} /></dd>
                            </div>
                            <div>
                                <dt className="text-xs leading-normal text-muted-foreground">{t("Keys pressed")}</dt>
                                <dd><Keys call={c} /></dd>
                            </div>
                            <div>
                                <dt className="text-xs leading-normal text-muted-foreground">{t("Duration")}</dt>
                                <dd className="text-foreground"><Duration call={c} /></dd>
                            </div>
                            <div>
                                <dt className="text-xs leading-normal text-muted-foreground">{t("Attempt")}</dt>
                                <dd className="text-foreground">{c.attempt}</dd>
                            </div>
                        </dl>
                    </li>
                ))}
            </ul>
        </>
    );
}

function Legend() {
    const { t } = useLanguage();
    return (
        <details className="rounded-surface-md border border-border bg-muted/30 p-3">
            <summary className="cursor-pointer type-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-surface-sm">
                {t("What these results mean")}
            </summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
                <dl className="space-y-2">
                    {LEGEND_STATES.map((s) => (
                        <div key={s}>
                            <dt className="type-body font-medium text-foreground">{callStateLabel(t, s)}</dt>
                            <dd className="type-body text-muted-foreground">{callStateMeaning(t, s)}</dd>
                        </div>
                    ))}
                </dl>
                <dl className="space-y-2">
                    {HEARD_LEVELS.map((h) => (
                        <div key={h}>
                            <dt className="type-body font-medium text-foreground">{heardLabel(t, h)}</dt>
                            <dd className="type-body text-muted-foreground">{heardMeaning(t, h)}</dd>
                        </div>
                    ))}
                    <div>
                        <dt className="type-body font-medium text-foreground">{t("Keys pressed")}</dt>
                        <dd className="type-body text-muted-foreground">{t("1 and 2 are the answers offered in the message. 9 asks the school to stop these calls, and a second 9 confirms it.")}</dd>
                    </div>
                </dl>
            </div>
        </details>
    );
}

function CallsContent() {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const router = useRouter();
    const pathname = usePathname() ?? "";
    const searchParams = useSearchParams();
    const campaignId = searchParams?.get("campaignId") ?? "";
    const { orgId, school } = useSamparkSchool();
    const summary = useCampaignSummary();

    const campaignsQuery = useSamparkQuery((signal) => listCampaigns(orgId, { signal }), [orgId]);
    const callsQuery = useSamparkQuery(
        (signal) => listCalls(orgId, { campaignId: campaignId || undefined, limit: CALL_LIMIT }, { signal }),
        [orgId, campaignId],
    );

    const campaignOptions = useMemo(
        () =>
            [...(campaignsQuery.data ?? [])]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((c) => ({ id: c.id, label: `${purposeLabel(t, c.purpose)} · ${summary.facts(c.facts, school)}` })),
        [campaignsQuery.data, t, summary, school],
    );

    const setCampaign = (value: string) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (value === ALL) params.delete("campaignId");
        else params.set("campaignId", value);
        const q = params.toString();
        router.replace(q ? `${pathname}?${q}` : pathname);
    };

    const calls = callsQuery.data
        ? [...callsQuery.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : undefined;

    return (
        <SectionCard
            title={t("Calls")}
            description={t("Every call attempt, what the family heard, and what they pressed. Newest first.")}
            action={
                <Button type="button" variant="outline" size="sm" onClick={callsQuery.reload} disabled={callsQuery.loading}>
                    <RefreshCw aria-hidden="true" className={callsQuery.loading ? "animate-spin" : undefined} />
                    {t("Refresh")}
                </Button>
            }
        >
            <div className="space-y-2">
                <Label htmlFor="calls-campaign">{t("Campaign")}</Label>
                <Select value={campaignId || ALL} onValueChange={setCampaign}>
                    <SelectTrigger id="calls-campaign" className="md:w-96">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t("All campaigns")}</SelectItem>
                        {campaignOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                        ))}
                        {campaignId && !campaignOptions.some((c) => c.id === campaignId) && (
                            <SelectItem value={campaignId}>{t("Selected campaign")}</SelectItem>
                        )}
                    </SelectContent>
                </Select>
            </div>

            <Legend />

            {!calls && callsQuery.loading && <LoadingBlock rows={4} />}
            {callsQuery.error && <ErrorPanel error={callsQuery.error} onRetry={callsQuery.reload} />}
            {calls && calls.length === 0 && (
                <EmptyState
                    icon={PhoneCall}
                    title={t("No calls yet")}
                    description={t("Calls appear here once an approved campaign starts calling inside the calling window.")}
                />
            )}
            {calls && calls.length > 0 && (
                <>
                    <p className="type-body text-muted-foreground">
                        {calls.length >= CALL_LIMIT
                            ? fmt(t("Showing the latest {count} calls."), { count: f.number(calls.length) })
                            : fmt(t("{count} calls"), { count: f.number(calls.length) })}
                    </p>
                    <CallsTable calls={calls} />
                </>
            )}
        </SectionCard>
    );
}

export default function SamparkCallsPage() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <CallsContent />
        </Suspense>
    );
}
