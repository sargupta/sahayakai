"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, Check, MessageSquareWarning, Phone, PhoneMissed, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { useLanguage } from "@/context/language-context";
import { studentById, teacherById } from "@/lib/sampark/demo/school";
import { REASON_LABEL } from "@/lib/sampark/demo/script";
import { setFollowUpDone } from "@/lib/sampark/demo/store";
import type { DemoCall, DemoCallback, DemoRole, DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";
import { Panel } from "../console-ui";
import { CallDetailSheet } from "./call-list";
import { CallParentDialog } from "./call-parent-dialog";
import { COMPLAINT_LABEL, COMPLAINT_TONE, SENTIMENT_LABEL, SENTIMENT_TONE, whenLabel } from "./demo-labels";
import { ScheduleCallbackDialog } from "./planning";

/** Latest call per student, so a family reached later is no longer "not reached". */
function latestByStudent(calls: DemoCall[]): Map<string, DemoCall> {
    const m = new Map<string, DemoCall>();
    for (const c of calls) {
        const prev = m.get(c.studentId);
        if (!prev || prev.createdAt < c.createdAt) m.set(c.studentId, c);
    }
    return m;
}

export function FollowUpsBoard({
    calls,
    callbacks,
    viewerRole,
    placedBy,
    holidays,
}: {
    calls: DemoCall[];
    callbacks: DemoCallback[];
    viewerRole: DemoRole;
    placedBy: { role: DemoRole; name: string };
    holidays: string[];
}) {
    const { t } = useLanguage();
    const [openId, setOpenId] = useState<string | null>(null);
    const [scheduling, setScheduling] = useState<{ student: DemoStudent; reason: OutreachReason; callId: string } | null>(null);
    const [calling, setCalling] = useState<{ student: DemoStudent; reason: OutreachReason } | null>(null);
    const [showResolved, setShowResolved] = useState(false);

    const booked = useMemo(() => new Set(callbacks.filter((c) => c.status === "scheduled" || c.status === "proposed").map((c) => c.studentId)), [callbacks]);
    const complaints = calls
        .filter((c) => c.complaintStatus && (showResolved || c.complaintStatus !== "resolved"))
        .sort((a, b) => (a.complaintStatus === "open" ? -1 : 0) - (b.complaintStatus === "open" ? -1 : 0) || b.createdAt.localeCompare(a.createdAt));
    const followUps = calls
        .filter((c) => c.summary?.followUpNeeded && !c.complaintStatus && (showResolved || !c.followUpDone))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = latestByStudent(calls);
    const unreached = [...latest.values()].filter((c) => c.status !== "completed").sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const open = calls.find((c) => c.id === openId) ?? null;

    const Row = ({ c, children }: { c: DemoCall; children?: ReactNode }) => {
        const student = studentById(c.studentId);
        const teacher = teacherById(c.teacherId);
        return (
            <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <button type="button" onClick={() => setOpenId(c.id)} className="focus-ring min-w-0 flex-1 space-y-1 rounded-md text-left">
                    <span className="flex flex-wrap items-center gap-2">
                        {c.complaintStatus && <StatusPill tone={COMPLAINT_TONE[c.complaintStatus]}>{t(COMPLAINT_LABEL[c.complaintStatus])}</StatusPill>}
                        {c.summary && <StatusPill tone={SENTIMENT_TONE[c.summary.parentSentiment]}>{t(SENTIMENT_LABEL[c.summary.parentSentiment])}</StatusPill>}
                        <span className="font-medium text-ink-900">{student?.name}</span>
                        <span className="text-xs text-ink-500">
                            {fmt(t("Class {id}"), { id: c.classId })} · {t(REASON_LABEL[c.reason])}
                            {viewerRole === "admin" && teacher ? ` · ${teacher.name}` : ""} · {whenLabel(c.createdAt)}
                        </span>
                    </span>
                    <span className="block text-sm text-ink-700">
                        {c.summary?.complaintAboutTeacher ?? c.summary?.followUpSuggestion ?? c.summary?.parentResponse ?? fmt(t("{family} did not pick up."), { family: student?.guardian.name ?? "" })}
                    </span>
                    {booked.has(c.studentId) && <span className="block text-xs font-medium text-sampark-indigo">{t("A callback is booked for this parent.")}</span>}
                </button>
                <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
            </li>
        );
    };

    const scheduleBtn = (c: DemoCall) => {
        const student = studentById(c.studentId);
        if (!student || booked.has(c.studentId)) return null;
        return (
            <Button size="sm" variant="outline" onClick={() => setScheduling({ student, reason: c.reason, callId: c.id })}>
                <CalendarClock aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                {t("Schedule callback")}
            </Button>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowResolved((v) => !v)} aria-pressed={showResolved}>
                    {showResolved ? t("Hide handled items") : t("Show handled items")}
                </Button>
            </div>

            <Panel
                tone={complaints.some((c) => c.complaintStatus === "open") ? "alert" : "plain"}
                icon={MessageSquareWarning}
                title={t("Complaints about teachers")}
                description={
                    viewerRole === "admin"
                        ? t("What parents said, recorded as they said it. Nothing here is a finding: review it with the teacher.")
                        : t("What parents said about your class, recorded as they said it. The principal sees these too.")
                }
            >
                {complaints.length === 0 ? (
                    <p className="text-sm text-ink-500">{t("No complaints.")}</p>
                ) : (
                    <ul className="divide-y divide-sampark-line">
                        {complaints.map((c) => (
                            <Row key={c.id} c={c}>
                                <Button size="sm" variant="outline" onClick={() => setOpenId(c.id)}>
                                    {t("Review")}
                                </Button>
                                {scheduleBtn(c)}
                            </Row>
                        ))}
                    </ul>
                )}
            </Panel>

            <Panel tone={followUps.some((c) => !c.followUpDone) ? "live" : "plain"} icon={CalendarClock} title={t("Follow-ups the calls asked for")} description={t("The AI marks a follow-up when a parent asked for something or a promise needs checking.")}>
                {followUps.length === 0 ? (
                    <p className="text-sm text-ink-500">{t("No follow-ups waiting.")}</p>
                ) : (
                    <ul className="divide-y divide-sampark-line">
                        {followUps.map((c) => (
                            <Row key={c.id} c={c}>
                                {scheduleBtn(c)}
                                {c.followUpDone ? (
                                    <Button size="sm" variant="ghost" onClick={() => setFollowUpDone(c.id, false)}>
                                        <Undo2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        {t("Reopen")}
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="ghost" onClick={() => setFollowUpDone(c.id, true)}>
                                        <Check aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                        {t("Mark handled")}
                                    </Button>
                                )}
                            </Row>
                        ))}
                    </ul>
                )}
            </Panel>

            <Panel icon={PhoneMissed} title={t("Parents not reached")} description={t("The last call to these parents was not answered or the line was busy.")}>
                {unreached.length === 0 ? (
                    <p className="text-sm text-ink-500">{t("Every parent was reached on their last call.")}</p>
                ) : (
                    <ul className="divide-y divide-sampark-line">
                        {unreached.map((c) => {
                            const student = studentById(c.studentId);
                            return (
                                <Row key={c.id} c={c}>
                                    {student && (
                                        <Button size="sm" onClick={() => setCalling({ student, reason: c.reason })}>
                                            <Phone aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                            {t("Call again")}
                                        </Button>
                                    )}
                                    {scheduleBtn(c)}
                                </Row>
                            );
                        })}
                    </ul>
                )}
            </Panel>

            <CallDetailSheet call={open} viewerRole={viewerRole} onClose={() => setOpenId(null)} />
            <ScheduleCallbackDialog
                open={Boolean(scheduling)}
                onOpenChange={(o) => !o && setScheduling(null)}
                student={scheduling?.student ?? null}
                reason={scheduling?.reason ?? "behavioral_concern"}
                sourceCallId={scheduling?.callId ?? null}
                placedBy={placedBy}
                holidays={holidays}
            />
            <CallParentDialog student={calling?.student ?? null} initialReason={calling?.reason ?? null} open={Boolean(calling)} onOpenChange={(o) => !o && setCalling(null)} placedBy={placedBy} />
        </div>
    );
}
