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
    Calculator,
    CheckCircle2,
    Compass,
    Copy,
    FileText,
    Hourglass,
    Info,
    Lightbulb,
    ListChecks,
    Loader2,
    type LucideIcon,
    MessageCircle,
    Pencil,
    PenLine,
    Printer,
    Save,
    Undo2,
    X,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import type {
    AssessmentScannerOutput,
    GradedQuestion,
} from "@/ai/schemas/assessment-scanner-schemas";
import {
    effectiveQuestion,
    isGradedResult,
    recomputeTotals,
} from "@/ai/schemas/assessment-scanner-utils";
import { resolveSubjectFamily } from "@/ai/schemas/assessment-scanner-constants";
import {
    formatParentSummary,
    formatStudentHandout,
    latexToReadable,
    shareViaNativeOrWhatsapp,
    stripQuestionLabel,
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
    const [parentNoteDraft, setParentNoteDraft] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [openItems, setOpenItems] = useState<string[]>([]);
    const [exporting, setExporting] = useState(false);

    const allQuestionIds = useMemo(
        () => (edited.questions ?? []).map((q) => q.questionId),
        [edited.questions],
    );

    const isFailed = edited.status === "failed";
    const isPartial = edited.status === "partial";
    // Failed-scan gate (migrated from prod): a scan that graded nothing has no
    // grade to copy, send, print or edit into. Every content action is disabled
    // so a 0% empty extraction can never be turned into a real-looking grade.
    const isShareable = isGradedResult(edited);

    // Re-derive header score from the (possibly overridden) questions so the
    // teacher sees the new percentage instantly as they edit marks.
    // Omit the totalMaxMarks override so the denominator is the sum of the
    // (possibly teacher-edited) per-question marksMax — editing a question's
    // max now updates the overall score live.
    const totals = useMemo(
        () => recomputeTotals(edited.questions ?? []),
        [edited.questions],
    );

    // Summary tiles — derived from the (possibly overridden) questions so they
    // update live alongside the score in edit mode.
    const summary = useMemo(() => {
        // Bug #8: count only gradable questions (marksMax > 0). A question_only
        // page contributes 0/0 questions that must not inflate "Questions" or
        // distort the "Correct" comparison.
        const qs = (edited.questions ?? []).filter(
            (q) => effectiveQuestion(q).marksMax > 0,
        );
        const total = qs.length;
        const attempted = qs.filter(
            (q) => effectiveQuestion(q).studentAnswer.trim().length > 0,
        ).length;
        const correct = qs.filter((q) => {
            const eff = effectiveQuestion(q);
            return eff.marksAwarded >= eff.marksMax;
        }).length;
        return { total, attempted, correct };
    }, [edited.questions]);

    // Mathematics answers read best in monospace; every other subject reads as
    // prose (bug #6). Falls back to non-mono when subject is unknown.
    const isMathSubject = useMemo(
        () => (subject ? resolveSubjectFamily(subject) === "mathematics" : false),
        [subject],
    );

    const scoreTone =
        totals.scorePct >= 80
            ? "text-success"
            : totals.scorePct >= 50
              ? "text-warning"
              : "text-destructive";

    const encouragement =
        totals.scorePct >= 90
            ? t("Excellent work! 🎉")
            : totals.scorePct >= 70
              ? t("Well done 👍")
              : totals.scorePct >= 50
                ? t("Good effort")
                : t("Keep practising");

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
                    if (next.marksMax === q.marksMax) delete next.marksMax;
                    if (next.feedback === q.feedback) delete next.feedback;
                    // Array field — compare by value so an unchanged edit reverts.
                    if (
                        next.improvementPoints &&
                        JSON.stringify(next.improvementPoints) ===
                            JSON.stringify(q.improvementPoints ?? [])
                    )
                        delete next.improvementPoints;
                    if (next.studentAnswer === q.studentAnswer) delete next.studentAnswer;
                    const hasAny =
                        next.marksAwarded !== undefined ||
                        next.marksMax !== undefined ||
                        next.feedback !== undefined ||
                        next.improvementPoints !== undefined ||
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

    const handleParentNoteChange = useCallback((value: string) => {
        setParentNoteDraft(value);
        setEdited((prev) => ({
            ...prev,
            teacherParentNote: value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
        }));
    }, []);

    // Drop the raw draft when leaving edit mode so re-entering re-seeds from the
    // (possibly just-saved) normalised array.
    useEffect(() => {
        if (!isEditing) setParentNoteDraft(null);
    }, [isEditing]);

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
                    body: JSON.stringify({
                        questions: edited.questions,
                        teacherParentNote: edited.teacherParentNote ?? [],
                    }),
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

    const handleCopyStudentHandout = useCallback(async () => {
        try {
            const text = formatStudentHandout(edited, {
                subject,
                gradeLevel,
                studentName,
            });
            await navigator.clipboard.writeText(text);
            toast({
                title: t("Copied"),
                description: t("Student handout copied to clipboard."),
            });
        } catch (err) {
            console.error("[AssessmentResultCard] copy student handout failed", err);
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
            // Copy the STUDENT feedback: the improvement bullets.
            // (The teacher's note is deliberately excluded.)
            const parts: string[] = [];
            for (const p of eff.improvementPoints) {
                parts.push(`• ${latexToReadable(p)}`);
            }
            const text = parts.join("\n");
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
        // Expand every question and drop the title clamp so the captured DOM
        // holds the full text; wait two frames for React + the browser to paint
        // the newly-mounted content before html2canvas reads the element.
        setExporting(true);
        await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
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
            setExporting(false);
            setPdfBusy(false);
        }
    }, [edited.assessmentId, pdfBusy, studentName, t, toast]);

    const hasOverrides = useMemo(
        () => (edited.questions ?? []).some((q) => q.teacherOverrides),
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
                disabled: !isShareable,
                variant: "outline" as const,
            },
            {
                label: t("Copy summary"),
                icon: <Copy className="h-4 w-4" />,
                onClick: handleCopySummary,
                disabled: !isShareable,
                variant: "outline" as const,
            },
            {
                label: t("Copy for student"),
                icon: <Copy className="h-4 w-4" />,
                onClick: handleCopyStudentHandout,
                disabled: !isShareable,
                variant: "outline" as const,
            },
            {
                label: t("Send to parent"),
                icon: <MessageCircle className="h-4 w-4" />,
                onClick: handleSendToParent,
                disabled: !isShareable,
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
                disabled: pdfBusy || !isShareable,
                variant: "outline" as const,
                loading: pdfBusy,
            },
            // NOTE: no "Saved" action here. A fresh grade is auto-persisted and
            // re-opens from My Library, so a Save button would either be a no-op
            // or permanently disabled. The "Saved to My Library" footer below is
            // the single source of truth for saved state.
        ];
    }, [
        handleCopyStudentHandout,
        handleCopySummary,
        handlePrintPdf,
        handleResetEdits,
        handleSaveEdits,
        handleSendToParent,
        isEditing,
        isSaving,
        isShareable,
        pdfBusy,
        t,
    ]);

    const meta = useMemo(() => {
        const items: { value: string; label?: string }[] = [];
        if (subject) items.push({ value: subject });
        if (gradeLevel) items.push({ value: gradeLevel });
        const questionCount = (edited.questions ?? []).length;
        items.push({
            value: `${questionCount} ${questionCount === 1 ? t("question") : t("questions")}`,
        });
        items.push({
            value: `${edited.pageCount} ${edited.pageCount === 1 ? t("page") : t("pages")}`,
        });
        if (edited.teacherEditedAt) {
            items.push({ value: t("Edited") });
        }
        return items;
    }, [edited.pageCount, edited.questions, edited.teacherEditedAt, gradeLevel, subject, t]);

    return (
        <ResultShell
            id={PDF_ELEMENT_ID}
            className={exporting ? "pdf-exporting" : undefined}
            actionsLayout="stacked"
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
                    <AlertCircle className="h-6 w-6 text-warning" />
                ) : (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                )
            }
            meta={meta}
            actions={actions}
        >
            <div className="space-y-5">
                {/* Score header + summary tiles — re-derived live in edit mode.
                    Gated on isGradedResult (migrated from prod): a scan that graded
                    nothing must never render the 0% / E figures as a real score. */}
                {isShareable && (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
                            {/* Overall score */}
                            <div className="flex flex-col justify-center">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                    {t("Overall score")}
                                </div>
                                <div
                                    className={`text-4xl font-bold tabular-nums leading-tight ${scoreTone}`}
                                >
                                    {totals.scorePct.toFixed(0)}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {totals.totalAwardedMarks.toFixed(1)} / {totals.totalMaxMarks}{" "}
                                    {t("marks")} · {totals.letterGrade}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                                        {encouragement}
                                    </span>
                                    {hasOverrides && (
                                        <Badge
                                            variant="outline"
                                            className="bg-primary/5 text-primary border-primary/30 text-xs"
                                        >
                                            {t("Includes teacher edits")}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Summary tiles */}
                            <div className="grid grid-cols-3 gap-2 sm:min-w-[18rem]">
                                <SummaryTile
                                    icon={<FileText className="h-4 w-4" />}
                                    label={t("Questions")}
                                    value={String(summary.total)}
                                />
                                <SummaryTile
                                    icon={<ListChecks className="h-4 w-4" />}
                                    label={t("Attempted")}
                                    value={String(summary.attempted)}
                                />
                                <SummaryTile
                                    icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                                    label={t("Correct")}
                                    value={String(summary.correct)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Nothing-to-share gate (migrated from prod): a scan that graded
                    nothing must SAY so — never render as an empty or 0% result, the
                    parent being the audience least able to tell the difference. */}
                {!isShareable && (
                    <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>{t("Nothing to share")}</AlertTitle>
                        <AlertDescription className="space-y-2">
                            <p>
                                {t("This scan did not grade any questions, so there is no score to send. Re-upload clearer photos and scan again.")}
                            </p>
                            <p className="font-medium">
                                {t("Re-take the photos in good light with the whole page in frame, then scan again.")}
                            </p>
                        </AlertDescription>
                    </Alert>
                )}

                {isPartial && (
                    <Alert
                        variant="default"
                        className="border-warning/50 bg-warning/5"
                    >
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t("Partial result — some pages couldn't be read")}</AlertTitle>
                        <AlertDescription>
                            {t("This grade covers only the pages we could process. Review the flagged questions, or re-scan the unreadable pages for a complete grade.")}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Image quality warnings (hidden from print/PDF). */}
                {(edited.imageQualityWarnings ?? []).length > 0 && (
                    <Alert
                        variant="default"
                        className="border-warning/50 bg-warning/5 print:hidden"
                    >
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t("Image quality")}</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1 text-xs">
                                {(edited.imageQualityWarnings ?? []).map((w, i) => (
                                    <li key={i}>{w}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Blank / skipped pages — informational, not a quality problem. */}
                {(edited.skippedPageNotices ?? []).length > 0 && (
                    <Alert
                        variant="default"
                        className="border-info/40 bg-info/5 print:hidden"
                    >
                        <Info className="h-4 w-4" />
                        <AlertTitle>{t("Some pages were blank")}</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1 text-xs">
                                {(edited.skippedPageNotices ?? []).map((n, i) => (
                                    <li key={i}>{n}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {totals.needsReviewCount > 0 && (
                    <Alert
                        variant="default"
                        className="border-warning/50 bg-warning/5 print:hidden"
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

                {(edited.questions ?? []).length > 0 && (
                    <Accordion
                        type="multiple"
                        className="w-full"
                        value={exporting ? allQuestionIds : openItems}
                        onValueChange={setOpenItems}
                    >
                        {(edited.questions ?? []).map((q, i) => (
                            <QuestionRow
                                key={q.questionId}
                                question={q}
                                index={i}
                                isEditing={isEditing}
                                expanded={exporting}
                                isMath={isMathSubject}
                                onOverride={handleQuestionOverride}
                                onCopyFeedback={handleCopyQuestionFeedback}
                            />
                        ))}
                    </Accordion>
                )}

                {(edited.recommendedNextSteps ?? []).length > 0 && (
                    <div className="border-t border-border/30 pt-4 print:hidden">
                        <h3 className="font-headline text-sm font-semibold mb-2">
                            {t("Next steps for the teacher")}
                        </h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {(edited.recommendedNextSteps ?? []).map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {(edited.studentRecommendations ?? []).length > 0 && (
                    <div className="border-t border-border/30 pt-4">
                        <h3 className="font-headline text-sm font-semibold mb-2">
                            {t("For the student")}
                        </h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                            {(edited.studentRecommendations ?? []).map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Teacher's note to the parent. Hidden from print/PDF — the PDF
                    is the student's handout; this note goes to the parent via the
                    Copy/Send summary actions. */}
                {(isEditing ||
                    (edited.teacherParentNote ?? []).length > 0) && (
                    <div className="border-t border-border/30 pt-4 print:hidden">
                        <h3 className="font-headline text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <MessageCircle className="h-4 w-4 text-primary" />
                            {t("Note to parent")}
                        </h3>
                        {isEditing ? (
                            <Textarea
                                value={
                                    parentNoteDraft ??
                                    (edited.teacherParentNote ?? []).join("\n")
                                }
                                onChange={(e) => handleParentNoteChange(e.target.value)}
                                className="min-h-[90px] text-sm"
                                placeholder={t(
                                    "One point per line — e.g. neat handwriting; missed a concept; answers too short.",
                                )}
                            />
                        ) : (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                {(edited.teacherParentNote ?? []).map((point, i) => (
                                    <li key={i}>{point}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Library-save truth (migrated from prod): show the real state.
                    Never claim "Saved to My Library" when the write did not land —
                    say "Not saved" instead. Only shown for a graded, non-editing card. */}
                {isShareable && !isEditing && (
                    <div className="flex items-center justify-between gap-3 border-t border-border/30 pt-4 text-xs text-muted-foreground print:hidden">
                        <span className="inline-flex items-center gap-1.5">
                            {isSaved ? (
                                <>
                                    <BookmarkCheck className="h-3.5 w-3.5 text-success" />
                                    {t("Saved to My Library")}
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-3.5 w-3.5 text-warning" />
                                    {t("Not saved to My Library")}
                                </>
                            )}
                        </span>
                        {isSaved && (
                            <Link
                                href="/my-library"
                                className="text-primary hover:underline font-medium"
                            >
                                {t("View in My Library")}
                            </Link>
                        )}
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

/** Compact stat tile used in the result summary row. */
function SummaryTile({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <span className="shrink-0 text-muted-foreground">{icon}</span>
            <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold tabular-nums">{value}</div>
            </div>
        </div>
    );
}

/**
 * Encouraging, student-friendly label for each AI mistake-pattern classification.
 * The AI already emits `mistakePattern` on every graded question; this surfaces
 * it so a slip reads as "not a failure" rather than staying hidden metadata.
 * Tone by category: slips are soft/amber-blue, a concept gap is a gentle violet
 * (never destructive red — colour must not shame), a correct approach is green.
 * `label` strings pass through `t()` so they localise once added to the
 * dictionary and fall back to English until then.
 */
const MISTAKE_PATTERN_LABELS: Record<
    NonNullable<GradedQuestion["mistakePattern"]>,
    { label: string; className: string; Icon: LucideIcon }
> = {
    none: {
        label: "Correct approach",
        className: "bg-success/10 text-success border-success/30",
        Icon: CheckCircle2,
    },
    computational: {
        label: "Small calculation slip — the idea is right",
        className: "bg-warning/10 text-warning border-warning/30",
        Icon: Calculator,
    },
    transcription: {
        label: "You knew it — just copied it down wrong",
        className: "bg-warning/10 text-warning border-warning/30",
        Icon: PenLine,
    },
    incomplete: {
        label: "Good start — it just needs finishing",
        className: "bg-info/10 text-info border-info/30",
        Icon: Hourglass,
    },
    conceptual: {
        label: "Let's revisit this idea together",
        className: "bg-violet-500/10 text-violet-700 border-violet-500/30", // design-token-allow: distinct category hue, no semantic token
        Icon: Lightbulb,
    },
    off_topic: {
        label: "Re-read the question — check what it asks",
        className: "bg-muted/10 text-muted border-muted/30",
        Icon: Compass,
    },
};

function QuestionRow({
    question,
    index,
    isEditing,
    expanded,
    isMath,
    onOverride,
    onCopyFeedback,
}: {
    question: GradedQuestion;
    index: number;
    isEditing: boolean;
    /** When true (PDF export), show the full question title, not a 2-line clamp. */
    expanded: boolean;
    /** Maths answers render in monospace; other subjects render as prose. */
    isMath: boolean;
    onOverride: (
        questionId: string,
        patch: Partial<NonNullable<GradedQuestion["teacherOverrides"]>>,
    ) => void;
    onCopyFeedback: (q: GradedQuestion) => void;
}) {
    const { t } = useLanguage();
    const eff = effectiveQuestion(question);
    // Raw text for the improvement-points textarea while editing. Same reason as
    // the parent-note editor: binding to `array.join("\n")` re-normalises on
    // every keystroke and eats the space/newline being typed. The textarea owns
    // its raw string; we still commit a normalised string[] via onOverride.
    // `null` = not editing / not yet touched → fall back to the committed value.
    const [improvementDraft, setImprovementDraft] = useState<string | null>(null);
    useEffect(() => {
        if (!isEditing) setImprovementDraft(null);
    }, [isEditing]);
    const isGradable = eff.marksMax > 0;
    const pct = isGradable ? (eff.marksAwarded / eff.marksMax) * 100 : 0;
    // Non-gradable rows (question_only / marksMax 0) were never scored — show a
    // neutral cue, not the red "incorrect" tone a 0% would otherwise imply.
    const tone = !isGradable
        ? "text-muted-foreground"
        : pct >= 80
          ? "text-success"
          : pct >= 50
            ? "text-warning"
            : "text-destructive";

    const isOverridden = Boolean(question.teacherOverrides);

    // Encouraging label for the AI's mistake classification (null when the
    // grader didn't classify — e.g. older saved results).
    const patternInfo = question.mistakePattern
        ? MISTAKE_PATTERN_LABELS[question.mistakePattern]
        : null;

    // Status glyph mirrors the mark tone with a shape cue, so correctness is not
    // conveyed by colour alone.
    const statusIcon = !isGradable ? (
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
    ) : pct >= 80 ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
    ) : pct >= 50 ? (
        <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
    ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
    );

    return (
        <AccordionItem value={question.questionId}>
            <AccordionTrigger className="hover:no-underline">
                <div className="flex items-start justify-between w-full pr-4 gap-3 text-left">
                    <span className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="mt-0.5">{statusIcon}</span>
                        <span
                            className={`font-medium text-sm ${expanded ? "" : "line-clamp-2"}`}
                        >
                            Q{index + 1}. {stripQuestionLabel(latexToReadable(question.questionText))}
                        </span>
                    </span>
                    <span className={`tabular-nums text-sm font-semibold shrink-0 ${tone}`}>
                        {eff.marksAwarded.toFixed(1)} / {eff.marksMax}
                    </span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                    {patternInfo && (
                        <Badge
                            variant="outline"
                            className={patternInfo.className}
                        >
                            <patternInfo.Icon className="h-3 w-3 mr-1 shrink-0" />
                            {t(patternInfo.label)}
                        </Badge>
                    )}
                    {question.needsTeacherReview && (
                        <Badge
                            variant="secondary"
                            className="bg-warning/10 text-warning border-warning/30"
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

                {/* Marks override (edit mode only) — both the awarded mark and
                    the denominator (out of) are editable, so a teacher can fix an
                    AI-guessed max like "/ 5" down to "/ 2". */}
                {isEditing && (
                    <div className="flex flex-wrap items-center gap-2 print:hidden">
                        <label className="text-xs font-semibold text-muted-foreground">
                            {t("Marks")}
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={eff.marksMax}
                            step={0.5}
                            value={eff.marksAwarded}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? 0 : Number(raw);
                                const clamped = Math.max(
                                    0,
                                    Math.min(eff.marksMax, Number.isFinite(parsed) ? parsed : 0),
                                );
                                onOverride(question.questionId, { marksAwarded: clamped });
                            }}
                            className="h-9 w-20 tabular-nums"
                            aria-label={t("Marks awarded")}
                        />
                        <span className="text-xs text-muted-foreground">/</span>
                        <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={eff.marksMax}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? 0 : Number(raw);
                                const nextMax = Math.max(
                                    0,
                                    Number.isFinite(parsed) ? parsed : 0,
                                );
                                // Lowering the denominator below the awarded mark
                                // would make an impossible score — clamp awarded.
                                const patch: Partial<
                                    NonNullable<GradedQuestion["teacherOverrides"]>
                                > = { marksMax: nextMax };
                                if (eff.marksAwarded > nextMax) patch.marksAwarded = nextMax;
                                onOverride(question.questionId, patch);
                            }}
                            className="h-9 w-20 tabular-nums"
                            aria-label={t("Marks out of")}
                        />
                    </div>
                )}

                {/* Student wrote — always read-only: it is the student's own
                    work and must not be rewritten by the teacher. */}
                <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                        {t("Student wrote")}
                    </div>
                    <div
                        className={`rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap break-words ${isMath ? "font-mono" : ""}`}
                    >
                        {latexToReadable(eff.studentAnswer) ||
                            `(${t("no answer written")})`}
                    </div>
                </div>

                {/* How to improve — bullets of what was missing / how to score
                    more. Editable as one point per line. Copy sends the student
                    feedback (the improvement points). */}
                {(eff.improvementPoints.length > 0 || isEditing) && (
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-muted-foreground">
                                {t("How to improve your answer")}
                            </span>
                            {!isEditing && eff.improvementPoints.length > 0 && (
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
                                value={
                                    improvementDraft ??
                                    eff.improvementPoints.join("\n")
                                }
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setImprovementDraft(raw);
                                    onOverride(question.questionId, {
                                        improvementPoints: raw
                                            .split("\n")
                                            .map((s) => s.trim())
                                            .filter(Boolean),
                                    });
                                }}
                                className="min-h-[70px] text-sm"
                                placeholder={t(
                                    "One improvement per line (e.g. Add an example; Use a heading).",
                                )}
                            />
                        ) : (
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                {eff.improvementPoints.map((pt, j) => (
                                    <li key={j}>{latexToReadable(pt)}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Correct answer — shown for OBJECTIVE types (mcq / true_false /
                    fill_blank) the student got WRONG, so they learn the right one.
                    `expectedAnswer` is only populated in that case (empty for correct
                    objective answers and for descriptive types, whose AI-written model
                    answers are not authoritative and stay hidden from result + PDF).
                    (Bug #6: monospace only for maths.) */}
                {question.questionType &&
                    ["mcq", "true_false", "fill_blank"].includes(question.questionType) &&
                    question.expectedAnswer && (
                    <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">
                            {t("Correct answer")}
                        </div>
                        <div
                            className={`rounded-md bg-muted/20 p-3 text-xs whitespace-pre-wrap break-words ${isMath ? "font-mono" : ""}`}
                        >
                            {latexToReadable(question.expectedAnswer)}
                        </div>
                        {eff.whyCorrect && (
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                <span className="font-semibold">{t("Why")}: </span>
                                {latexToReadable(eff.whyCorrect)}
                            </p>
                        )}
                    </div>
                )}

                {/* Marks breakdown is a teacher AUDIT aid (how the score was
                    computed), not student feedback — so it's shown only in edit
                    mode. The student sees the actionable "How to improve" list
                    instead, and it stays out of the printed handout. */}
                {isEditing && question.partialCreditBreakdown.length > 0 && (
                    <div className="print:hidden">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">
                            {t("Marks breakdown (how the score was calculated)")}
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

                {/* Never leave the student area blank (e.g. a correct answer with no
                    improvement points, or an ungradeable placeholder). Suppressed when
                    a wrong-objective "Correct answer" block is shown above. */}
                {!isEditing &&
                    eff.improvementPoints.length === 0 &&
                    !question.expectedAnswer && (
                        <p className="text-sm italic text-muted-foreground">
                            {t("Reviewed — no additional comments.")}
                        </p>
                    )}
            </AccordionContent>
        </AccordionItem>
    );
}
