"use client";

/**
 * ReportDialog — moderation v1.
 *
 * Reason radio (harassment / inappropriate / spam / other) + optional
 * free-text details (≤500 chars). Submits via POST /api/moderation/report
 * (rate-limited server-side to 10/day).
 */
import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import {
    reportContentAction,
    REPORT_FREETEXT_MAX,
    type ReportReason,
    type ReportTargetType,
} from "@/lib/api/moderation";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
    { value: "harassment", label: "Harassment" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "spam", label: "Spam" },
    { value: "other", label: "Other" },
];

interface ReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetType: ReportTargetType;
    targetId: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [reason, setReason] = useState<ReportReason | "">("");
    const [freeText, setFreeText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setReason("");
        setFreeText("");
    };

    const handleSubmit = async () => {
        if (!reason) return;
        setSubmitting(true);
        try {
            await reportContentAction({
                targetType,
                targetId,
                reason,
                freeText: freeText.trim() || undefined,
            });
            toast({
                title: t("Report submitted"),
                description: t("Thank you. Our team will review this report."),
            });
            reset();
            onOpenChange(false);
        } catch (err: any) {
            toast({
                title: t("Could not complete this action. Please try again."),
                description: typeof err?.message === "string" ? err.message : undefined,
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
            <DialogContent className="sm:max-w-[440px] rounded-md p-6 border border-border shadow-elevated">
                <DialogHeader>
                    <DialogTitle className="type-h3 flex items-center gap-2">
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        {t("Report content")}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {t("Why are you reporting this?")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-3">
                    <RadioGroup
                        value={reason}
                        onValueChange={(v) => setReason(v as ReportReason)}
                        className="space-y-1"
                    >
                        {REASON_OPTIONS.map((opt) => (
                            <div key={opt.value} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors">
                                <RadioGroupItem value={opt.value} id={`report-reason-${opt.value}`} />
                                <Label
                                    htmlFor={`report-reason-${opt.value}`}
                                    className="flex-1 cursor-pointer font-medium text-foreground"
                                >
                                    {t(opt.label)}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>

                    <div className="space-y-2">
                        <Label htmlFor="report-details" className="font-bold text-foreground">
                            {t("Add details (optional)")}
                        </Label>
                        <Textarea
                            id="report-details"
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                            maxLength={REPORT_FREETEXT_MAX}
                            rows={3}
                            className="rounded-md border-border resize-none focus-visible:ring-primary/30"
                        />
                        <p className="text-right text-xs text-muted-foreground">
                            {freeText.length}/{REPORT_FREETEXT_MAX}
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-md font-semibold">
                        {t("Cancel")}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !reason}
                        className="rounded-md font-semibold px-6 shadow-soft"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {t("Submit report")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
