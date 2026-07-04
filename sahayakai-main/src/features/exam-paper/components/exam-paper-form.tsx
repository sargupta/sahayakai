"use client";

/**
 * ExamPaperForm — the board/grade/subject/chapters/difficulty/language
 * configuration panel. Markup moved verbatim from the pre-migration
 * src/app/exam-paper/page.tsx; state lives in useExamPaper.
 */

import { AlertCircle, Award, Clock, FileText, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { EDUCATION_BOARDS, LANGUAGES } from "@/types";
import { useLanguage } from "@/context/language-context";
import { GeneratorSubmitBar } from "@/features/generator";
import { DIFFICULTY_OPTIONS, GRADE_OPTIONS } from "../types";
import type { useExamPaper } from "../hooks/use-exam-paper";

type ExamPaperFormProps = ReturnType<typeof useExamPaper>;

export function ExamPaperForm({
    board, setBoard,
    gradeLevel, setGradeLevel,
    subject, setSubject,
    chapters, setChapters,
    chaptersInput, setChaptersInput,
    difficulty, setDifficulty,
    language, setLanguage,
    includeAnswerKey, setIncludeAnswerKey,
    includeMarkingScheme, setIncludeMarkingScheme,
    availableSubjects,
    matchedBlueprint,
    chapterSuggestions,
    formatSectionPreview,
    handleGenerate,
    generating,
    error,
    canUseAI,
    aiUnavailableReason,
}: ExamPaperFormProps) {
    const { t } = useLanguage();

    return (
        <div className="space-y-5 text-left">
            {/* Row: Board + Grade */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="board">{t("Board")}</Label>
                        <Select value={board} onValueChange={setBoard}>
                            <SelectTrigger id="board">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {EDUCATION_BOARDS.map((b) => (
                                    <SelectItem key={b} value={b}>
                                        {t(b)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="grade">{t("Grade Level")}</Label>
                        <Select value={gradeLevel} onValueChange={setGradeLevel}>
                            <SelectTrigger id="grade">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {GRADE_OPTIONS.map((g) => (
                                    <SelectItem key={g} value={g}>
                                        {t(g)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                    <Label htmlFor="subject">{t("Subject")}</Label>
                    {availableSubjects.length > 0 ? (
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger id="subject">
                                <SelectValue placeholder={t("Select subject")} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSubjects.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {t(s)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="space-y-2">
                            <Input
                                id="subject"
                                placeholder={t("e.g. Mathematics, Science, English")}
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Info className="w-3.5 h-3.5 shrink-0" />
                                {t("No blueprint for")} {t(board)} {t(gradeLevel)} — {t("AI will generate a standard pattern.")}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Blueprint preview */}
            {matchedBlueprint && (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {matchedBlueprint.duration} {t("min")}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                            <Award className="w-4 h-4" />
                            {matchedBlueprint.maxMarks} {t("marks")}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {matchedBlueprint.sections.map((sec, i) => (
                            <Badge key={i} variant="secondary" className="text-xs font-normal">
                                {sec.name}: {formatSectionPreview(sec)}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Chapters */}
            <div className="card-section space-y-2">
                <Label>
                    {t("Chapters")}{" "}
                    <span className="text-muted-foreground font-normal">
                        {t("(optional — select from list or type below)")}
                    </span>
                </Label>
                {chapterSuggestions.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                            {chapterSuggestions.map((ch) => {
                                const selected = chapters.includes(ch);
                                return (
                                    <button
                                        key={ch}
                                        type="button"
                                        onClick={() => {
                                            setChapters((prev) =>
                                                selected
                                                    ? prev.filter((c) => c !== ch)
                                                    : [...prev, ch],
                                            );
                                        }}
                                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                            selected
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                                        }`}
                                    >
                                        {selected ? "✓ " : "+ "}
                                        {ch}
                                    </button>
                                );
                            })}
                        </div>
                        {chapters.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {chapters.length} {chapters.length === 1 ? t("chapter") : t("chapters")} {t("selected")}
                                {" · "}
                                <button
                                    type="button"
                                    className="underline hover:no-underline"
                                    onClick={() => setChapters([])}
                                >
                                    {t("Clear all")}
                                </button>
                            </p>
                        )}
                    </div>
                ) : (
                    <Input
                        id="chapters"
                        placeholder={t("e.g. Real Numbers, Polynomials, Triangles")}
                        value={chaptersInput}
                        onChange={(e) => setChaptersInput(e.target.value)}
                    />
                )}
            </div>

            {/* Row: Difficulty + Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="difficulty">{t("Difficulty")}</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger id="difficulty">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DIFFICULTY_OPTIONS.map((d) => (
                                <SelectItem key={d} value={d}>
                                    {t(d.charAt(0).toUpperCase() + d.slice(1))}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="language">{t("Language")}</Label>
                    <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger id="language">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {LANGUAGES.map((l) => (
                                <SelectItem key={l} value={l}>
                                    {t(l)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        checked={includeAnswerKey}
                        onCheckedChange={(v) => setIncludeAnswerKey(v === true)}
                    />
                    <span className="text-sm">{t("Include Answer Key")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                        checked={includeMarkingScheme}
                        onCheckedChange={(v) => setIncludeMarkingScheme(v === true)}
                    />
                    <span className="text-sm">{t("Include Marking Scheme")}</span>
                </label>
            </div>

            {/* Generate button */}
            <GeneratorSubmitBar>
                <Button
                    onClick={handleGenerate}
                    disabled={generating || !subject || !canUseAI}
                    aria-busy={generating}
                    className="w-full py-5 text-base font-headline bg-primary hover:bg-primary/90"
                    size="lg"
                >
                    {generating ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t("Generating your exam paper...")}
                        </>
                    ) : (
                        <>
                            <FileText className="w-4 h-4 mr-2" />
                            {t("Generate Paper")}
                        </>
                    )}
                </Button>
            </GeneratorSubmitBar>
            {aiUnavailableReason && (
                <p className="text-xs text-amber-600 mt-1.5 text-center">{aiUnavailableReason}</p>
            )}

            {error && (
                <div className="flex items-start gap-2 text-sm text-destructive p-3 rounded-md bg-destructive/10" role="alert">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                </div>
            )}
        </div>
    );
}
