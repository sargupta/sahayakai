"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignFunnel, CampaignStepper } from "@/components/sampark/campaign-detail";
import { CampaignStatusBadge } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { EmptyState } from "@/components/layout";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { demoCalendarEvents } from "@/lib/sampark/demo/calendar";
import { studentById } from "@/lib/sampark/demo/school";
import { demoHolidays } from "@/lib/sampark/demo/seed-planning";
import { updateCallback } from "@/lib/sampark/demo/store";
import type { DemoCallback } from "@/lib/sampark/demo/types";
import { PageHeader, Panel } from "../console-ui";
import { CallParentDialog } from "./call-parent-dialog";
import { CampaignActions, CampaignCard, CampaignOutcomePanel, NewCampaignDialog, audienceText, campaignTitle, factsText } from "./campaigns";
import { whenLabel } from "./demo-labels";
import { FollowUpsBoard } from "./follow-ups";
import { CalendarAndCallbacks } from "./planning";
import type { DemoView } from "./use-demo";

function placedByOf(view: DemoView) {
    return view.role === "admin" ? { role: "admin" as const, name: view.school.admin.name } : { role: "teacher" as const, name: view.teacher?.name ?? "" };
}

export function CalendarPage({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const [calling, setCalling] = useState<DemoCallback | null>(null);
    const holidays = useMemo(() => demoHolidays(view.state.seededAt), [view.state.seededAt]);
    const events = useMemo(
        () => demoCalendarEvents({ callbacks: view.visibleCallbacks, campaigns: view.visibleCampaigns, holidays, now: new Date() }),
        [view.visibleCallbacks, view.visibleCampaigns, holidays],
    );
    const admin = view.role === "admin";
    const student = calling ? studentById(calling.studentId) ?? null : null;
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader
                eyebrow={t("Planning")}
                title={admin ? t("Calendar & callbacks") : t("My calendar")}
                description={
                    admin
                        ? t("Every scheduled call in the school: callbacks, campaign calls, school events and holidays, on one calendar.")
                        : t("Callbacks and notices for your classes, with school events and holidays.")
                }
            />
            <CalendarAndCallbacks
                events={events}
                callbacks={view.visibleCallbacks}
                viewerRole={admin ? "admin" : "teacher"}
                placedBy={placedByOf(view)}
                holidays={holidays}
                campaignHref={(id) => href(admin ? `/demo/admin/campaigns/${id}` : `/demo/teacher/outreach/${id}`)}
                onCallNow={setCalling}
            />
            <CallParentDialog
                student={student}
                initialReason={calling?.reason ?? null}
                open={Boolean(calling)}
                onOpenChange={(o) => !o && setCalling(null)}
                placedBy={placedByOf(view)}
                onSaved={(call) => calling && updateCallback(calling.id, { status: call.status === "completed" ? "completed" : "missed", resultCallId: call.id })}
            />
        </div>
    );
}

export function FollowUpsPage({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const admin = view.role === "admin";
    const holidays = useMemo(() => demoHolidays(view.state.seededAt), [view.state.seededAt]);
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <PageHeader
                eyebrow={t("Monitoring")}
                title={admin ? t("Complaints & follow-ups") : t("Follow-ups")}
                description={
                    admin
                        ? t("What needs a person across the school: parents' complaints, promises to check, and parents not reached.")
                        : t("What your calls asked you to do next, and what parents said about your class.")
                }
            />
            <FollowUpsBoard calls={view.visibleCalls} callbacks={view.visibleCallbacks} viewerRole={admin ? "admin" : "teacher"} placedBy={placedByOf(view)} holidays={holidays} />
        </div>
    );
}

const STATUS_ORDER = { dispatching: 0, scheduled: 1, rendering: 1, draft: 2, render_failed: 3, completed: 4, cancelled: 5 } as const;

export function CampaignsPage({ view }: { view: DemoView }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const admin = view.role === "admin";
    const base = admin ? "/demo/admin/campaigns" : "/demo/teacher/outreach";
    const list = [...view.visibleCampaigns].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <PageHeader
                eyebrow={t("Outreach")}
                title={admin ? t("Campaigns") : t("Class notices")}
                description={
                    admin
                        ? t("Notices every parent in the chosen classes hears in their own language: meetings, events and closures. Drafts wait for your approval.")
                        : t("School notices that reach your classes' parents. The principal approves and runs them.")
                }
                actions={
                    admin ? (
                        <Button onClick={() => setCreating(true)}>
                            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                            {t("New campaign")}
                        </Button>
                    ) : undefined
                }
            />
            {list.length === 0 ? (
                <EmptyState icon={Megaphone} title={t("No notices yet")} description={t("Campaigns for your classes will show here.")} />
            ) : (
                <div className="space-y-3">
                    {list.map((c) => (
                        <CampaignCard key={c.id} c={c} href={href(`${base}/${c.id}`)} canManage={admin} />
                    ))}
                </div>
            )}
            {admin && <NewCampaignDialog open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(href(`${base}/${id}`))} />}
        </div>
    );
}

export function CampaignDetailPage({ view, id }: { view: DemoView; id: string }) {
    const { t } = useLanguage();
    const href = useSamparkHref();
    const admin = view.role === "admin";
    const base = admin ? "/demo/admin/campaigns" : "/demo/teacher/outreach";
    const c = view.visibleCampaigns.find((x) => x.id === id);
    if (!c) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <EmptyState icon={Megaphone} title={t("Campaign not found")} description={t("It may not reach your classes, or the demo was reset.")} />
                <Button asChild variant="outline">
                    <Link href={href(base)}>{t("Back")}</Link>
                </Button>
            </div>
        );
    }
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <Link href={href(base)} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {admin ? t("All campaigns") : t("Class notices")}
            </Link>
            <PageHeader
                title={
                    <span className="inline-flex flex-wrap items-center gap-3">
                        {campaignTitle(t, c)} · {audienceText(t, c)} <CampaignStatusBadge status={c.status} />
                    </span>
                }
                description={`${factsText(t, c)} · ${fmt(t("{n} parents"), { n: c.counts.guardians })} · ${fmt(t("created by {name}"), { name: c.createdByName })}`}
                actions={admin ? <CampaignActions c={c} /> : undefined}
            />
            <Panel>
                <CampaignStepper campaign={c} hold={c.holdReason ?? null} />
            </Panel>
            <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                    <CampaignFunnel campaign={c} className="h-full" />
                </div>
                <div className="lg:col-span-2">
                    <CampaignOutcomePanel c={c} />
                </div>
            </div>
            <Panel tone="notice" title={t("Practice mode")} description={t("This demo school is in Practice: calls are simulated and no phone rings. Approval schedules calls inside calling hours as for a real school; \"Start calling now\" runs the simulation straight away.")}>
                <p className="text-sm text-ink-600">
                    {c.approvedAt ? fmt(t("Approved {when}"), { when: whenLabel(c.approvedAt) }) : t("Not approved yet.")}
                    {c.notBefore ? ` · ${fmt(t("calls from {when}"), { when: whenLabel(c.notBefore) })}` : ""}
                </p>
            </Panel>
        </div>
    );
}
