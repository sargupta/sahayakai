"use client";

import { useMemo, useState } from "react";
import { Phone, Search, SearchX } from "lucide-react";
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

type Row = { s: DemoStudent; signals: ReturnType<typeof studentSignals> };

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/**
 * Students of the given classes, with the signals a teacher acts on
 * (absences, falling scores, a behaviour note, an achievement) and a Call
 * button. Two groups: "Needs a call" (any signal) first, then the rest of
 * the class — each with its count, so the teacher sees at a glance who to
 * call next.
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

    const flagged = rows.filter((r) => r.signals.length > 0);
    const rest = rows.filter((r) => r.signals.length === 0);

    const renderRow = ({ s, signals }: Row) => {
        const last = lastCall.get(s.id);
        const needsCall = signals.length > 0;
        return (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-4 transition-colors duration-micro hover:bg-milk-200 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                        aria-hidden="true"
                        className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-sm font-semibold",
                            needsCall ? "bg-sampark-peach text-sampark-saffron-strong ring-1 ring-sampark-peach-border" : "bg-milk-300 text-ink-600",
                        )}
                    >
                        {initials(s.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-medium text-ink-900">{s.name}</span>
                            {showClass && <span className="text-xs text-ink-500">{fmt(t("Class {id}"), { id: s.classId })}</span>}
                            <span className="text-xs text-ink-500">· {fmt(t("Roll {n}"), { n: s.roll })}</span>
                        </p>
                        {s.rosterContact ? (
                            <p className="mt-0.5 text-sm text-ink-500">
                                {t("Sample contact")} · {fmt(t("phone ending {last4}"), { last4: s.guardian.phoneLast4 })} ·{" "}
                                {s.rosterContact.realCall ? t("real Riya call") : s.rosterContact.notAllowListed ? t("not on the call allow-list · a call is refused") : t("Practice call · nothing rings")}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-sm text-ink-500">
                                {s.guardian.name} ({t(s.guardian.relation)}) · {s.guardian.language === "hi" ? t("Hindi") : t("English")} ·{" "}
                                {fmt(t("{pct}% attendance"), { pct: s.attendancePct })} · {fmt(t("tests {score}/100"), { score: s.recentScore })}
                            </p>
                        )}
                        {(signals.length > 0 || last) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
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
                </div>
                <Button
                    size="sm"
                    variant={needsCall ? "default" : "outline"}
                    className="shrink-0 self-start sm:self-center"
                    onClick={() => onCall(s, signals[0]?.reason ?? null)}
                >
                    <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
                    {s.rosterContact ? fmt(t("Call {name}"), { name: s.name }) : t("Call Parent")}
                </Button>
            </li>
        );
    };

    const group = (title: string, list: Row[], tone: "attention" | "rest") =>
        list.length > 0 && (
            <section aria-label={`${title} (${list.length})`} className="space-y-2">
                <h3 className="flex items-center gap-2 px-1 text-sm font-semibold text-ink-800">
                    <span className={cn("h-2 w-2 rounded-pill", tone === "attention" ? "bg-sampark-saffron" : "bg-ink-400")} aria-hidden="true" />
                    {title}
                    <span className="rounded-pill bg-milk-300 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-600">{list.length}</span>
                </h3>
                <ul className="divide-y divide-sampark-line overflow-hidden rounded-row border border-sampark-line bg-card shadow-sampark-card">
                    {list.map(renderRow)}
                </ul>
            </section>
        );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-52 flex-1">
                    <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search a student or parent")} className="pl-9" aria-label={t("Search a student or parent")} />
                </div>
                <Button size="sm" variant={onlyFlagged ? "default" : "outline"} onClick={() => setOnlyFlagged((v) => !v)} aria-pressed={onlyFlagged}>
                    {t("Needs a call")}
                </Button>
                <span className="text-sm text-ink-500" aria-live="polite">{fmt(t("{count} students"), { count: rows.length })}</span>
            </div>

            {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-row border border-dashed border-sampark-line bg-card px-4 py-10 text-center">
                    <SearchX aria-hidden="true" className="h-6 w-6 text-ink-400" />
                    <p className="text-sm text-ink-600">{t("No students match your search.")}</p>
                </div>
            ) : (
                <>
                    {group(t("Needs a call"), flagged, "attention")}
                    {group(t("Rest of the class"), rest, "rest")}
                </>
            )}
        </div>
    );
}
