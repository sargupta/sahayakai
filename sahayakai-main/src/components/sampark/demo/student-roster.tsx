"use client";

import { useMemo, useState } from "react";
import { Phone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { useLanguage } from "@/context/language-context";
import { studentSignals } from "@/lib/sampark/demo/school";
import { REASON_LABEL } from "@/lib/sampark/demo/script";
import type { DemoCall, DemoClass, DemoStudent } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, whenLabel } from "./demo-labels";

/**
 * Students of the given classes, with the signals a teacher acts on
 * (absences, falling scores, a behaviour note, an achievement) and a Call
 * button. Students who need a call come first.
 */
export function StudentRoster({
    classes,
    students,
    calls,
    onCall,
    showClass = false,
}: {
    classes: DemoClass[];
    students: DemoStudent[];
    calls: DemoCall[];
    onCall: (student: DemoStudent, reason: OutreachReason | null) => void;
    showClass?: boolean;
}) {
    const { t } = useLanguage();
    const [query, setQuery] = useState("");
    const [onlyFlagged, setOnlyFlagged] = useState(false);

    const lastCall = useMemo(() => {
        const m = new Map<string, DemoCall>();
        for (const c of calls) if (!m.has(c.studentId) || m.get(c.studentId)!.createdAt < c.createdAt) m.set(c.studentId, c);
        return m;
    }, [calls]);

    const rows = useMemo(() => {
        const ids = new Set(classes.map((c) => c.id));
        const q = query.trim().toLowerCase();
        return students
            .filter((s) => ids.has(s.classId))
            .map((s) => ({ s, signals: studentSignals(s) }))
            .filter(({ s, signals }) => (!onlyFlagged || signals.length > 0) && (!q || s.name.toLowerCase().includes(q) || s.guardian.name.toLowerCase().includes(q)))
            .sort((a, b) => b.signals.length - a.signals.length || a.s.classId.localeCompare(b.s.classId) || a.s.roll - b.s.roll);
    }, [classes, students, query, onlyFlagged]);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                    <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search a student or parent")} className="pl-9" aria-label={t("Search a student or parent")} />
                </div>
                <Button size="sm" variant={onlyFlagged ? "default" : "outline"} onClick={() => setOnlyFlagged((v) => !v)} aria-pressed={onlyFlagged}>
                    {t("Needs a call")}
                </Button>
                <span className="text-sm text-ink-500">{fmt(t("{count} students"), { count: rows.length })}</span>
            </div>

            <ul className="divide-y divide-sampark-line overflow-hidden rounded-xl border border-sampark-line bg-card">
                {rows.map(({ s, signals }) => {
                    const last = lastCall.get(s.id);
                    return (
                        <li key={s.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-ink-900">{s.name}</span>
                                    {showClass && <span className="text-xs text-ink-500">{fmt(t("Class {id}"), { id: s.classId })}</span>}
                                    <span className="text-xs text-ink-500">· {fmt(t("Roll {n}"), { n: s.roll })}</span>
                                </p>
                                <p className="text-xs text-ink-500">
                                    {s.guardian.name} ({t(s.guardian.relation)}) · {s.guardian.language === "hi" ? t("Hindi") : t("English")} ·{" "}
                                    {fmt(t("{pct}% attendance"), { pct: s.attendancePct })} · {fmt(t("tests {score}/100"), { score: s.recentScore })}
                                </p>
                                {(signals.length > 0 || last) && (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {signals.map((sig) => (
                                            <button
                                                key={sig.reason}
                                                type="button"
                                                onClick={() => onCall(s, sig.reason)}
                                                className="focus-ring rounded-pill"
                                                title={t(REASON_LABEL[sig.reason])}
                                            >
                                                <StatusPill tone={sig.reason === "positive_feedback" ? "success" : sig.reason === "behavioral_concern" ? "danger" : "warning"}>
                                                    {t(sig.label)}
                                                </StatusPill>
                                            </button>
                                        ))}
                                        {last && (
                                            <StatusPill tone={last.complaintStatus === "open" ? "danger" : "neutral"}>
                                                {fmt(t("Last call: {status}, {when}"), { status: t(STATUS_LABEL[last.status]), when: whenLabel(last.createdAt) })}
                                            </StatusPill>
                                        )}
                                    </div>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant={signals.length > 0 ? "default" : "outline"}
                                className={cn("shrink-0 self-start sm:self-center")}
                                onClick={() => onCall(s, signals[0]?.reason ?? null)}
                            >
                                <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
                                {t("Call parent")}
                            </Button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
