"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TWILIO_LANGUAGE_MAP } from "@/types/attendance";
import type { Student, OutreachReason } from "@/types/attendance";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import {
    Loader2, Phone, Copy, RefreshCw, CheckCircle2,
    CalendarX2, TrendingDown, AlertTriangle, Star,
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

type Step = "reason" | "note" | "review";

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
    const [done, setDone] = useState(false);

    const canCall = twilioConfigured && !!TWILIO_LANGUAGE_MAP[student.parentLanguage];
    const unsupportedForCall = twilioConfigured && !TWILIO_LANGUAGE_MAP[student.parentLanguage];

    const handleClose = () => {
        onOpenChange(false);
        // Reset after animation
        setTimeout(() => {
            setStep("reason");
            setReason(null);
            setNote("");
            setGeneratedMessage("");
            setDone(false);
        }, 300);
    };

    const generateMessage = async () => {
        if (!reason) return;
        setGenerating(true);
        try {
            const res = await fetch('/api/ai/parent-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const { outreachId } = await saveOutreach('twilio_call');

            // Initiate call
            const res = await fetch('/api/attendance/call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    outreachId,
                    to: student.parentPhone,
                    parentLanguage: student.parentLanguage,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? 'Call failed');
            }

            setDone(true);
            toast({ title: `Calling ${student.name}'s parent…`, description: "The AI message will be played when they pick up." });
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
        setDone(true);
        toast({ title: "Copied to clipboard", description: "Paste in WhatsApp to send." });
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 font-black">
                        Contact {student.name}&apos;s Parent
                    </DialogTitle>
                    <p className="text-xs text-slate-400 mt-1">
                        {student.parentPhone} · {student.parentLanguage}
                    </p>
                </DialogHeader>

                {done ? (
                    <div className="flex flex-col items-center py-8 space-y-3 text-center">
                        <div className="p-4 bg-emerald-50 rounded-full">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        </div>
                        <p className="font-bold text-slate-800">All done!</p>
                        <p className="text-xs text-slate-400">Outreach logged for {student.name}.</p>
                        <Button className="mt-2" variant="outline" onClick={handleClose}>Close</Button>
                    </div>
                ) : step === "reason" ? (
                    <div className="space-y-3 mt-2">
                        <p className="text-xs text-slate-500 font-medium">Select reason for outreach:</p>
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
                                                ? "border-orange-400 bg-orange-50"
                                                : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            reason === r.value ? "bg-orange-100" : "bg-slate-100"
                                        )}>
                                            <Icon className={cn("h-4 w-4", reason === r.value ? "text-orange-600" : "text-slate-500")} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                                            <p className="text-xs text-slate-400">{r.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <Button
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-2"
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
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                                onClick={generateMessage}
                                disabled={generating}
                            >
                                {generating
                                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                                    : "Generate Message"
                                }
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Review step */
                    <div className="space-y-4 mt-2">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                            {generatedMessage}
                        </div>

                        <Button
                            variant="ghost" size="sm"
                            className="text-xs text-slate-500 w-full"
                            onClick={generateMessage}
                            disabled={generating}
                        >
                            {generating
                                ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Regenerating…</>
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
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Calling…</>
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
