/**
 * @fileOverview The exam-paper configuration form (board, grade, subject,
 * blueprint preview, chapters, difficulty, language, answer-key/marking-scheme
 * toggles, and the Generate button). Dumb container — receives the relevant
 * slice of the useExamPaper view-model; owns no state of its own.
 *
 * Layout: a paper studio — the three numbered steps (1) board/class/subject,
 * (2) coverage, (3) settings on the left, and "Your paper" (PaperPlan) on the
 * right, a live summary of the paper's pattern, marks and contents from the
 * matched blueprint. Generate sits in the card footer under both.
 */
"use client";

import type { ReactNode } from "react";
import { FileText, Loader2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { GeneratorSection, GeneratorSubmitBar, GENERATOR_SUBMIT_CLASS } from "@/features/generator";
import { GRADE_OPTIONS, DIFFICULTY_OPTIONS } from "../types";
import type { ExamPaperViewModel } from "../hooks/use-exam-paper";
import { PaperPlan } from "./paper-plan";
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

/** A tappable option row: the whole row toggles its checkbox. */
function OptionRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-row border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors duration-micro ease-out-quart hover:border-primary/40 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-tint-accent-soft indic-text">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{children}</span>
    </label>
  );
}

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
    <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="card-accent-bar" />
      <div className="space-y-6 p-4 sm:p-6 md:p-8">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7">
        {/* 1 · Board, class and subject (the blueprint shows in PaperPlan) */}
        <GeneratorSection step={1} title={t("Subject")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  <Input
                    id="subject"
                    placeholder={t("e.g. Mathematics, Science, English")}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        </GeneratorSection>

        {/* 2 · Coverage: specific chapters (default) vs the whole subject syllabus */}
        <GeneratorSection step={2} title={t("Coverage")}>
          <div className="space-y-4">
            <Tabs
              value={coverageMode}
              onValueChange={(v) => setCoverageMode(v as "chapters" | "syllabus")}
            >
              <TabsList className="grid w-full grid-cols-2 sm:w-96">
                <TabsTrigger value="chapters">{t("Chapter-wise")}</TabsTrigger>
                <TabsTrigger value="syllabus">{t("Whole syllabus")}</TabsTrigger>
              </TabsList>
            </Tabs>

            {coverageMode === "chapters" ? (
              <ChapterSelector
                suggestions={chapterSuggestions}
                chapters={chapters}
                setChapters={setChapters}
                chaptersInput={chaptersInput}
                setChaptersInput={setChaptersInput}
              />
            ) : (
              <p className="flex items-center gap-2 rounded-row border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground indic-text">
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("All chapters of the subject will be covered.")}
              </p>
            )}
          </div>
        </GeneratorSection>

        {/* 3 · Difficulty, language and what the paper includes */}
        <GeneratorSection step={3} title={t("Settings")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <OptionRow checked={includeAnswerKey} onChange={setIncludeAnswerKey}>
                {t("Include Answer Key")}
              </OptionRow>
              <OptionRow checked={includeMarkingScheme} onChange={setIncludeMarkingScheme}>
                {t("Include Marking Scheme")}
              </OptionRow>
              {/* PYQ/New mix — off by default; pyqRatio stays undefined (default mix) until opted in */}
              <OptionRow checked={pyqRatio !== undefined} onChange={(v) => setPyqRatio(v ? 70 : undefined)}>
                {t("Customize PYQ Mix")}
              </OptionRow>
            </div>

            {pyqRatio !== undefined && (
              <div className="space-y-3 rounded-row border border-border bg-muted/30 p-4">
                <Label className="flex items-center justify-between">
                  <span>{t("PYQ Target %")}</span>
                  <span className="tabular-nums text-saffron-700">{pyqRatio}%</span>
                </Label>
                <Slider
                  value={[pyqRatio]}
                  onValueChange={([v]) => setPyqRatio(v)}
                  min={0}
                  max={100}
                  step={5}
                  aria-label={t("PYQ Target %")}
                />
              </div>
            )}
          </div>
        </GeneratorSection>
        </div>

        <PaperPlan
          board={board} gradeLevel={gradeLevel} subject={subject}
          matchedBlueprint={matchedBlueprint} formatSectionPreview={formatSectionPreview}
          chapters={chapters} chaptersInput={chaptersInput} coverageMode={coverageMode}
          difficulty={difficulty} language={language}
          includeAnswerKey={includeAnswerKey} includeMarkingScheme={includeMarkingScheme} pyqRatio={pyqRatio}
          className="xl:sticky xl:top-24 xl:col-span-5 xl:self-start"
        />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-row bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <GeneratorSubmitBar hint={aiUnavailableReason}>
          <Button
            onClick={generate}
            disabled={generating || !subject || !canUseAI}
            className={GENERATOR_SUBMIT_CLASS}
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("Generating your exam paper...")}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {t("Generate Paper")}
              </>
            )}
          </Button>
        </GeneratorSubmitBar>
      </div>
    </section>
  );
}
