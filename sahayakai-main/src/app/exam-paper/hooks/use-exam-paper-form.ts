/**
 * @fileOverview Form-state brain for the exam-paper feature. Owns every form
 * field, the blueprint lookup memos, the board/grade/subject/chapter reset
 * effects, the VIDYA URL-param prefill, and the section-preview formatter.
 * Applies the teacher's `preferredBoard` (from useExamPaperAuth) exactly once.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { LANGUAGE_CODE_MAP } from "@/types";
import {
  type ExamBlueprint,
  type SectionBlueprint,
} from "@/ai/data/board-blueprints";
import { getAuthToken } from "@/lib/get-auth-token";

// findBlueprint/getAvailableBlueprints are now server-only (Firestore-backed),
// so the client fetches the blueprint list from the API and matches locally.
const norm = (s: string) => s.trim().toLowerCase();

export function useExamPaperForm(preferredBoard: string | null) {
  const { t } = useLanguage();

  // Form state
  const [board, setBoard] = useState("CBSE");
  const [gradeLevel, setGradeLevel] = useState("Class 10");
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState<string[]>([]);
  const [chaptersInput, setChaptersInput] = useState(""); // free-text fallback
  // Coverage: 'chapters' = only the selected chapters (default); 'syllabus' = whole subject.
  const [coverageMode, setCoverageMode] = useState<'chapters' | 'syllabus'>('chapters');
  const [difficulty, setDifficulty] = useState("mixed");
  const [language, setLanguage] = useState("English");
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);
  const [includeMarkingScheme, setIncludeMarkingScheme] = useState(true);
  // Target % of questions from previous-year papers (PYQ) vs freshly-invented
  // ("New"). Undefined until the teacher opts in — omitted from the request
  // entirely so unset behaves exactly as before this control existed.
  const [pyqRatio, setPyqRatio] = useState<number | undefined>(undefined);

  // ── Apply teacher's preferred board (once) ─────────────────────────────
  // QA #9 — mirrors the old inline setBoard in the auth effect. Guarded so it
  // applies only on first arrival and never overrides a manual pick.
  const boardDefaultedRef = useRef(false);
  useEffect(() => {
    if (preferredBoard && !boardDefaultedRef.current) {
      boardDefaultedRef.current = true;
      setBoard(preferredBoard);
    }
  }, [preferredBoard]);

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

  // ── Blueprint lookup (fetched from Firestore via API) ──────────────────

  const [allBlueprints, setAllBlueprints] = useState<ExamBlueprint[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Bearer token — /api/exam-paper/blueprints is a protected /api/ route
        // (middleware 401s without auth), matching use-exam-paper-generation.
        const token = await getAuthToken();
        const res = await fetch("/api/exam-paper/blueprints", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = (await res.json()) as ExamBlueprint[];
        if (active && Array.isArray(data)) setAllBlueprints(data);
      } catch {
        /* leave empty — form still works, subject dropdown just unpopulated */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const availableSubjects = useMemo(() => {
    const subjects = allBlueprints
      .filter((bp) => norm(bp.board) === norm(board) && norm(bp.gradeLevel) === norm(gradeLevel))
      .map((bp) => bp.subject);
    return [...new Set(subjects)];
  }, [board, gradeLevel, allBlueprints]);

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
  const prevSubjectRef = useRef(subject);
  useEffect(() => {
    if (prevSubjectRef.current !== subject) {
      prevSubjectRef.current = subject;
      setChapters([]);
    }
  }, [subject]);

  const matchedBlueprint: ExamBlueprint | undefined = useMemo(() => {
    if (!board || !gradeLevel || !subject) return undefined;
    return allBlueprints.find(
      (bp) =>
        norm(bp.board) === norm(board) &&
        norm(bp.gradeLevel) === norm(gradeLevel) &&
        norm(bp.subject) === norm(subject)
    );
  }, [board, gradeLevel, subject, allBlueprints]);

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

  return {
    // Form fields + setters
    board, setBoard,
    gradeLevel, setGradeLevel,
    subject, setSubject,
    chapters, setChapters,
    chaptersInput, setChaptersInput,
    coverageMode, setCoverageMode,
    difficulty, setDifficulty,
    language, setLanguage,
    includeAnswerKey, setIncludeAnswerKey,
    includeMarkingScheme, setIncludeMarkingScheme,
    pyqRatio, setPyqRatio,
    // Derived blueprint data
    availableSubjects,
    matchedBlueprint,
    chapterSuggestions,
    formatSectionPreview,
  };
}