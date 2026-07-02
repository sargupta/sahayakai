"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "@/context/language-context";
import { getAuthToken } from "@/lib/get-auth-token";
import { useSearchParams } from "next/navigation";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { LANGUAGE_CODE_MAP, LANGUAGE_TO_ISO } from "@/types";
import { getProfileData } from "@/app/actions/profile";
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

// ── Localized paper-preview micro-labels ─────────────────────────────────
// Question-number prefix ("Q1.") and the marks abbreviation ("[3m]") must
// follow the UI language so the rendered paper reads in one script. Keyed
// by the 11 ISO codes; resolved by uiLangCode. Faithful native-script
// abbreviations — proper-noun-free.
const QUESTION_PREFIX: Record<string, string> = {
  en: "Q", hi: "प्र", mr: "प्र", bn: "প্র", pa: "ਪ੍ਰ", gu: "પ્ર",
  or: "ପ୍ର", ta: "வ", te: "ప్ర", kn: "ಪ್ರ", ml: "ചോ",
};
const MARKS_ABBREV: Record<string, string> = {
  en: "m", hi: "अंक", mr: "गुण", bn: "নম্বর", pa: "ਅੰਕ", gu: "ગુણ",
  or: "ନମ୍ବର", ta: "மதிப்பெண்", te: "మార్కులు", kn: "ಅಂಕ", ml: "മാർക്ക്",
};

// ── Page Component ───────────────────────────────────────────────────────

// Next 15 prerender requires useSearchParams() to be wrapped in a
// Suspense boundary; otherwise the page falls back to client-side
// rendering at build time and errors out. Inner component holds the
// hook; default export wraps it.
export default function ExamPaperPage() {
  return (
    <Suspense fallback={null}>
      <ExamPaperPageInner />
    </Suspense>
  );
}

function ExamPaperPageInner() {
  const { t, language: uiLanguage } = useLanguage();
  // UI-chrome language drives the paper-preview micro-labels (Q-prefix, marks
  // abbreviation), independent of the selected AI-output language.
  const uiLangCode = LANGUAGE_TO_ISO[uiLanguage] ?? "en";
  const qPrefix = QUESTION_PREFIX[uiLangCode] ?? QUESTION_PREFIX.en;
  const marksAbbr = MARKS_ABBREV[uiLangCode] ?? MARKS_ABBREV.en;
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
  // Guard so the teacher's preferred board is applied only once, on first
  // load — never re-applied after they manually pick a different board.
  const boardDefaultedRef = React.useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(!!user);
      setLoading(false);
      // QA #9 — default the board field to the teacher's preferred board so
      // generated papers are board-aligned out of the box. Falls back to the
      // hardcoded "CBSE" default when no board is saved or it's unknown.
      if (user && !boardDefaultedRef.current) {
        getProfileData(user.uid)
          .then(({ profile }) => {
            const saved = (profile as { preferredBoard?: string; educationBoard?: string } | null);
            const board = saved?.preferredBoard ?? saved?.educationBoard;
            if (board && (EDUCATION_BOARDS as readonly string[]).includes(board) && !boardDefaultedRef.current) {
              boardDefaultedRef.current = true;
              setBoard(board);
            }
          })
          .catch(() => { /* non-fatal — keep the CBSE default */ });
      }
    });
    return () => unsub();
  }, []);

  // ── VIDYA Action: Pre-fill from URL params ─────────────────────────────
  // NCERT-demo 2026-05-19 pattern (see use-lesson-plan.ts). Exam-paper uses
  // imperative useState (not react-hook-form) and stores language as the
  // display name ("English"), so we normalise the inbound ISO/display value
  // back to the display name LANGUAGES set the picker expects.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!searchParams) return;
    const gradeLevelParam = searchParams.get("gradeLevel");
    const subjectParam = searchParams.get("subject");
    const languageParam = searchParams.get("language");
    const topicParam = searchParams.get("topic");

    const normalisedGrade = normaliseVidyaGradeLevel(gradeLevelParam);
    if (normalisedGrade) setGradeLevel(normalisedGrade);
    if (subjectParam) setSubject(subjectParam);

    // Map ISO → display name; fall back to "English" if unknown.
    const iso = normaliseVidyaLanguage(languageParam);
    if (iso) {
      const display = LANGUAGE_CODE_MAP[iso as keyof typeof LANGUAGE_CODE_MAP];
      if (display) setLanguage(display);
    }

    // VIDYA may emit `topic` as a free-text chapter hint; surface it in the
    // free-text chapters fallback so the user sees their intent reflected.
    if (topicParam && chapters.length === 0) {
      setChaptersInput((prev) => prev || topicParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      mcq: t("MCQ"),
      very_short: t("VSA"),
      short: t("SA"),
      long: t("LA"),
      case_study: t("Case Study"),
      assertion_reason: t("A-R"),
      map_based: t("Map"),
      source_based: t("Source"),
    };
    const typeLabel = typeLabels[section.questionType.type] || section.questionType.type;
    return `${section.questionCount} ${typeLabel} x ${section.questionType.marksPerQuestion}m`;
  }, [t]);

  // ── Generate paper ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    setPaper(null);
    setSaved(false);

    // BUG #21 guard: when there is no official blueprint for the chosen
    // board/grade/subject, the AI route requires at least one chapter to
    // anchor the paper (otherwise Gemini gets two open-ended constraints
    // and either times out or returns a malformed paper). Mirror the
    // server-side 400 here so the teacher gets a clear inline toast
    // instead of submitting an empty form and seeing a generic API error.
    const chapterListFromInput = chapters.length > 0
      ? chapters
      : chaptersInput.split(",").map((c) => c.trim()).filter(Boolean);
    if (!matchedBlueprint && chapterListFromInput.length === 0) {
      setError(
        t("Please add at least one chapter for this board / grade / subject. We only have official blueprints for CBSE Class 9 and Class 10 Mathematics and Science."),
      );
      return;
    }

    setGenerating(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError(t("Session expired. Please log in again."));
        setGenerating(false);
        return;
      }

      // NCERT-demo 2026-05-19 hardening: ALWAYS send a non-empty
      // `language`. Exam-paper uses display name format ("English"); the
      // initial useState default ensures it can never be empty, but we
      // defend in depth in case future code wires this to a controlled
      // selector with a transient empty value.
      const submittedLanguage = language && language.trim() ? language : 'English';

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
          language: submittedLanguage,
          includeAnswerKey,
          includeMarkingScheme,
        }),
      });

      // 202 = AI hit the timeout budget but is still working in the
      // background. Don't render the "in-progress" envelope as a paper —
      // that's how the founder saw "undefined undefined undefined" on
      // 2026-05-19. Show a friendly notice and let them retry.
      if (res.status === 202) {
        const body = await res.json().catch(() => ({}));
        const msg =
          body.message ||
          t("Still generating. Open My Library in about a minute, or try again with a chapter selected.");
        setError(msg);
        return;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || errBody.error || `Failed (${res.status})`);
      }

      const data = await res.json();
      // Defensive: a 200 with no title/sections is the same garbage shape
      // as the old 202 mis-render. Treat it as an error instead of
      // rendering "undefined undefined undefined".
      const candidate = data?.paper || data;
      if (!candidate || !candidate.title || !Array.isArray(candidate.sections) || candidate.sections.length === 0) {
        setError(t("The AI returned an incomplete paper. Please try again with a chapter selected."));
        return;
      }
      setPaper(candidate);
    } catch (err: any) {
      setError(err.message || t("Something went wrong. Please try again."));
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
        setError(t("Session expired. Please log in again."));
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
      setError(t("Could not save. Please try again."));
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
          {t("Please log in to generate exam papers.")}
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
          {t("Board Exam Paper Generator")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("Generate board-pattern question papers with answer keys")}
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
          <Button
            onClick={handleGenerate}
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
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">{t("Result")}</span>
            <hr className="flex-1 border-border/40" />
          </div>
        <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4 space-y-4">
          {/* Paper Header */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-headline text-lg text-center">
                {paper.title || `${t(paper.board)} ${t(paper.gradeLevel)} ${t(paper.subject)}`}
              </CardTitle>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {typeof paper.duration === 'number' ? `${paper.duration} ${t("min")}` : paper.duration}
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
            );
          })()}

          {/* Blueprint Summary */}
          {paper.blueprintSummary && (
            <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/50 border border-border">
              <p className="font-medium mb-1">{t("Blueprint Summary")}</p>
              {typeof paper.blueprintSummary === 'string' ? (
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
              {saved ? t("Saved to Library") : t("Save to Library")}
            </Button>
            <Button variant="outline" className="flex-1" disabled title={t("PDF export coming soon")}>
              <Download className="w-4 h-4 mr-2" />
              {t("PDF (Coming Soon)")}
            </Button>
          </div>
          <ShareToCommunityCTA contentType="exam-paper" className="mt-3" />
        </div>
        </div>
      )}
    </div>
  );
}
