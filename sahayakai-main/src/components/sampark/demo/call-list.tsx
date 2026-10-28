"use client";

import { useMemo, useState } from "react";
import { ChevronRight, PhoneOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/layout";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { useLanguage } from "@/context/language-context";
import { classById, studentById, teacherById } from "@/lib/sampark/demo/school";
import { DEMO_REASONS, REASON_LABEL } from "@/lib/sampark/demo/script";
import type { DemoCall, DemoRole, DemoTeacher } from "@/lib/sampark/demo/types";
import { CallSummaryView, Transcript } from "./call-summary";
import { COMPLAINT_LABEL, COMPLAINT_TONE, SENTIMENT_LABEL, SENTIMENT_TONE, STATUS_LABEL, STATUS_TONE, needsAttention, whenLabel } from "./demo-labels";

const ALL = "__all__";
export type CallFilter = "all" | "attention" | "complaints" | "upset" | "unreached";

const FILTERS: { key: CallFilter; label: string }[] = [
    { key: "all", label: "All calls" },
    { key: "attention", label: "Needs follow-up" },
    { key: "complaints", label: "Complaints" },
    { key: "upset", label: "Upset parents" },
    { key: "unreached", label: "Not reached" },
];

function matches(c: DemoCall, f: CallFilter): boolean {
    switch (f) {
        case "attention":
            return needsAttention(c);
        case "complaints":
            return Boolean(c.complaintStatus);
        case "upset":
            return c.summary?.parentSentiment === "upset";
        case "unreached":
            return c.status !== "completed";
        default:
            return true;
    }
}

export function CallDetailSheet({ call, viewerRole, onClose }: { call: DemoCall | null; viewerRole: DemoRole; onClose: () => void }) {
    const { t } = useLanguage();
    const student = call ? studentById(call.studentId) : undefined;
    const teacher = call ? teacherById(call.teacherId) : undefined;
    return (
        <Sheet open={Boolean(call)} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[min(640px,100vw)] overflow-y-auto sm:max-w-none">
                {call && (
                    <>
                        <SheetHeader>
                            <SheetTitle>
                                {fmt(t("{reason} · {student}"), { reason: t(REASON_LABEL[call.reason]), student: student?.name ?? call.studentId })}
                            </SheetTitle>
                            <SheetDescription>
                                {whenLabel(call.createdAt)} · {fmt(t("Class {id}"), { id: call.classId })} · {student?.guardian.name} ·{" "}
                                {call.placedBy.role === "admin" ? fmt(t("placed by {name} (principal)"), { name: call.placedBy.name }) : fmt(t("placed by {name}"), { name: call.placedBy.name })}
                                {call.status === "completed" && ` · ${fmt(t("{min} min {sec} s"), { min: Math.floor(call.durationSeconds / 60), sec: call.durationSeconds % 60 })}`}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="mt-4 space-y-5">
                            <div className="rounded-field bg-milk-300 px-3 py-2 text-sm text-ink-800">
                                <span className="font-medium">{fmt(t("{teacher}'s note"), { teacher: teacher?.name ?? "" })}: </span>
                                {call.note}
                            </div>
                            <CallSummaryView call={call} viewerRole={viewerRole} />
                            {call.transcript.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t("Transcript")}</p>
                                    <Transcript turns={call.transcript} />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

export function CallList({
    calls,
    viewerRole,
    teachers,
    initialFilter = "all",
}: {
    calls: DemoCall[];
    viewerRole: DemoRole;
    /** Admin only: offer a filter by teacher. */
    teachers?: DemoTeacher[];
    initialFilter?: CallFilter;
}) {
    const { t } = useLanguage();
    const [filter, setFilter] = useState<CallFilter>(initialFilter);
    const [teacherId, setTeacherId] = useState(ALL);
    const [reason, setReason] = useState(ALL);
    const [openId, setOpenId] = useState<string | null>(null);

    const rows = useMemo(
        () =>
            calls
                .filter((c) => matches(c, filter) && (teacherId === ALL || c.teacherId === teacherId) && (reason === ALL || c.reason === reason))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        [calls, filter, teacherId, reason],
    );
    const open = calls.find((c) => c.id === openId) ?? null;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("Show")}>
                    {FILTERS.map((f) => {
                        const count = calls.filter((c) => matches(c, f.key)).length;
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                aria-pressed={filter === f.key}
                                className={
                                    "focus-ring rounded-pill border px-3 py-1.5 text-sm transition-colors " +
                                    (filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface-glass text-ink-700 hover:bg-milk-300")
                                }
                            >
                                {t(f.label)} <span className="opacity-70">{count}</span>
                            </button>
                        );
                    })}
                </div>
                {teachers && (
                    <div className="space-y-1">
                        <Label className="text-xs">{t("Teacher")}</Label>
                        <Select value={teacherId} onValueChange={setTeacherId}>
                            <SelectTrigger className="w-[190px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>{t("All teachers")}</SelectItem>
                                {teachers.map((tc) => (
                                    <SelectItem key={tc.id} value={tc.id}>
                                        {tc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-1">
                    <Label className="text-xs">{t("Reason")}</Label>
                    <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>{t("All reasons")}</SelectItem>
                            {DEMO_REASONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                    {t(REASON_LABEL[r])}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {rows.length === 0 ? (
                <EmptyState icon={PhoneOff} title={t("No calls here")} description={t("Try another filter, or place a call from the class list.")} />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-surface-md border border-border bg-surface-glass">
                    {rows.map((c) => {
                        const student = studentById(c.studentId);
                        const cls = classById(c.classId);
                        const teacher = teacherById(c.teacherId);
                        return (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => setOpenId(c.id)}
                                    className="focus-ring flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-milk-300"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium text-ink-900">{student?.name}</span>
                                            <span className="text-xs text-ink-500">
                                                {cls?.name} · {t(REASON_LABEL[c.reason])}
                                                {viewerRole === "admin" && teacher ? ` · ${teacher.name}` : ""}
                                                {c.placedBy.role === "admin" ? ` · ${t("by the principal")}` : ""}
                                            </span>
                                        </p>
                                        {c.summary && <p className="line-clamp-2 text-sm text-ink-600">{c.summary.parentResponse}</p>}
                                        <div className="flex flex-wrap gap-1.5">
                                            <StatusPill tone={STATUS_TONE[c.status]}>{t(STATUS_LABEL[c.status])}</StatusPill>
                                            {c.summary && <StatusPill tone={SENTIMENT_TONE[c.summary.parentSentiment]}>{t(SENTIMENT_LABEL[c.summary.parentSentiment])}</StatusPill>}
                                            {c.complaintStatus && <StatusPill tone={COMPLAINT_TONE[c.complaintStatus]}>{t(COMPLAINT_LABEL[c.complaintStatus])}</StatusPill>}
                                            {c.summary?.followUpNeeded && !c.complaintStatus && <StatusPill tone="info">{t("Follow-up needed")}</StatusPill>}
                                        </div>
                                    </div>
                                    <span className="hidden shrink-0 text-xs text-ink-500 sm:block">{whenLabel(c.createdAt)}</span>
                                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <CallDetailSheet call={open} viewerRole={viewerRole} onClose={() => setOpenId(null)} />
        </div>
    );
}
