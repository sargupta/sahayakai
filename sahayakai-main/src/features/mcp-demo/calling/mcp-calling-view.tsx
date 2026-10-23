"use client";

import { useState } from "react";
import { AlertTriangle, CalendarX2, CheckCircle2, Loader2, Phone, PlugZap, RotateCcw, Star, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/layout";
import { LessonPlanHeader } from "@/components/lesson-plan/lesson-plan-header";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { OutreachReason } from "@/types/attendance";
import { McpStatusBadge } from "@/features/mcp-demo/lesson-planner/mcp-status-badge";
import type { useMcpCalling } from "./use-mcp-calling";

// Same reasons, labels and icons as the app's ContactParentModal.
const REASONS: { value: OutreachReason; labelKey: string; descriptionKey: string; icon: React.ElementType }[] = [
    { value: "consecutive_absences", labelKey: "Consecutive Absences", descriptionKey: "Student has been absent for multiple days", icon: CalendarX2 },
    { value: "poor_performance", labelKey: "Academic Concern", descriptionKey: "Grades or performance has declined", icon: TrendingDown },
    { value: "behavioral_concern", labelKey: "Behavioral Concern", descriptionKey: "Classroom behavior needs attention", icon: AlertTriangle },
    { value: "positive_feedback", labelKey: "Positive Feedback", descriptionKey: "Share an achievement or good news", icon: Star },
];

type Props = ReturnType<typeof useMcpCalling>;

/**
 * /mcp-demo/calling — the attendance page's "Parent Outreach" list and the
 * Contact dialog, but every action goes through the Sahayak MCP server
 * (list_parent_contacts / initiate_parent_call) via a server-side MCP client.
 */
export function McpCallingView({
    connection, checkConnection, classes, listError, loadContacts, selectedClass, setSelectedClassId,
    activeStudent, openContact, closeContact, placeCall, calling, callResult, callInfo, callError,
}: Props) {
    const { t } = useLanguage();
    const [reason, setReason] = useState<OutreachReason | null>(null);
    const [note, setNote] = useState("");

    const open = (s: Parameters<typeof openContact>[0]) => { setReason(null); setNote(""); openContact(s); };

    return (
        <div className="container-wide py-8 md:py-12 space-y-8">
            <SectionCard className="overflow-hidden p-0 md:p-0 space-y-0">
                <div className="card-accent-bar" />
                <LessonPlanHeader title={t("Parent Outreach")} description={t("Call a student's parent with Sahayak, delivered through the Sahayak MCP server.")} />
                <div className="flex justify-center -mt-3 mb-2 px-4">
                    <McpStatusBadge connection={connection} onRetry={checkConnection} />
                </div>
                <CardContent className="space-y-4">
                    {classes === null ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("Loading classes…")}
                        </div>
                    ) : listError ? (
                        <div role="alert" data-testid="mcp-calling-list-error" className="flex flex-col items-center gap-3 py-8 text-center">
                            <p className="text-sm text-muted-foreground">{listError.message}</p>
                            {listError.retryable && <Button variant="outline" onClick={loadContacts}><RotateCcw className="mr-2 h-4 w-4" />{t("Try again")}</Button>}
                        </div>
                    ) : classes.length === 0 ? (
                        <p data-testid="mcp-calling-empty" className="py-10 text-center text-sm text-muted-foreground">
                            {t("No classes are linked to this school's Sahayak MCP key.")}
                        </p>
                    ) : (
                        <>
                            <div className="max-w-xs">
                                <Select value={selectedClass?.class_id} onValueChange={(v) => { if (v) setSelectedClassId(v); }}>
                                    <SelectTrigger aria-label={t("Class")}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {classes.map((c) => <SelectItem key={c.class_id} value={c.class_id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">{t("Parent Outreach")}</p>
                                <div className="divide-y divide-border/30 rounded-xl border border-border/50 overflow-hidden">
                                    {selectedClass?.students.map((s) => (
                                        <div key={s.student_id} data-testid="mcp-calling-student" className="flex items-center gap-3 px-4 py-3 bg-card">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {s.parent_reachable ? `${t("Parent")} ••••${s.parent_phone_last4}` : t("No parent phone on record")}
                                                    {s.parent_language ? ` · ${t(s.parent_language)}` : ""}
                                                </p>
                                            </div>
                                            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9 shrink-0" disabled={!s.parent_reachable} onClick={() => open(s)}>
                                                <Phone className="h-3 w-3" />
                                                {t("Contact")}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </SectionCard>

            <Dialog open={!!activeStudent} onOpenChange={(o) => { if (!o) closeContact(); }}>
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-foreground font-headline font-black">
                            {t("Contact parent")}: {activeStudent?.name}
                        </DialogTitle>
                        <DialogDescription>{t("Sahayak writes the message and calls the parent number on record.")}</DialogDescription>
                    </DialogHeader>

                    {callResult ? (
                        <div data-testid="mcp-call-result" className="space-y-3">
                            <div className="flex items-center gap-2 text-success">
                                <CheckCircle2 className="h-5 w-5" aria-hidden />
                                <p className="font-semibold">{t("Call started")}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t("Calling the parent")} ••••{callResult.parent_phone_last4} · {t(callResult.parent_language)}
                            </p>
                            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{callResult.message}</div>
                            {callInfo && (
                                <p data-testid="mcp-call-info" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <PlugZap className="h-3.5 w-3.5 text-primary" aria-hidden />
                                    {t("Generated via Sahayak MCP")} · <code className="font-mono">{callInfo.tool}</code> · {callInfo.protocol} · {(callInfo.durationMs / 1000).toFixed(1)} s
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3 mt-2">
                            <p className="text-xs text-muted-foreground font-medium">{t("Select reason for outreach:")}</p>
                            <div className="grid grid-cols-1 gap-2">
                                {REASONS.map((r) => {
                                    const Icon = r.icon;
                                    return (
                                        <button
                                            key={r.value}
                                            type="button"
                                            onClick={() => setReason(r.value)}
                                            aria-pressed={reason === r.value}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                                reason === r.value ? "border-primary/20 bg-primary/8" : "border-border bg-background hover:border-border hover:bg-muted/40",
                                            )}
                                        >
                                            <div className={cn("p-2 rounded-lg shrink-0", reason === r.value ? "bg-primary/15" : "bg-muted/40")}>
                                                <Icon className={cn("h-4 w-4", reason === r.value ? "text-primary" : "text-muted-foreground")} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">{t(r.labelKey)}</p>
                                                <p className="text-xs text-muted-foreground">{t(r.descriptionKey)}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <Textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                                placeholder={t("Add a note for the parent (optional)")}
                                className="min-h-[80px]"
                            />
                            {callError && (
                                <div role="alert" data-testid="mcp-call-error" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                                    <p className="font-semibold text-foreground">{t("The call could not be started")}</p>
                                    <p className="text-muted-foreground">{callError.message}</p>
                                </div>
                            )}
                            {reason && <Badge variant="secondary" className="text-xs">{t(REASONS.find((r) => r.value === reason)!.labelKey)}</Badge>}
                            <Button
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                                disabled={!reason || calling}
                                onClick={() => reason && placeCall(reason, note)}
                            >
                                {calling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("Calling…")}</> : <><Phone className="mr-2 h-4 w-4" />{callError?.retryable ? t("Try again") : t("Call parent")}</>}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
