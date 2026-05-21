"use client";

/**
 * AssessmentResultCard — the rendered output of `/api/ai/assessment-scanner`.
 *
 * Extracted from `src/app/assessment-scanner/page.tsx` so:
 *   1. My Library can re-open a saved assessment with the same UI.
 *   2. The action bar (edit / copy / send to parent / print / saved) lives in
 *      one place.
 *   3. Edit mode (override marks, fix OCR, rewrite feedback) doesn't bloat
 *      the upload-form page.
 *
 * Persistence: edits POST to PATCH /api/assessment-scanner/[id]. The server
 * recomputes totals — the client previews them only.
 */

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResultShell } from "@/components/ui/result-shell";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import {
    AlertCircle,
    BookmarkCheck,
    CheckCircle2,
    Copy,
    Info,
    Loader2,
    MessageCircle,
    Pencil,
    Printer,
    Save,
    Undo2,
    X,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type {
    AssessmentScannerOutput,
    GradedQuestion,
} from "@/ai/schemas/assessment-scanner-schemas";
import {
    effectiveQuestion,
    recomputeTotals,
} from "@/ai/schemas/assessment-scanner-utils";
import {
    formatParentSummary,
    shareViaNativeOrWhatsapp,
} from "@/lib/assessment-formatters";

export interface AssessmentResultCardProps {
    result: AssessmentScannerOutput;
    /**
     * Optional metadata to surface in copy/share summaries — the BaseContent
     * record (when loaded from My Library) gives us subject + gradeLevel +
     * topic; the assessment-scanner page itself passes them through directly.
     */
    subject?: string;
    gradeLevel?: string;
    studentName?: string;
    /** When true, the action bar shows "Saved" as a confirmed chip. */
    isSaved?: boolean;
    /** Called after a successful PATCH so the parent can update its state. */
    onResultUpdated?: (next: AssessmentScannerOutput) => void;
}

const PDF_ELEMENT_ID = "assessment-result-pdf";

export function AssessmentResultCard({
    result,
    subject,
    gradeLevel,
    studentName,
    isSaved = true,
    onResultUpdated,
}: AssessmentResultCardProps) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const { toast } = useToast();

    const [edited, setEdited] = useState<AssessmentScannerOutput>(result);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);

    const isFailed = edited.status === "failed";
    const isPartial = edited.status === "partial";

    // Re-derive header score from the (possibly overridden) questions so the
    // teacher sees the new percentage instantly as they edit marks.
    const totals = useMemo(
        () => recomputeTotals(edited.questions, edited.totalMaxMarks),
        [edited.questions, edited.totalMaxMarks],
    );

    const handleResetEdits = useCallback(() => {
        setEdited(result);
        setIsEditing(false);
    }, [result]);

    const handleQuestionOverride = useCallback(
        (questionId: string, patch: Partial<NonNullable<GradedQuestion["teacherOverrides"]>>) => {
            setEdited((prev) => ({
                ...prev,
                questions: prev.questions.map((q) => {
                    if (q.questionId !== questionId) return q;
                    const next: GradedQuestion["teacherOverrides"] = {
                        ...(q.teacherOverrides ?? {}),
                        ...patch,
                    };
                    // Drop keys whose new value matches the AI value — keeps
                    // the override block lean and lets recomputeTotals revert
                    // automatically when the teacher undoes an edit.
                    if (next.marksAwarded === q.marksAwarded) delete next.marksAwarded;
                    if (next.feedback === q.feedback) delete next.feedback;
                    if (next.studentFacingFeedback === q.studentFacingFeedback)
                        delete next.studentFacingFeedback;
                    if (next.studentAnswer === q.studentAnswer) delete next.studentAnswer;
                    const hasAny =
                        next.marksAwarded !== undefined ||
                        next.feedback !== undefined ||
                        next.studentFacingFeedback !== undefined ||
                        next.studentAnswer !== undefined;
                    return {
                        ...q,
                        teacherOverrides: hasAny ? next : undefined,
                    };
                }),
            }));
        },
        [],
    );

    const handleSaveEdits = useCallback(async () => {
        if (!user) {
            toast({
                title: t("Sign in to save edits"),
                variant: "destructive",
            });
            return;
        }
        if (isSaving) return;
        setIsSaving(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(
                `/api/assessment-scanner/${encodeURIComponent(edited.assessmentId)}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ questions: edited.questions }),
                },
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `HTTP ${res.status}`);
            }
            const json = (await res.json()) as {
                ok: boolean;
                data: AssessmentScannerOutput;
            };
            setEdited(json.data);
            setIsEditing(false);
            toast({
                title: t("Saved"),
                description: t("Your edits are stored in My Library."),
            });
            onResultUpdated?.(json.data);
        } catch (err) {
            console.error("[AssessmentResultCard] save failed", err);
            toast({
                title: t("Save failed"),
                description: err instanceof Error ? err.message : t("Please try again"),
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    }, [edited, isSaving, onResultUpdated, t, toast, user]);

    const handleCopySummary = useCallback(async () => {
        try {
            const text = formatParentSummary(edited, {
                subject,
                gradeLevel,
                studentName,
            });
            await navigator.clipboard.writeText(text);
            toast({
                title: t("Copied"),
                description: t("Parent summary copied to clipboard."),
            });
        } catch (err) {
            console.error("[AssessmentResultCard] copy failed", err);
            toast({ title: t("Copy failed"), variant: "destructive" });
        }
    }, [edited, gradeLevel, studentName, subject, t, toast]);

    const handleSendToParent = useCallback(async () => {
        const text = formatParentSummary(edited, {
            subject,
            gradeLevel,
            studentName,
        });
        await shareViaNativeOrWhatsapp(text);
    }, [edited, gradeLevel, studentName, subject]);

    const handleCopyQuestionFeedback = useCallback(
        async (q: GradedQuestion) => {
            const eff = effectiveQuestion(q);
            const text = eff.studentFacingFeedback || eff.feedback || "";
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                toast({ title: t("Copied") });
            } catch {
                toast({ title: t("Copy failed"), variant: "destructive" });
            }
        },
        [t, toast],
    );

    const handlePrintPdf = useCallback(async () => {
        if (pdfBusy) return;
        setPdfBusy(true);
        try {
            const { exportElementToPdf } = await import("@/lib/export-pdf");
            const filenameStub =
                studentName || `assessment-${edited.assessmentId.slice(0, 8)}`;
            const out = await exportElementToPdf({
                elementId: PDF_ELEMENT_ID,
                filename: `${filenameStub}-result.pdf`,
                hideSelector: ".no-print, .print\\:hidden",
            });
            if (!out.ok) {
                toast({
                    title: t("PDF failed"),
                    description: out.error,
                    variant: "destructive",
                });
            }
        } catch (err) {
            console.error("[AssessmentResultCard] PDF failed", err);
            toast({ title: t("PDF failed"), variant: "destructive" });
        } finally {
            setPdfBusy(false);
        }
    }, [edited.assessmentId, pdfBusy, studentName, t, toast]);

    const hasOverrides = useMemo(
        () => edited.questions.some((q) => q.teacherOverrides),
        [edited.questions],
    );

    const actions = useMemo(() => {
        if (isEditing) {
            return [
                {
                    label: t("Save edits"),
                    icon: isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    ),
                    onClick: handleSaveEdits,
                    disabled: isSaving,
                    variant: "default" as const,
                    loading: isSaving,
                },
                {
                    label: t("Cancel"),
                    icon: <X className="h-4 w-4" />,
                    onClick: handleResetEdits,
                    variant: "ghost" as const,
                },
            ];
        }
        return [
            {
                label: t("Edit"),
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => setIsEditing(true),
                variant: "outline" as const,
            },
            {
                label: t("Copy summary"),
                icon: <Copy className="h-4 w-4" />,
                onClick: handleCopySummary,
                variant: "outline" as const,
            },
            {
                label: t("Send to parent"),
                icon: <MessageCircle className="h-4 w-4" />,
                onClick: handleSendToParent,
                variant: "outline" as const,
            },
            {
                label: pdfBusy ? t("Preparing PDF…") : t("Print / PDF"),
                icon: pdfBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Printer className="h-4 w-4" />
                ),
                onClick: handlePrintPdf,
                disabled: pdfBusy,
                variant: "outline" as const,
                loading: pdfBusy,
            },
            {
                label: isSaved ? t("Saved") : t("Save"),
                icon: <BookmarkCheck className="h-4 w-4" />,
                onClick: () => undefined,
                disabled: true,
                variant: "outline" as const,
            },
        ];
    }, [
        handleCopySummary,
        handlePrintPdf,
        handleResetEdits,
        handleSaveEdits,
        handleSendToParent,
        isEditing,
        isSaved,
        isSaving,
        pdfBusy,
        t,
    ]);

    const meta = useMemo(() => {
        const items: { value: string; label?: string }[] = [];
        if (subject) items.push({ value: subject });
        if (gradeLevel) items.push({ value: gradeLevel });
        items.push({
            value: `${edited.questions.length} ${edited.questions.length === 1 ? t("question") : t("questions")}`,
        });
        items.push({
            value: `${edited.pageCount} ${edited.pageCount === 1 ? t("page") : t("pages")}`,
        });
        if (edited.teacherEditedAt) {
            items.push({ value: t("Edited") });
        }
        return items;
    }, [edited.pageCount, edited.questions.length, edited.teacherEditedAt, gradeLevel, subject, t]);

    return (
        <ResultShell
            id={PDF_ELEMENT_ID}
            title={t("Result")}
            description={
                isFailed
                    ? t("Grading could not be completed.")
                    : t("Review the AI grades. Edit any score or feedback before sharing.")
            }
            icon={
                isFailed ? (
                    <XCircle className="h-6 w-6 text-destructive" />
                ) : isPartial ? (
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                ) : (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                )
            }
            meta={meta}
            actions={actions}
        >
            <div className="space-y-5">
                {/* Score header — re-derived live in edit mode. */}
                {!isFailed && (
                    <div className="flex items-end justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                {t("Overall")}
                            </div>
                            <div className="text-3xl font-bold tabular-nums leading-tight">
                                {totals.scorePct.toFixed(0)}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {totals.totalAwardedMarks.toFixed(1)} / {totals.totalMaxMarks}{" "}
                                {t("marks")} · {totals.letterGrade}
                            </div>
                        </div>
                        {hasOverrides && (
                            <Badge
                                variant="outline"
                                className="bg-primary/5 text-primary border-primary/30 text-xs"
                            >
                                {t("Includes teacher edits")}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Image quality warnings (hidden from print/PDF). */}
                {edited.imageQualityWarnings.length > 0 && (
                    <Alert
                        variant="default"
                        className="border-amber-500/50 bg-amber-500/5 print:hidden"
                    >
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t("Image quality")}</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1 text-xs">
                                {edited.imageQualityWarnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {totals.needsReviewCount > 0 && (
                    <Alert
                        variant="default"
                        className="border-amber-500/50 bg-amber-500/5 print:hidden"
                    >
                        <Info className="h-4 w-4" />
                        <AlertTitle>{t("Teacher review suggested")}</AlertTitle>
                        <AlertDescription>
                            {totals.needsReviewCount === 1
                                ? t("1 question is uncertain. Please verify.")
                                : `${totals.needsReviewCount} ${t("questions are uncertain. Please verify.")}`}
                        </AlertDescription>
                    </Alert>
                )}

                {edited.questions.length > 0 && (
                    <Accordion type="multiple" className="w-full">
                        {edited.questions.map((q, i) => (
                            <QuestionRow
                                key={q.questionId}
                                question={q}
                                index={i}
                                isEditing={isEditing}
                                onOverride={handleQuestionOverride}
                                onCopyFeedback={handleCopyQuestionFeedback}
                            />
                        ))}
                    </Accordion>
                )}

                {edited.recommendedNextSteps.length > 0 && (
                    <div className="border-t border-border/30 pt-4 print:hidden">
                        <h3 className="font-headline text-sm font-semibold mb-2">
                            {t("Next steps for the teacher")}
                        </h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {edited.recommendedNextSteps.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {edited.studentRecommendations.length > 0 && (
                    <div className="border-t border-border/30 pt-4">
                        <h3 className="font-headline text-sm font-semibold mb-2">
                            {t("For the student")}
                        </h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {edited.studentRecommendations.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Footer link to library — hidden from print. */}
                {isSaved && !isEditing && (
                    <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-4 text-xs text-muted-foreground print:hidden">
                        <span className="inline-flex items-center gap-1.5">
                            <BookmarkCheck className="h-3.5 w-3.5 text-green-600" />
                            {t("Saved to My Library")}
                        </span>
                        <Link
                            href="/my-library"
                            className="text-primary hover:underline font-medium"
                        >
                            {t("View in My Library")}
                        </Link>
                    </div>
                )}

                {isEditing && hasOverrides && (
                    <div className="flex items-center justify-end gap-2 text-xs print:hidden">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleResetEdits}
                            className="h-8 text-xs"
                        >
                            <Undo2 className="h-3.5 w-3.5 mr-1" />
                            {t("Revert to AI values")}
                        </Button>
                    </div>
                )}
            </div>
        </ResultShell>
    );
}

function QuestionRow({
    question,
    index,
    isEditing,
    onOverride,
    onCopyFeedback,
}: {
    question: GradedQuestion;
    index: number;
    isEditing: boolean;
    onOverride: (
        questionId: string,
        patch: Partial<NonNullable<GradedQuestion["teacherOverrides"]>>,
    ) => void;
    onCopyFeedback: (q: GradedQuestion) => void;
}) {
    const { t } = useLanguage();
    const eff = effectiveQuestion(question);
    const pct = question.marksMax > 0 ? (eff.marksAwarded / question.marksMax) * 100 : 0;
    const tone =
        pct >= 80
            ? "text-green-600"
            : pct >= 50
              ? "text-amber-600"
              : "text-destructive";

    const isOverridden = Boolean(question.teacherOverrides);

    return (
        <AccordionItem value={question.questionId}>
            <AccordionTrigger className="hover:no-underline">
                <div className="flex items-start justify-between w-full pr-4 gap-4 text-left">
                    <span className="font-medium text-sm flex-1 line-clamp-2">
                        Q{index + 1}. {question.questionText}
                    </span>
                    <span className={`tabular-nums text-sm font-semibold ${tone}`}>
                        {eff.marksAwarded.toFixed(1)} / {question.marksMax}
                    </span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {question.needsTeacherReview && (
                        <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-700 border-amber-500/30"
                        >
                            {t("Needs review")}
                        </Badge>
                    )}
                    {isOverridden && (
                        <Badge
                            variant="outline"
                            className="bg-primary/5 text-primary border-primary/30"
                        >
                            {t("Edited by you")}
                        </Badge>
                    )}
                </div>

                {/* Marks override (edit mode only) */}
                {isEditing && (
                    <div className="flex items-center gap-2 print:hidden">
                        <label className="text-xs font-semibold text-muted-foreground">
                            {t("Marks")}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={question.marksMax}
                            step={0.5}
                            value={eff.marksAwarded}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? 0 : Number(raw);
                                const clamped = Math.max(
                                    0,
                                    Math.min(question.marksMax, Number.isFinite(parsed) ? parsed : 0),
                                );
                                onOverride(question.questionId, { marksAwarded: clamped });
                            }}
                            className="h-9 w-24 tabular-nums"
                        />
                        <span className="text-xs text-muted-foreground tabular-nums">
                            / {question.marksMax}
                        </span>
                    </div>
                )}

                <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {t("Student wrote")}
                    </div>
                    {isEditing ? (
                        <Textarea
                            value={eff.studentAnswer}
                            onChange={(e) =>
                                onOverride(question.questionId, {
                                    studentAnswer: e.target.value,
                                })
                            }
                            className="min-h-[80px] font-mono text-xs print:hidden"
                            placeholder={t("Fix any OCR error in what the student wrote.")}
                        />
                    ) : (
                        <div className="rounded-md bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
                            {eff.studentAnswer || `(${t("no answer written")})`}
                        </div>
                    )}
                </div>

                <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {t("Expected")}
                    </div>
                    <div className="rounded-md bg-muted/20 p-3 font-mono text-xs whitespace-pre-wrap">
                        {question.expectedAnswer}
                    </div>
                </div>

                {question.partialCreditBreakdown.length > 0 && (
                    <div className="print:hidden">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">
                            {t("Marks breakdown")}
                        </div>
                        <ul className="text-xs space-y-1">
                            {question.partialCreditBreakdown.map((s, j) => (
                                <li key={j} className="flex justify-between gap-4">
                                    <span>{s.step}</span>
                                    <span className="tabular-nums font-medium">
                                        {s.earned} / {s.max}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="print:hidden">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {t("Feedback")}
                    </div>
                    {isEditing ? (
                        <Textarea
                            value={eff.feedback}
                            onChange={(e) =>
                                onOverride(question.questionId, { feedback: e.target.value })
                            }
                            className="min-h-[70px] text-sm"
                            placeholder={t("Teacher-facing notes. Not shown to parent or student.")}
                        />
                    ) : (
                        <p className="text-sm">{eff.feedback}</p>
                    )}
                </div>

                {(eff.studentFacingFeedback || isEditing) && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                                {t("For the student")}
                            </span>
                            {!isEditing && eff.studentFacingFeedback && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onCopyFeedback(question)}
                                    className="h-7 px-2 text-xs no-print print:hidden"
                                >
                                    <Copy className="h-3 w-3 mr-1" />
                                    {t("Copy")}
                                </Button>
                            )}
                        </div>
                        {isEditing ? (
                            <Textarea
                                value={eff.studentFacingFeedback}
                                onChange={(e) =>
                                    onOverride(question.questionId, {
                                        studentFacingFeedback: e.target.value,
                                    })
                                }
                                className="min-h-[70px] text-sm italic"
                                placeholder={t("Encouraging note for the student.")}
                            />
                        ) : (
                            <p className="text-sm italic">{eff.studentFacingFeedback}</p>
                        )}
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
}
