"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TWILIO_LANGUAGE_MAP } from "@/types/attendance";
import type { Student, OutreachReason, CallSummary, TranscriptTurn } from "@/types/attendance";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import {
    Loader2, Phone, Copy, RefreshCw, CheckCircle2,
    CalendarX2, TrendingDown, AlertTriangle, Star,
    MessageSquare, ClipboardList, ArrowRight, UserCircle, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactParentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: Student;
    classId: string;
    className: string;
    subject: string;
    consecutiveAbsences?: number;
    twilioConfigured: boolean;
}

const REASONS: { value: OutreachReason; label: string; description: string; icon: React.ElementType }[] = [
    { value: "consecutive_absences", label: "Consecutive Absences", description: "Student has been absent for multiple days", icon: CalendarX2 },
    { value: "poor_performance",     label: "Academic Concern",     description: "Grades or performance has declined",        icon: TrendingDown },
    { value: "behavioral_concern",   label: "Behavioral Concern",   description: "Classroom behavior needs attention",        icon: AlertTriangle },
    { value: "positive_feedback",    label: "Positive Feedback",    description: "Share an achievement or good news",         icon: Star },
];

type Step = "reason" | "note" | "review" | "calling" | "summary";

interface CallResult {
    callStatus: string | null;
    callDurationSeconds: number | null;
    answeredBy: string | null;
    turnCount: number;
    transcript: TranscriptTurn[];
    callSummary: CallSummary | null;
}

export function ContactParentModal({
    open, onOpenChange,
    student, classId, className, subject, consecutiveAbsences, twilioConfigured,
}: ContactParentModalProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [step, setStep] = useState<Step>("reason");
    const [reason, setReason] = useState<OutreachReason | null>(null);
    const [note, setNote] = useState("");
    const [generatedMessage, setGeneratedMessage] = useState("");
    const [languageCode, setLanguageCode] = useState("en-IN");
    const [generating, setGenerating] = useState(false);
    const [calling, setCalling] = useState(false);
    const [outreachId, setOutreachId] = useState<string | null>(null);
    const [callResult, setCallResult] = useState<CallResult | null>(null);

    const canCall = twilioConfigured && !!TWILIO_LANGUAGE_MAP[student.parentLanguage];
    const unsupportedForCall = twilioConfigured && !TWILIO_LANGUAGE_MAP[student.parentLanguage];

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep("reason");
            setReason(null);
            setNote("");
            setGeneratedMessage("");
            setOutreachId(null);
            setCallResult(null);
        }, 300);
    };

    // Poll for call summary after call is initiated
    const pollForSummary = useCallback(async (oid: string) => {
        const maxPolls = 60; // 5 minutes at 5s intervals
        let polls = 0;

        const poll = async () => {
            if (polls >= maxPolls) return;
            polls++;

            try {
                const res = await fetch(`/api/attendance/call-summary?outreachId=${oid}`);
                if (!res.ok) return;

                const data: CallResult = await res.json();
                setCallResult(data);

                const terminal = ['completed', 'failed', 'no_answer', 'busy'];
                if (data.callStatus && terminal.includes(data.callStatus)) {
                    // If summary is ready, show it
                    if (data.callSummary) {
                        setStep("summary");
                        return;
                    }
                    // Summary not yet generated — wait a bit more
                    if (polls < maxPolls) {
                        setTimeout(poll, 3000);
                        return;
                    }
                    // Timed out waiting for summary — show what we have
                    setStep("summary");
                    return;
                }

                // Still in progress — keep polling
                setTimeout(poll, 5000);
            } catch {
                if (polls < maxPolls) setTimeout(poll, 5000);
            }
        };

        // Start polling after a short delay
        setTimeout(poll, 3000);
    }, []);

    const generateMessage = async () => {
        if (!reason) return;
        setGenerating(true);
        try {
            const { auth } = await import('@/lib/firebase');
            const token = await auth.currentUser?.getIdToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/ai/parent-message', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    studentName: student.name,
                    className,
                    subject,
                    reason,
                    teacherNote: note || undefined,
                    parentLanguage: student.parentLanguage,
                    consecutiveAbsentDays: consecutiveAbsences,
                    userId: user?.uid,
                }),
            });

            if (!res.ok) throw new Error('Failed to generate message');
            const data = await res.json();
            setGeneratedMessage(data.message);
            setLanguageCode(data.languageCode);
            setStep("review");
        } catch (err: any) {
            toast({ title: "Failed to generate", description: err.message, variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };

    const saveOutreach = async (deliveryMethod: 'twilio_call' | 'whatsapp_copy') => {
        const res = await fetch('/api/attendance/outreach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classId,
                className,
                studentId: student.id,
                studentName: student.name,
                parentPhone: student.parentPhone,
                parentLanguage: student.parentLanguage,
                reason: reason!,
                teacherNote: note || undefined,
                generatedMessage,
                deliveryMethod,
            }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error ?? 'Failed to save outreach record');
        }
        return res.json() as Promise<{ outreachId: string }>;
    };

    const handleCall = async () => {
        if (!generatedMessage) return;
        setCalling(true);
        try {
            const { outreachId: oid } = await saveOutreach('twilio_call');
            setOutreachId(oid);

            const res = await fetch('/api/attendance/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    outreachId: oid,
                    to: student.parentPhone,
                    parentLanguage: student.parentLanguage,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Call failed');
            }

            setStep("calling");
            pollForSummary(oid);
        } catch (err: any) {
            toast({ title: "Call failed", description: err.message, variant: "destructive" });
        } finally {
            setCalling(false);
        }
    };

    const handleCopyWhatsApp = async () => {
        try {
            await saveOutreach('whatsapp_copy');
        } catch { /* non-blocking */ }

        await navigator.clipboard.writeText(generatedMessage);
        setStep("summary");
        setCallResult({ callStatus: 'manual', callDurationSeconds: null, answeredBy: null, turnCount: 0, transcript: [], callSummary: null });
        toast({ title: "Copied to clipboard", description: "Paste in WhatsApp to send." });
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-foreground font-headline font-black">
                        Contact {student.name}&apos;s Parent
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        {student.parentPhone} · {student.parentLanguage}
                    </p>
                </DialogHeader>

                {step === "calling" ? (
                    <CallingView student={student} callResult={callResult} />
                ) : step === "summary" ? (
                    <SummaryView callResult={callResult} student={student} onClose={handleClose} />
                ) : step === "reason" ? (
                    <div className="space-y-3 mt-2">
                        <p className="text-xs text-muted-foreground font-medium">Select reason for outreach:</p>
                        <div className="grid grid-cols-1 gap-2">
                            {REASONS.map((r) => {
                                const Icon = r.icon;
                                return (
                                    <button
                                        key={r.value}
                                        onClick={() => setReason(r.value)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                                            reason === r.value
                                                ? "border-primary/20 bg-primary/8"
                                                : "border-border bg-background hover:border-border hover:bg-muted/40"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            reason === r.value ? "bg-primary/15" : "bg-muted/40"
                                        )}>
                                            <Icon className={cn("h-4 w-4", reason === r.value ? "text-primary" : "text-muted-foreground")} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{r.label}</p>
                                            <p className="text-xs text-muted-foreground">{r.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <Button
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
                            disabled={!reason}
                            onClick={() => setStep("note")}
                        >
                            Next: Add Note
                        </Button>
                    </div>
                ) : step === "note" ? (
                    <div className="space-y-4 mt-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                                {REASONS.find((r) => r.value === reason)?.label}
                            </Badge>
                        </div>
                        <Textarea
                            placeholder="Add specific details (optional) — e.g., 'Absent Mon, Tue, Wed' or 'Scored 12/50 in Math test'"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setStep("reason")}>Back</Button>
                            <Button
                                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                                onClick={generateMessage}
                                disabled={generating}
                            >
                                {generating
                                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                                    : "Generate Message"
                                }
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Review step */
                    <div className="space-y-4 mt-2">
                        <div className="p-4 bg-muted/40 rounded-xl border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                            {generatedMessage}
                        </div>

                        <Button
                            variant="ghost" size="sm"
                            className="text-xs text-muted-foreground w-full"
                            onClick={generateMessage}
                            disabled={generating}
                        >
                            {generating
                                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Regenerating...</>
                                : <><RefreshCw className="h-3 w-3 mr-1" /> Regenerate</>
                            }
                        </Button>

                        {unsupportedForCall && (
                            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                Auto-call is not available for {student.parentLanguage}. Use WhatsApp copy instead.
                            </p>
                        )}

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1 gap-2"
                                onClick={handleCopyWhatsApp}
                            >
                                <Copy className="h-4 w-4" />
                                Copy for WhatsApp
                            </Button>

                            {canCall && (
                                <Button
                                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleCall}
                                    disabled={calling}
                                >
                                    {calling
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Calling...</>
                                        : <><Phone className="h-4 w-4" /> Call Parent</>
                                    }
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Calling in progress view ────────────────────────────────────────────────

function CallingView({ student, callResult }: { student: Student; callResult: CallResult | null }) {
    const status = callResult?.callStatus;
    const turns = callResult?.turnCount ?? 0;

    return (
        <div className="flex flex-col items-center py-8 space-y-4 text-center">
            <div className="relative">
                <div className="p-4 bg-green-50 rounded-full">
                    <Phone className="h-8 w-8 text-green-600" />
                </div>
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full animate-pulse" />
            </div>
            <p className="font-bold text-foreground">
                {!status || status === 'initiated' ? 'Calling...' :
                 status === 'ringing' ? 'Ringing...' :
                 'Conversation in progress'}
            </p>
            <p className="text-xs text-muted-foreground">
                AI agent is talking with {student.name}&apos;s parent
            </p>
            {turns > 1 && (
                <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {turns} exchanges
                </Badge>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Summary will appear when the call ends
            </div>
        </div>
    );
}

// ── Call summary view ───────────────────────────────────────────────────────

function SummaryView({ callResult, student, onClose }: { callResult: CallResult | null; student: Student; onClose: () => void }) {
    const summary = callResult?.callSummary;
    const transcript = callResult?.transcript ?? [];
    const isManual = callResult?.callStatus === 'manual';
    const callFailed = callResult?.callStatus === 'failed' || callResult?.callStatus === 'no_answer' || callResult?.callStatus === 'busy';

    if (isManual) {
        return (
            <div className="flex flex-col items-center py-8 space-y-3 text-center">
                <div className="p-4 bg-emerald-50 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="font-bold text-foreground">Message copied!</p>
                <p className="text-xs text-muted-foreground">Outreach logged for {student.name}. Paste in WhatsApp to send.</p>
                <Button className="mt-2" variant="outline" onClick={onClose}>Close</Button>
            </div>
        );
    }

    if (callFailed) {
        return (
            <div className="flex flex-col items-center py-8 space-y-3 text-center">
                <div className="p-4 bg-amber-50 rounded-full">
                    <Phone className="h-8 w-8 text-amber-500" />
                </div>
                <p className="font-bold text-foreground">
                    {callResult?.callStatus === 'busy' ? 'Line was busy' :
                     callResult?.callStatus === 'no_answer' ? 'No answer' : 'Call could not connect'}
                </p>
                <p className="text-xs text-muted-foreground">You can try again later or use WhatsApp instead.</p>
                <Button className="mt-2" variant="outline" onClick={onClose}>Close</Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-2">
            {/* Status banner */}
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-emerald-800">Call completed</p>
                    <p className="text-xs text-emerald-600">
                        {callResult?.callDurationSeconds ? `${Math.ceil(callResult.callDurationSeconds / 60)} min` : ''} · {callResult?.turnCount ?? 0} exchanges
                        {summary?.parentSentiment && ` · Parent was ${summary.parentSentiment}`}
                    </p>
                </div>
            </div>

            {/* Summary */}
            {summary ? (
                <div className="space-y-3">
                    {/* Parent response */}
                    <div className="p-3 bg-muted/40 rounded-lg border border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Parent Response</p>
                        <p className="text-sm text-foreground">{summary.parentResponse}</p>
                    </div>

                    {/* Concerns */}
                    {summary.parentConcerns.length > 0 && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <p className="text-xs font-semibold text-amber-600 mb-1">Concerns Raised</p>
                            <ul className="space-y-1">
                                {summary.parentConcerns.map((c, i) => (
                                    <li key={i} className="text-xs text-amber-800 flex gap-2">
                                        <span className="shrink-0 mt-0.5">-</span> {c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Parent commitments */}
                    {summary.parentCommitments.length > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <p className="text-xs font-semibold text-blue-600 mb-1">Parent Commitments</p>
                            <ul className="space-y-1">
                                {summary.parentCommitments.map((c, i) => (
                                    <li key={i} className="text-xs text-blue-800 flex gap-2">
                                        <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" /> {c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Action items for teacher */}
                    <div className="p-3 bg-primary/8 rounded-lg border border-primary/20">
                        <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" /> Your Action Items
                        </p>
                        <ul className="space-y-1">
                            {summary.actionItemsForTeacher.map((a, i) => (
                                <li key={i} className="text-xs text-primary flex gap-2">
                                    <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 text-primary" /> {a}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Guidance given */}
                    {summary.guidanceGiven.length > 0 && (
                        <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                            <p className="text-xs font-semibold text-violet-600 mb-1">Guidance Shared with Parent</p>
                            <ul className="space-y-1">
                                {summary.guidanceGiven.map((g, i) => (
                                    <li key={i} className="text-xs text-violet-800 flex gap-2">
                                        <span className="shrink-0 mt-0.5">-</span> {g}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Follow-up */}
                    {summary.followUpNeeded && summary.followUpSuggestion && (
                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
                            <p className="text-xs font-semibold text-rose-600 mb-1">Follow-up Recommended</p>
                            <p className="text-xs text-rose-800">{summary.followUpSuggestion}</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating summary...
                </div>
            )}

            {/* Transcript (collapsible) */}
            {transcript.length > 1 && (
                <details className="group">
                    <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        View conversation transcript ({transcript.length} messages)
                    </summary>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                        {transcript.map((turn, i) => (
                            <div key={i} className={cn(
                                "flex gap-2 text-xs",
                                turn.role === 'agent' ? "text-muted-foreground" : "text-foreground"
                            )}>
                                {turn.role === 'agent'
                                    ? <Bot className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                                    : <UserCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                                }
                                <p className="leading-relaxed">{turn.text}</p>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            <Button variant="outline" className="w-full mt-2" onClick={onClose}>Close</Button>
        </div>
    );
}
