/**
 * @fileOverview The exam-paper configuration form (board, grade, subject,
 * blueprint preview, chapters, difficulty, language, answer-key/marking-scheme
 * toggles, and the Generate button). Dumb container — receives the relevant
 * slice of the useExamPaper view-model; owns no state of its own.
 */
"use client";

import { FileText, Loader2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/context/language-context";
import { EDUCATION_BOARDS, LANGUAGES } from "@/types";
import { GRADE_OPTIONS, DIFFICULTY_OPTIONS } from "../types";
import type { ExamPaperViewModel } from "../hooks/use-exam-paper";
import { BlueprintPreview } from "./blueprint-preview";
import { ChapterSelector } from "./chapter-selector";

type ExamPaperFormProps = Pick<
  ExamPaperViewModel,
  | "board" | "setBoard"
  | "gradeLevel" | "setGradeLevel"
  | "subject" | "setSubject"
  | "availableSubjects" | "matchedBlueprint" | "formatSectionPreview"
  | "chapters" | "setChapters" | "chaptersInput" | "setChaptersInput" | "chapterSuggestions"
  | "coverageMode" | "setCoverageMode"
  | "difficulty" | "setDifficulty" | "language" | "setLanguage"
  | "includeAnswerKey" | "setIncludeAnswerKey"
  | "includeMarkingScheme" | "setIncludeMarkingScheme"
  | "pyqRatio" | "setPyqRatio"
  | "generate" | "generating" | "canUseAI" | "aiUnavailableReason" | "error"
>;

export function ExamPaperForm({
  board, setBoard,
  gradeLevel, setGradeLevel,
  subject, setSubject,
  availableSubjects, matchedBlueprint, formatSectionPreview,
  chapters, setChapters, chaptersInput, setChaptersInput, chapterSuggestions,
  coverageMode, setCoverageMode,
  difficulty, setDifficulty, language, setLanguage,
  includeAnswerKey, setIncludeAnswerKey,
  includeMarkingScheme, setIncludeMarkingScheme,
  pyqRatio, setPyqRatio,
  generate, generating, canUseAI, aiUnavailableReason, error,
}: ExamPaperFormProps) {
  const { t } = useLanguage();

  return (
    <Card>
      <div className="card-accent-bar" />
      <CardContent className="pt-6 space-y-5">
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
          <BlueprintPreview blueprint={matchedBlueprint} formatSectionPreview={formatSectionPreview} />
        )}

        {/* Coverage: specific chapters (default) vs the whole subject syllabus */}
        <div className="space-y-2">
          <Label>{t("Coverage")}</Label>
          <Tabs
            value={coverageMode}
            onValueChange={(v) => setCoverageMode(v as "chapters" | "syllabus")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chapters">{t("Chapter-wise")}</TabsTrigger>
              <TabsTrigger value="syllabus">{t("Whole syllabus")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Chapters — the picker in chapter-wise mode; a note in whole-syllabus mode */}
        {coverageMode === "chapters" ? (
          <ChapterSelector
            suggestions={chapterSuggestions}
            chapters={chapters}
            setChapters={setChapters}
            chaptersInput={chaptersInput}
            setChaptersInput={setChaptersInput}
          />
        ) : (
          <p className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            {t("All chapters of the subject will be covered.")}
          </p>
        )}

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

        {/* PYQ/New mix — off by default; pyqRatio stays undefined (default mix) until opted in */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={pyqRatio !== undefined}
              onCheckedChange={(v) => setPyqRatio(v === true ? 70 : undefined)}
            />
            <span className="text-sm">{t("Customize PYQ Mix")}</span>
          </label>
          {pyqRatio !== undefined && (
            <div className="space-y-2 pl-6">
              <Label>{t("PYQ Target %")}: {pyqRatio}%</Label>
              <Slider
                value={[pyqRatio]}
                onValueChange={([v]) => setPyqRatio(v)}
                min={0}
                max={100}
                step={5}
              />
            </div>
          )}
        </div>

        {/* Generate button */}
        <Button
          onClick={generate}
          disabled={generating || !subject || !canUseAI}
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
        {aiUnavailableReason && (
          <p className="text-xs text-amber-600 mt-1.5 text-center">{aiUnavailableReason}</p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive p-3 rounded-md bg-destructive/10">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
