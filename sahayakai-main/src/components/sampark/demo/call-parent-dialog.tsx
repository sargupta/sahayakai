"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BookOpen, CalendarX, Loader2, PhoneOff, PhoneOutgoing, Send, Star, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InlineMicButton } from "@/components/layout";
import { StatusPill } from "@/components/sampark/status-pill";
import { fmt } from "@/components/sampark/labels";
import { useLanguage } from "@/context/language-context";
import { classById, getDemoSchool, studentSignals, teacherById } from "@/lib/sampark/demo/school";
import {
    DEMO_REASONS,
    PERSONA_LABEL,
    REASON_HINT,
    REASON_LABEL,
    defaultNote,
    openingLine,
    quickReplies,
    type ParentPersona,
} from "@/lib/sampark/demo/script";
import { addCall } from "@/lib/sampark/demo/store";
import type { DemoCall, DemoCallContext, DemoLanguage, DemoRole, DemoStudent, DemoSummary, DemoTurn } from "@/lib/sampark/demo/types";
import type { OutreachReason } from "@/types/attendance";
import { cn } from "@/lib/utils";
import { CallSummaryView, Transcript } from "./call-summary";

const REASON_ICON: Record<OutreachReason, typeof CalendarX> = {
    consecutive_absences: CalendarX,
    poor_performance: BookOpen,
    behavioral_concern: AlertTriangle,
    positive_feedback: Star,
};

const PERSONAS: ParentPersona[] = ["cooperative", "defensive", "angry", "complaint", "meet", "bye"];
const MAX_PARENT_TURNS = 12;

function newId(): string {
    return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Speaks the AI's lines with the browser's voice, in the call's language. */
function useSpeaker(language: DemoLanguage, enabled: boolean) {
    const speak = useCallback(
        (text: string, onEnd?: () => void) => {
            const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
            if (!enabled || !synth) {
                onEnd?.();
                return;
            }
            synth.cancel();
            const u = new SpeechSynthesisUtterance(text);
            const lang = language === "hi" ? "hi-IN" : "en-IN";
            u.lang = lang;
            const voices = synth.getVoices();
            u.voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(language)) ?? null;
            u.rate = 0.98;
            u.onend = () => onEnd?.();
            u.onerror = () => onEnd?.();
            synth.speak(u);
        },
        [language, enabled],
    );
    useEffect(() => () => window.speechSynthesis?.cancel(), []);
    return speak;
}

interface Props {
    student: DemoStudent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placedBy: { role: DemoRole; name: string };
    initialReason?: OutreachReason | null;
}

type Step = "setup" | "live" | "summarising" | "done";

export function CallParentDialog({ student, open, onOpenChange, placedBy, initialReason }: Props) {
    const { t } = useLanguage();
    const school = getDemoSchool();
    const cls = student ? classById(student.classId) : undefined;
    const teacher = cls ? teacherById(cls.teacherId) : undefined;
    const signals = useMemo(() => (student ? studentSignals(student) : []), [student]);

    const [step, setStep] = useState<Step>("setup");
    const [reason, setReason] = useState<OutreachReason>("behavioral_concern");
    const [note, setNote] = useState("");
    const [noteEdited, setNoteEdited] = useState(false);
    const [language, setLanguage] = useState<DemoLanguage>("en");
    const [turns, setTurns] = useState<DemoTurn[]>([]);
    const [draft, setDraft] = useState("");
    const [thinking, setThinking] = useState(false);
    const [voiceOn, setVoiceOn] = useState(true);
    const [offline, setOffline] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ending, setEnding] = useState(false);
    const [result, setResult] = useState<DemoCall | null>(null);
    const callId = useRef(newId());
    const startedAt = useRef(0);
    const scroller = useRef<HTMLDivElement>(null);
    const speak = useSpeaker(language, voiceOn);

    // Fresh setup each time the dialog opens for a student.
    useEffect(() => {
        if (!open || !student) return;
        const first = initialReason ?? signals[0]?.reason ?? "behavioral_concern";
        setStep("setup");
        setReason(first);
        setNote(defaultNote(first, student));
        setNoteEdited(false);
        setLanguage(student.guardian.language);
        setTurns([]);
        setDraft("");
        setOffline(false);
        setError(null);
        setEnding(false);
        setResult(null);
        callId.current = newId();
    }, [open, student, initialReason, signals]);

    useEffect(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    }, [turns, thinking]);

    if (!student || !cls || !teacher) return null;

    const context: DemoCallContext = {
        studentName: student.name,
        className: cls.name,
        subject: cls.subject,
        reason,
        teacherMessage: note.trim() || defaultNote(reason, student),
        teacherName: teacher.spokenName,
        schoolName: school.name,
        parentLanguage: language,
    };

    const chooseReason = (r: OutreachReason) => {
        setReason(r);
        if (!noteEdited) setNote(defaultNote(r, student));
    };

    const save = (call: DemoCall) => {
        addCall(call);
        setResult(call);
        setStep("done");
    };

    const unreached = (status: "no_answer" | "busy") => {
        save({
            id: callId.current,
            createdAt: new Date().toISOString(),
            studentId: student.id,
            classId: cls.id,
            teacherId: teacher.id,
            placedBy,
            reason,
            note: context.teacherMessage,
            language,
            status,
            durationSeconds: 0,
            transcript: [],
            summary: null,
            complaintStatus: null,
        });
    };

    const start = () => {
        const opener = openingLine(context, teacher);
        startedAt.current = Date.now();
        setTurns([{ role: "agent", text: opener }]);
        setStep("live");
        speak(opener);
    };

    const finish = async (finalTurns: DemoTurn[]) => {
        if (ending) return;
        setEnding(true);
        window.speechSynthesis?.cancel();
        setStep("summarising");
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
        let summary: DemoSummary | null = null;
        let summaryOffline = false;
        if (finalTurns.some((x) => x.role === "parent")) {
            try {
                const res = await fetch("/api/sampark-demo/summary", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ callId: callId.current, context, transcript: finalTurns.slice(-24), durationSeconds }),
                });
                if (!res.ok) throw new Error(String(res.status));
                const data = (await res.json()) as { summary: DemoSummary; source: "ai" | "fallback" };
                summary = data.summary;
                summaryOffline = data.source === "fallback";
            } catch {
                setError(t("The summary could not be written. The transcript is saved."));
            }
        }
        save({
            id: callId.current,
            createdAt: new Date(startedAt.current).toISOString(),
            studentId: student.id,
            classId: cls.id,
            teacherId: teacher.id,
            placedBy,
            reason,
            note: context.teacherMessage,
            language,
            status: "completed",
            durationSeconds,
            transcript: finalTurns,
            summary,
            complaintStatus: summary?.complaintAboutTeacher ? "open" : null,
            offlineReplies: offline || summaryOffline,
        });
    };

    const send = async (text: string) => {
        const said = text.trim();
        if (!said || thinking || step !== "live") return;
        window.speechSynthesis?.cancel();
        const history = turns;
        const withParent: DemoTurn[] = [...history, { role: "parent", text: said }];
        setTurns(withParent);
        setDraft("");
        setThinking(true);
        setError(null);
        const turnNumber = Math.min(MAX_PARENT_TURNS, withParent.filter((x) => x.role === "parent").length);
        try {
            const res = await fetch("/api/sampark-demo/turn", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ callId: callId.current, context, transcript: history.slice(-23), parentSpeech: said, turnNumber }),
            });
            if (!res.ok) throw new Error(res.status === 429 ? t("The demo is busy. Try again in a minute.") : t("The AI did not answer. Try again."));
            const data = (await res.json()) as { reply: string; shouldEndCall: boolean; source: "ai" | "fallback" };
            if (data.source === "fallback") setOffline(true);
            const next: DemoTurn[] = [...withParent, { role: "agent", text: data.reply }];
            setTurns(next);
            const end = data.shouldEndCall || turnNumber >= MAX_PARENT_TURNS;
            speak(data.reply, end ? () => void finish(next) : undefined);
        } catch (e) {
            setError(e instanceof Error ? e.message : t("The AI did not answer. Try again."));
            setTurns(history);
            setDraft(said);
        } finally {
            setThinking(false);
        }
    };

    const ReasonIcon = REASON_ICON[reason];
    const personaReplies = quickReplies(language);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) window.speechSynthesis?.cancel();
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{fmt(t("Call {name}'s parent"), { name: student.name })}</DialogTitle>
                    <DialogDescription>
                        {student.guardian.name} ({t(student.guardian.relation)}) · {fmt(t("phone ending {last4}"), { last4: student.guardian.phoneLast4 })} · {cls.name} ·{" "}
                        {language === "hi" ? t("Hindi") : t("English")}
                    </DialogDescription>
                </DialogHeader>

                {step === "setup" && (
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label>{t("Reason for the call")}</Label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {DEMO_REASONS.map((r) => {
                                    const Icon = REASON_ICON[r];
                                    const signal = signals.find((s) => s.reason === r);
                                    return (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => chooseReason(r)}
                                            aria-pressed={reason === r}
                                            className={cn(
                                                "focus-ring flex items-start gap-3 rounded-field border px-3 py-2 text-left transition-colors",
                                                reason === r ? "border-primary bg-primary/10" : "border-border hover:bg-milk-300",
                                            )}
                                        >
                                            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-600" />
                                            <span className="min-w-0">
                                                <span className="block font-medium text-ink-900">{t(REASON_LABEL[r])}</span>
                                                <span className="block text-xs text-ink-500">{t(REASON_HINT[r])}</span>
                                                {signal && <span className="mt-1 block text-xs font-medium text-primary">{t(signal.label)}</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="demo-note">{t("Your note for the call")}</Label>
                            <Textarea
                                id="demo-note"
                                rows={3}
                                maxLength={500}
                                value={note}
                                onChange={(e) => {
                                    setNote(e.target.value);
                                    setNoteEdited(true);
                                }}
                            />
                            <p className="text-xs text-ink-500">{t("The AI explains this to the parent in their language. It never reads out marks or other children's names.")}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Label>{t("Call language")}</Label>
                            {(["en", "hi"] as DemoLanguage[]).map((l) => (
                                <Button key={l} size="sm" variant={language === l ? "default" : "outline"} onClick={() => setLanguage(l)}>
                                    {l === "hi" ? t("Hindi") : t("English")}
                                </Button>
                            ))}
                        </div>

                        <div className="rounded-surface-md border border-border bg-milk-50 p-3 text-sm">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-500">{t("The AI opens with")}</p>
                            <p className="text-ink-800">{openingLine(context, teacher)}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Button size="sm" variant="ghost" onClick={() => unreached("no_answer")}>
                                    {t("Simulate: no answer")}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => unreached("busy")}>
                                    {t("Simulate: busy")}
                                </Button>
                            </div>
                            <Button onClick={start}>
                                <PhoneOutgoing aria-hidden="true" className="mr-2 h-4 w-4" />
                                {t("Start call")}
                            </Button>
                        </div>
                    </div>
                )}

                {(step === "live" || step === "summarising") && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusPill tone={step === "live" ? "success" : "info"}>{step === "live" ? t("On the call") : t("Writing the summary…")}</StatusPill>
                                <StatusPill tone="neutral">
                                    <ReasonIcon aria-hidden="true" className="mr-1 inline h-3 w-3" />
                                    {t(REASON_LABEL[reason])}
                                </StatusPill>
                                {offline && <StatusPill tone="warning">{t("Scripted replies (AI offline)")}</StatusPill>}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}>
                                {voiceOn ? <Volume2 aria-hidden="true" className="mr-2 h-4 w-4" /> : <VolumeX aria-hidden="true" className="mr-2 h-4 w-4" />}
                                {voiceOn ? t("Voice on") : t("Voice off")}
                            </Button>
                        </div>

                        <div ref={scroller} className="max-h-[38vh] min-h-[160px] overflow-y-auto rounded-surface-md border border-border bg-milk-50 p-3">
                            <Transcript turns={turns} />
                            {thinking && (
                                <p className="mt-2 flex items-center gap-2 text-sm text-ink-500">
                                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                                    {t("The AI is answering…")}
                                </p>
                            )}
                        </div>

                        {step === "live" && (
                            <>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t("You are the parent. Say anything, or try a reaction:")}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {PERSONAS.map((p) => {
                                            const lines = personaReplies[p];
                                            const usedCount = turns.filter((x) => x.role === "parent" && lines.includes(x.text)).length;
                                            const line = lines[usedCount % lines.length];
                                            return (
                                                <Button
                                                    key={p}
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={thinking}
                                                    title={line}
                                                    onClick={() => void send(line)}
                                                    className={cn((p === "angry" || p === "complaint") && "border-destructive/50")}
                                                >
                                                    {t(PERSONA_LABEL[p])}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <form
                                    className="flex items-end gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void send(draft);
                                    }}
                                >
                                    <div className="relative flex-1">
                                        <Textarea
                                            rows={2}
                                            maxLength={500}
                                            value={draft}
                                            placeholder={t("Type or speak what the parent says…")}
                                            onChange={(e) => setDraft(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    void send(draft);
                                                }
                                            }}
                                            className="pr-12"
                                        />
                                        <InlineMicButton
                                            lang={language === "hi" ? "hi-IN" : "en-IN"}
                                            onTranscript={(text) => setDraft(text)}
                                            className="absolute bottom-2 right-2"
                                        />
                                    </div>
                                    <Button type="submit" disabled={thinking || !draft.trim()} aria-label={t("Send")}>
                                        <Send aria-hidden="true" className="h-4 w-4" />
                                    </Button>
                                </form>

                                {error && <p className="text-sm text-destructive">{error}</p>}

                                <div className="flex justify-end">
                                    <Button variant="destructive" onClick={() => void finish(turns)} disabled={thinking}>
                                        <PhoneOff aria-hidden="true" className="mr-2 h-4 w-4" />
                                        {t("End call")}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {step === "done" && result && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusPill tone={result.status === "completed" ? "success" : "warning"}>
                                {result.status === "completed" ? t("Call saved") : result.status === "busy" ? t("Line busy · saved") : t("No answer · saved")}
                            </StatusPill>
                            <span className="text-sm text-ink-500">
                                {placedBy.role === "admin"
                                    ? fmt(t("Visible to you and {teacher}"), { teacher: teacher.name })
                                    : t("Visible to you and the principal")}
                            </span>
                        </div>
                        <CallSummaryView call={result} viewerRole={placedBy.role} />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        {result.transcript.length > 0 && (
                            <details className="rounded-surface-md border border-border p-3">
                                <summary className="cursor-pointer text-sm font-medium text-ink-800">{t("Transcript")}</summary>
                                <Transcript turns={result.transcript} className="mt-3" />
                            </details>
                        )}
                        <div className="flex justify-end">
                            <Button onClick={() => onOpenChange(false)}>{t("Done")}</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
