"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "@/context/language-context";
import { getAuthToken } from "@/lib/get-auth-token";
import {
  FileText,
  BookOpen,
  Clock,
  Award,
  Download,
  Save,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EDUCATION_BOARDS, LANGUAGES } from "@/types";
import {
  findBlueprint,
  getAvailableBlueprints,
  type ExamBlueprint,
  type SectionBlueprint,
} from "@/ai/data/board-blueprints";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { useNetworkAware } from "@/hooks/use-network-aware";

// ── Types for generated paper ────────────────────────────────────────────

interface GeneratedQuestion {
  // Flow returns `number`, not `questionNumber`
  number?: number;
  questionNumber?: number;
  text: string;
  options?: string[];
  marks: number;
  // Flow embeds answer per-question as `answerKey` (string), not `answer`
  answerKey?: string;
  answer?: string;
  markingScheme?: string;
  internalChoice?: string;
  source?: string;
}

interface GeneratedSection {
  name: string;
  label: string;
  instructions?: string;
  questions: GeneratedQuestion[];
  totalMarks: number;
}

interface GeneratedPaper {
  title: string;
  board: string;
  gradeLevel: string;
  subject: string;
  duration: string | number; // Flow returns string e.g. "3 Hours"
  maxMarks: number;
  generalInstructions: string[];
  sections: GeneratedSection[];
  answerKey?: GeneratedQuestion[]; // Not in flow output — derived from sections
  blueprintSummary?: { chapterWise: { chapter: string; marks: number }[]; difficultyWise: { level: string; percentage: number }[] } | string;
}

// ── Constants ────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ["Class 9", "Class 10"] as const;
const DIFFICULTY_OPTIONS = ["easy", "moderate", "hard", "mixed"] as const;

// ── Page Component ───────────────────────────────────────────────────────

export default function ExamPaperPage() {
  const { t } = useLanguage();
  // Auth state
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [board, setBoard] = useState("CBSE");
  const [gradeLevel, setGradeLevel] = useState("Class 10");
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState<string[]>([]);
  const [chaptersInput, setChaptersInput] = useState(""); // free-text fallback
  const [difficulty, setDifficulty] = useState("mixed");
  const [language, setLanguage] = useState("English");
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [includeMarkingScheme, setIncludeMarkingScheme] = useState(true);

  // Generation state
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<GeneratedPaper | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Collapsible sections in preview
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [markingSchemeOpen, setMarkingSchemeOpen] = useState(false);

  // ── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Blueprint lookup ───────────────────────────────────────────────────

  const availableBlueprints = useMemo(() => getAvailableBlueprints(), []);

  const availableSubjects = useMemo(() => {
    const subjects = availableBlueprints
      .filter((bp) => bp.board === board && bp.gradeLevel === gradeLevel)
      .map((bp) => bp.subject);
    return [...new Set(subjects)];
  }, [board, gradeLevel, availableBlueprints]);

  // Reset subject + chapters when board/grade changes if current subject not available
  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(subject)) {
      setSubject(availableSubjects[0]);
      setChapters([]);
    } else if (availableSubjects.length === 0) {
      setSubject("");
      setChapters([]);
    }
  }, [availableSubjects, subject]);

  // Reset chapters when subject changes
  const prevSubjectRef = React.useRef(subject);
  useEffect(() => {
    if (prevSubjectRef.current !== subject) {
      prevSubjectRef.current = subject;
      setChapters([]);
    }
  }, [subject]);

  const matchedBlueprint: ExamBlueprint | undefined = useMemo(() => {
    if (!board || !gradeLevel || !subject) return undefined;
    return findBlueprint(board, gradeLevel, subject);
  }, [board, gradeLevel, subject]);

  const chapterSuggestions = useMemo(() => {
    if (!matchedBlueprint?.chapterWeightage) return [];
    return Object.keys(matchedBlueprint.chapterWeightage);
  }, [matchedBlueprint]);

  // ── Format section preview ─────────────────────────────────────────────

  const formatSectionPreview = useCallback((section: SectionBlueprint) => {
    const typeLabels: Record<string, string> = {
      mcq: "MCQ",
      very_short: "VSA",
      short: "SA",
      long: "LA",
      case_study: "Case Study",
      assertion_reason: "A-R",
      map_based: "Map",
      source_based: "Source",
    };
    const typeLabel = typeLabels[section.questionType.type] || section.questionType.type;
    return `${section.questionCount} ${typeLabel} x ${section.questionType.marksPerQuestion}m`;
  }, []);

  // ── Generate paper ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    setPaper(null);
    setSaved(false);
    setGenerating(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError("Session expired. Please log in again.");
        setGenerating(false);
        return;
      }

      const res = await fetch("/api/ai/exam-paper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          board,
          gradeLevel,
          subject,
          chapters: chapters.length > 0
            ? chapters
            : chaptersInput.split(",").map((c) => c.trim()).filter(Boolean),
          difficulty,
          language,
          includeAnswerKey,
          includeMarkingScheme,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed (${res.status})`);
      }

      const data = await res.json();
      setPaper(data.paper || data);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Save to library ────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!paper) return;
    setSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }
      const res = await fetch("/api/ai/exam-paper", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paper }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Auth loading / redirect ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center">
          Please log in to generate exam papers.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-headline tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Board Exam Paper Generator
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate board-pattern question papers with answer keys
        </p>
      </div>

      {/* Form */}
      <Card>
        <div className="card-accent-bar" />
        <CardContent className="pt-6 space-y-5">
          {/* Row: Board + Grade */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="board">Board</Label>
                <Select value={board} onValueChange={setBoard}>
                  <SelectTrigger id="board">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_BOARDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
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
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              {availableSubjects.length > 0 ? (
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="subject">
                    <SelectValue placeholder={t("Select subject")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
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
                    No blueprint for {board} {gradeLevel} — AI will generate a standard pattern.
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
                  {matchedBlueprint.duration} min
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Award className="w-4 h-4" />
                  {matchedBlueprint.maxMarks} marks
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
              Chapters{" "}
              <span className="text-muted-foreground font-normal">
                (optional — select from list or type below)
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
                              : [...prev, ch]
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
                    {chapters.length} chapter{chapters.length !== 1 ? "s" : ""} selected
                    {" · "}
                    <button
                      type="button"
                      className="underline hover:no-underline"
                      onClick={() => setChapters([])}
                    >
                      Clear all
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
                      {d.charAt(0).toUpperCase() + d.slice(1)}
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
                      {l}
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
              <span className="text-sm">Include Answer Key</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeMarkingScheme}
                onCheckedChange={(v) => setIncludeMarkingScheme(v === true)}
              />
              <span className="text-sm">Include Marking Scheme</span>
            </label>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !subject || !canUseAI}
            className="w-full py-5 text-base font-headline bg-primary hover:bg-primary/90"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating your exam paper...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate Paper
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

      {/* Loading skeleton */}
      {generating && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-3 pt-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Paper Preview */}
      {paper && !generating && (
        <div className="space-y-4">
          <div className="my-8 flex items-center gap-3">
            <hr className="flex-1 border-border/40" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">Result</span>
            <hr className="flex-1 border-border/40" />
          </div>
        <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4 space-y-4">
          {/* Paper Header */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-headline text-lg text-center">
                {paper.title || `${paper.board} ${paper.gradeLevel} ${paper.subject}`}
              </CardTitle>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {typeof paper.duration === 'number' ? `${paper.duration} min` : paper.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  {paper.maxMarks} marks
                </span>
              </div>
            </CardHeader>
            {paper.generalInstructions && paper.generalInstructions.length > 0 && (
              <CardContent className="pt-0">
                <div className="text-sm space-y-1 border-t border-border pt-3">
                  <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    General Instructions
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
                No sections were generated. Please try again.
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
                    {section.totalMarks} marks
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
          {includeAnswerKey && (() => {
            const allQs = paper.sections?.flatMap(s => s.questions) ?? [];
            const withAnswers = allQs.filter(q => q.answerKey || q.answer);
            if (!withAnswers.length) return null;
            return (
              <Card>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setAnswerKeyOpen(!answerKeyOpen)}
                >
                  <span className="font-headline font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Answer Key
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
            );
          })()}

          {/* Marking Scheme (Collapsible) — derived from per-question markingScheme fields */}
          {includeMarkingScheme && (() => {
            const allQs = paper.sections?.flatMap(s => s.questions) ?? [];
            const withScheme = allQs.filter(q => q.markingScheme);
            if (!withScheme.length) return null;
            return (
              <Card>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left"
                  onClick={() => setMarkingSchemeOpen(!markingSchemeOpen)}
                >
                  <span className="font-headline font-semibold flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Marking Scheme
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
            );
          })()}

          {/* Blueprint Summary */}
          {paper.blueprintSummary && (
            <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border border-border">
              <p className="font-medium mb-1">Blueprint Summary</p>
              {typeof paper.blueprintSummary === 'string' ? (
                <p>{paper.blueprintSummary}</p>
              ) : (
                <div className="space-y-2">
                  {paper.blueprintSummary.chapterWise?.length > 0 && (
                    <div>
                      <p className="font-medium text-foreground/70 mb-0.5">Chapter-wise</p>
                      <div className="flex flex-wrap gap-1.5">
                        {paper.blueprintSummary.chapterWise.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-muted border border-border">{c.chapter}: {c.marks}m</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {paper.blueprintSummary.difficultyWise?.length > 0 && (
                    <div>
                      <p className="font-medium text-foreground/70 mb-0.5">Difficulty</p>
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
              onClick={handleSave}
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
              {saved ? "Saved to Library" : "Save to Library"}
            </Button>
            <Button variant="outline" className="flex-1" disabled title="PDF export coming soon">
              <Download className="w-4 h-4 mr-2" />
              PDF (Coming Soon)
            </Button>
          </div>
          <ShareToCommunityCTA contentType="exam-paper" className="mt-3" />
        </div>
        </div>
      )}
    </div>
  );
}
