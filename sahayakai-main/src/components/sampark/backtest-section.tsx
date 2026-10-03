"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { previewRules, runBacktestReport, type BacktestDto, type PreviewRulesDto } from "@/lib/api/sampark";
import { errorMessage } from "./states";
import { useSamparkFormat } from "./format";
import { fmt, purposeLabel, roleLabel } from "./labels";

/**
 * The backtest (plan §2A): "these N children would have been flagged last term; your teachers already knew about K".
 * Runs every rule on the school's own term, adopted or not, and writes nothing.
 */
export function BacktestSection({ orgId }: { orgId: string }) {
    const { t } = useLanguage();
    const f = useSamparkFormat();
    const { toast } = useToast();
    const [report, setReport] = useState<BacktestDto | null>(null);
    const [preview, setPreview] = useState<PreviewRulesDto | null>(null);
    const [busy, setBusy] = useState<null | "backtest" | "preview">(null);

    async function runBacktest() {
        setBusy("backtest");
        try {
            setReport(await runBacktestReport(orgId, { weeks: 5 }));
        } catch (err) {
            toast({ title: t("Could not run the backtest"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    }

    async function runPreview() {
        setBusy("preview");
        try {
            setPreview(await previewRules(orgId));
        } catch (err) {
            toast({ title: t("Could not check the children"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    }

    return (
        <SectionCard
            title={t("Backtest")}
            description={t("See what the rules would have flagged over the last weeks of the school's own records, before adopting anything. Nothing is created or called.")}
            icon={FlaskConical}
        >
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={runBacktest} disabled={busy !== null} className="min-h-11">
                    {busy === "backtest" && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Run on recent weeks")}
                </Button>
                <Button type="button" variant="outline" onClick={runPreview} disabled={busy !== null} className="min-h-11">
                    {busy === "preview" && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Who would be left out today, and why")}
                </Button>
            </div>

            {report && (
                <div className="space-y-4">
                    <p className="type-body font-semibold text-foreground">{report.headlines[0]}</p>
                    {report.attendanceWindow && (
                        <p className="type-caption text-muted-foreground">
                            {fmt(t("Attendance records seen: {from} to {to}"), { from: f.day(report.attendanceWindow.from), to: f.day(report.attendanceWindow.to) })}
                        </p>
                    )}
                    <ul className="space-y-3">
                        {report.results.map((r) => (
                            <li key={r.ruleId} className="space-y-2 rounded-surface-md border border-border bg-card p-4">
                                <p className="type-body font-semibold text-foreground">{purposeLabel(t, r.ruleId)}</p>
                                <p className="type-body text-foreground">
                                    {fmt(t("{count} children would have been flagged. Teachers already knew about {known}."), { count: r.flaggedChildren, known: r.alreadyKnown })}
                                </p>
                                {r.note && <p className="type-body text-muted-foreground">{r.note}</p>}
                                {r.children.length > 0 && (
                                    <details>
                                        <summary className="cursor-pointer type-body text-foreground rounded-surface-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            {t("Who and why")}
                                        </summary>
                                        <ul className="mt-2 space-y-2">
                                            {r.children.map((c) => (
                                                <li key={c.studentId} className="type-body text-foreground break-words">
                                                    <span className="font-medium">{c.displayName} · {c.section}</span>
                                                    {c.alreadyKnown && <span className="text-muted-foreground"> · {t("a teacher already knew")}</span>}
                                                    <span className="block text-muted-foreground">{c.reasons.join(" ")}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                                {r.excluded.length > 0 && (
                                    <details>
                                        <summary className="cursor-pointer type-body text-foreground rounded-surface-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            {fmt(t("{count} children left out, with the reason"), { count: r.excluded.length })}
                                        </summary>
                                        <ul className="mt-2 space-y-2">
                                            {r.excluded.map((e) => (
                                                <li key={`${e.studentId}-${e.code}`} className="type-body text-muted-foreground break-words">{e.plain}</li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                            </li>
                        ))}
                    </ul>

                    {report.weeks.length > 0 && (
                        <div className="space-y-2">
                            <p className="type-body font-semibold text-foreground">{t("Expected approvals each week")}</p>
                            <div className="overflow-x-auto rounded-surface-md border border-border">
                                <table className="w-full text-left type-body">
                                    <caption className="sr-only">{t("Expected approvals each week")}</caption>
                                    <thead className="bg-muted/30">
                                        <tr className="border-b border-border">
                                            <th scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{t("Week of")}</th>
                                            <th scope="col" className="px-3 py-2 text-xs font-medium leading-normal text-muted-foreground">{t("Who approves")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.weeks.map((w) => (
                                            <tr key={w.weekStart} className="border-b border-border align-top last:border-b-0">
                                                <td className="px-3 py-3 whitespace-nowrap text-foreground">{f.day(w.weekStart)}</td>
                                                <td className="px-3 py-3 text-foreground">
                                                    {Object.entries(w.byApprover).map(([role, n]) => `${roleLabel(t, role)}: ${n}`).join(" · ")}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <p className="type-caption text-muted-foreground">
                        {fmt(t("{count} unexplained absences seen. Same-day absence calls are not replayed because they need the class teacher on the day."), { count: report.unexplainedAbsenceDays })}
                    </p>
                </div>
            )}

            {preview && (
                <div className="space-y-2">
                    <p className="type-body font-semibold text-foreground">{t("Children the adopted rules leave out today")}</p>
                    {preview.excluded.length === 0 ? (
                        <p className="type-body text-muted-foreground">{t("No child is left out.")}</p>
                    ) : (
                        <ul className="space-y-2">
                            {preview.excluded.map((e) => (
                                <li key={`${e.studentId}-${e.purpose}`} className="type-body text-foreground break-words">
                                    <span className="font-medium">{e.studentName} · {e.section} · {purposeLabel(t, e.purpose)}</span>
                                    <span className="block text-muted-foreground">{e.plain}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </SectionCard>
    );
}
