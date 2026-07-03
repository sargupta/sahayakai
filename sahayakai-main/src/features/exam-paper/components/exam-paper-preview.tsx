"use client";

/**
 * ExamPaperPreview — the generated paper: header, sections/questions,
 * collapsible Answer Key + Marking Scheme, blueprint summary, and the
 * Save / PDF action row. Markup moved verbatim from the pre-migration
 * src/app/exam-paper/page.tsx.
 */

import { useState } from "react";
import {
    AlertCircle,
    Award,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Loader2,
    Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/context/language-context";
import type { GeneratedPaper } from "../types";

export interface ExamPaperPreviewProps {
    paper: GeneratedPaper;
    includeAnswerKey: boolean;
    includeMarkingScheme: boolean;
    onSave: () => void;
    saving: boolean;
    saved: boolean;
}

export function ExamPaperPreview({
    paper,
    includeAnswerKey,
    includeMarkingScheme,
    onSave,
    saving,
    saved,
}: ExamPaperPreviewProps) {
    const { t } = useLanguage();

    // Collapsible sections in preview
    const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
    const [markingSchemeOpen, setMarkingSchemeOpen] = useState(false);

    const allQuestions = paper.sections?.flatMap((s) => s.questions) ?? [];
    const withAnswers = allQuestions.filter((q) => q.answerKey || q.answer);
    const withScheme = allQuestions.filter((q) => q.markingScheme);

    return (
        <div className="space-y-4">
            {/* Paper Header */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="font-headline text-lg text-center">
                        {paper.title || `${t(paper.board)} ${t(paper.gradeLevel)} ${t(paper.subject)}`}
                    </CardTitle>
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {typeof paper.duration === "number" ? `${paper.duration} ${t("min")}` : paper.duration}
                        </span>
                        <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" />
                            {paper.maxMarks} {t("marks")}
                        </span>
                    </div>
                </CardHeader>
                {paper.generalInstructions && paper.generalInstructions.length > 0 && (
                    <CardContent className="pt-0">
                        <div className="text-sm space-y-1 border-t border-border pt-3">
                            <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                                {t("General Instructions")}
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                {paper.generalInstructions.map((inst, i) => (
                                    <li key={i}>{inst}</li>
                                ))}
                            </ol>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Sections with Questions */}
            {(!paper.sections || paper.sections.length === 0) && (
                <Card>
                    <CardContent className="pt-6 text-center text-sm text-muted-foreground py-8">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        {t("No sections were generated. Please try again.")}
                    </CardContent>
                </Card>
            )}
            {paper.sections?.map((section, si) => (
                <Card key={si}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                            <span>
                                {section.name}
                                {section.label && (
                                    <span className="font-normal text-muted-foreground">
                                        {" "}
                                        — {section.label}
                                    </span>
                                )}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {section.totalMarks} {t("marks")}
                            </Badge>
                        </CardTitle>
                        {section.instructions && (
                            <p className="text-xs text-muted-foreground">
                                {section.instructions}
                            </p>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {section.questions?.map((q, qi) => (
                            <div
                                key={qi}
                                className="text-sm border-b border-border last:border-0 pb-3 last:pb-0"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <p>
                                        <span className="font-medium">Q{q.number ?? q.questionNumber}.</span>{" "}
                                        {q.text}
                                    </p>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        [{q.marks}m]
                                    </span>
                                </div>
                                {q.options && q.options.length > 0 && (
                                    <div className="mt-2 ml-6 space-y-1">
                                        {q.options.map((opt, oi) => (
                                            <p key={oi} className="text-muted-foreground">
                                                ({String.fromCharCode(97 + oi)}) {opt}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            ))}

            {/* Answer Key (Collapsible) — derived from per-question answerKey fields */}
            {includeAnswerKey && withAnswers.length > 0 && (
                <Card>
                    <button
                        type="button"
                        className="w-full flex items-center justify-between p-4 text-left"
                        onClick={() => setAnswerKeyOpen(!answerKeyOpen)}
                        aria-expanded={answerKeyOpen}
                    >
                        <span className="font-headline font-semibold flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            {t("Answer Key")}
                        </span>
                        {answerKeyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {answerKeyOpen && (
                        <CardContent className="pt-0 space-y-2">
                            {withAnswers.map((q, i) => (
                                <div key={i} className="text-sm flex gap-2">
                                    <span className="font-medium shrink-0">Q{q.number ?? q.questionNumber ?? i + 1}:</span>
                                    <span className="text-muted-foreground">{q.answerKey ?? q.answer}</span>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Marking Scheme (Collapsible) — derived from per-question markingScheme fields */}
            {includeMarkingScheme && withScheme.length > 0 && (
                <Card>
                    <button
                        type="button"
                        className="w-full flex items-center justify-between p-4 text-left"
                        onClick={() => setMarkingSchemeOpen(!markingSchemeOpen)}
                        aria-expanded={markingSchemeOpen}
                    >
                        <span className="font-headline font-semibold flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            {t("Marking Scheme")}
                        </span>
                        {markingSchemeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {markingSchemeOpen && (
                        <CardContent className="pt-0 space-y-3">
                            {withScheme.map((q, i) => (
                                <div key={i} className="text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                                    <span className="font-medium">Q{q.number ?? q.questionNumber ?? i + 1}:</span>
                                    <p className="text-muted-foreground ml-4 whitespace-pre-line">{q.markingScheme}</p>
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Blueprint Summary */}
            {paper.blueprintSummary && (
                <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border border-border">
                    <p className="font-medium mb-1">{t("Blueprint Summary")}</p>
                    {typeof paper.blueprintSummary === "string" ? (
                        <p>{paper.blueprintSummary}</p>
                    ) : (
                        <div className="space-y-2">
                            {paper.blueprintSummary.chapterWise?.length > 0 && (
                                <div>
                                    <p className="font-medium text-foreground/70 mb-0.5">{t("Chapter-wise")}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {paper.blueprintSummary.chapterWise.map((c, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-full bg-muted border border-border">{c.chapter}: {c.marks}m</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {paper.blueprintSummary.difficultyWise?.length > 0 && (
                                <div>
                                    <p className="font-medium text-foreground/70 mb-0.5">{t("Difficulty")}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {paper.blueprintSummary.difficultyWise.map((d, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-full bg-muted border border-border">{d.level}: {d.percentage}%</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={onSave}
                    disabled={saving || saved}
                    variant={saved ? "outline" : "default"}
                    className="flex-1"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : saved ? (
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    {saved ? t("Saved to Library") : t("Save to Library")}
                </Button>
                <Button variant="outline" className="flex-1" disabled title={t("PDF export coming soon")}>
                    <Download className="w-4 h-4 mr-2" />
                    {t("PDF (Coming Soon)")}
                </Button>
            </div>
        </div>
    );
}
