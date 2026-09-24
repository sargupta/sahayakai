/**
 * @fileOverview Generation brain for the exam-paper feature. Owns the
 * generating/error/paper/saving/saved state and the two API calls (POST
 * generate, PUT save) against /api/ai/exam-paper. Preserves the BUG #21
 * empty-chapter guard, the 202 in-progress handling, and the incomplete-paper
 * defense. Also hydrates a previously-saved paper when the page is opened with
 * `?id=` from My Library. Network availability comes from useNetworkAware.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/context/language-context";
import { getAuthToken } from "@/lib/get-auth-token";
import { useNetworkAware } from "@/hooks/use-network-aware";
import { useToast } from "@/hooks/use-toast";
import { isGenerationStale } from "@/lib/utils";
import type { GeneratedPaper } from "../types";

export interface GenerateParams {
  board: string;
  gradeLevel: string;
  subject: string;
  chapters: string[];
  chaptersInput: string;
  /** 'chapters' = cover only the selected chapters (default); 'syllabus' = cover the whole
   *  subject (sent as an empty chapters array, which the server expands to all chapters). */
  coverageMode: 'chapters' | 'syllabus';
  difficulty: string;
  language: string;
  includeAnswerKey: boolean;
  includeMarkingScheme: boolean;
  /** Target % (0-100) of questions from previous-year papers; undefined = default mix. */
  pyqRatio?: number;
  /** True when an official blueprint matched the board/grade/subject. */
  hasBlueprint: boolean;
}

export function useExamPaperGeneration() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const searchParams = useSearchParams();

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 202 in-progress notice — kept SEPARATE from `error` so a slow-but-
  // successful run renders as honest "generating, check My Library" info
  // instead of the red error surface (the actual user complaint).
  const [inProgress, setInProgress] = useState<string | null>(null);
  const [paper, setPaper] = useState<GeneratedPaper | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Language of the CURRENT paper, so a per-question regen locks to the same
  // language for both freshly-generated (from the submit) and hydrated (from
  // the saved content record) papers — the paper object itself doesn't carry it.
  const [paperLanguage, setPaperLanguage] = useState('English');
  // Which question is mid-regeneration (`"si-qi"`), or null. Drives the
  // per-question spinner + disabled state in the section card.
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  // H3 (2026-07-16): the content id returned by generate (POST) / hydrate.
  // Save (PUT) echoes it back so the server upserts the same row instead of
  // writing a duplicate — generate is already the canonical writer.
  const [contentId, setContentId] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  // Whether we're viewing a saved paper opened from My Library (`?id=`).
  // Derived from state set inside the effect below — NOT computed at render
  // time from useSearchParams(). On a statically-optimized route, a
  // render-time useSearchParams() read comes back empty (this is why the
  // form-hook's VIDYA prefill also reads params in an effect); only the
  // post-mount effect read is reliable. Lazy-initialized from
  // window.location so a direct load doesn't flash the generate form first.
  const [viewingSaved, setViewingSaved] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("id"),
  );
  // Remembers the last content id we hydrated so the effect below doesn't
  // refetch on unrelated re-renders (searchParams identity is stable per
  // navigation, but the guard makes the intent explicit and refetch-proof).
  const hydratedIdRef = useRef<string | null>(null);

  // Hydrate a saved paper when opened from My Library, which navigates here as
  // `/exam-paper?id=<contentId>`. Without this, the page rendered its empty
  // generate form instead of the saved paper. The persisted `content.data` is
  // the full GeneratedPaper object — exactly what ExamPaperPreview consumes —
  // so we just fetch and drop it into `paper`. Mirrors the load-by-id pattern
  // used by lesson-plan / quiz / worksheet.
  useEffect(() => {
    // Read the id from window.location (reliable on the client) rather than
    // the render-time-flaky useSearchParams() value; `searchParams` stays in
    // the dep list purely as the re-run trigger when the URL changes.
    const id =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id")
        : searchParams.get("id");
    // Keep view-mode in sync with the URL: true when opened with an id, false
    // after the user navigates to "Create a new paper" (`/exam-paper`).
    setViewingSaved(!!id);
    if (!id) {
      // Left view mode (e.g. the user clicked "Create a new paper"): clear the
      // previously-opened paper so the form starts fresh instead of showing a
      // stale paper below it.
      if (hydratedIdRef.current) {
        hydratedIdRef.current = null;
        setPaper(null);
        setSaved(false);
        setContentId(null);
        setError(null);
        setInProgress(null);
      }
      return;
    }
    if (hydratedIdRef.current === id) return;
    hydratedIdRef.current = id;

    const loadSavedPaper = async () => {
      setHydrating(true);
      setError(null);
      setInProgress(null);
      try {
        const token = await getAuthToken();
        if (!token) {
          setError(t("Session expired. Please log in again."));
          return;
        }
        const res = await fetch(`/api/content/get?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`Failed (${res.status})`);
        }
        const content = await res.json();

        // A 'generating'/'error' library entry has no paper data yet. Show the
        // honest in-progress notice or an error — never "could not load". A
        // 'generating' entry untouched for a while is stuck (instance killed
        // mid-generation): treat as failed, mirroring the library card.
        const stale = isGenerationStale(content?.updatedAt);
        if (content?.status === 'error' || (content?.status === 'generating' && stale)) {
          setError(t("Generation failed. Please try again."));
          return;
        }
        if (content?.status === 'generating') {
          setInProgress(
            t("Still generating. Open My Library in about a minute, or try again with a chapter selected."),
          );
          return;
        }

        const loaded = content?.data;
        // Same defensive shape check as the generate path — never render a
        // half-formed object as a paper.
        if (!loaded || !loaded.title || !Array.isArray(loaded.sections) || loaded.sections.length === 0) {
          setError(t("Could not load the saved paper. Please try again."));
          return;
        }
        setPaper(loaded);
        // Lock a future regen to the saved paper's language (content-level field;
        // fall back to the paper blob, then English).
        setPaperLanguage(content?.language || loaded?.language || 'English');
        setContentId(id); // H3: an explicit re-save should upsert this row
        setSaved(true); // already in the library — don't invite a duplicate save
      } catch {
        setError(t("Could not load the saved paper. Please try again."));
      } finally {
        setHydrating(false);
      }
    };

    loadSavedPaper();
  }, [searchParams, t]);

  const handleGenerate = useCallback(async (params: GenerateParams) => {
    const {
      board, gradeLevel, subject, chapters, chaptersInput, coverageMode,
      difficulty, language, includeAnswerKey, includeMarkingScheme, pyqRatio,
    } = params;

    setError(null);
    setInProgress(null);
    setPaper(null);
    setSaved(false);
    setContentId(null);

    const chapterListFromInput = chapters.length > 0
      ? chapters
      : chaptersInput.split(",").map((c) => c.trim()).filter(Boolean);

    // Chapter-wise mode needs an explicit selection — otherwise an empty list is
    // ambiguous with whole-syllabus. Block with a hint (BUG #21: an empty chapter
    // list also gives Gemini two open-ended constraints → timeouts/malformed
    // papers). Whole-syllabus mode intentionally sends [] and the server expands
    // it to the full chapter list, so it is allowed through empty.
    if (coverageMode === 'chapters' && chapterListFromInput.length === 0) {
      setError(t("Select at least one chapter, or switch to Whole syllabus."));
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
          // Whole-syllabus → [] (server expands to all chapters); chapter-wise → the selection.
          chapters: coverageMode === 'syllabus' ? [] : chapterListFromInput,
          difficulty,
          language: submittedLanguage,
          includeAnswerKey,
          includeMarkingScheme,
          ...(pyqRatio !== undefined && { pyqRatio }),
        }),
      });

      // 202 = AI hit the timeout budget but is still working in the
      // background and WILL land in My Library (a 'generating' entry is already
      // written there and flips to ready when it finishes). Don't render the
      // envelope as a paper, and don't route it to `error` — a slow run is not
      // a failure. Surface a toast pointing to My Library and leave the form
      // usable, per the "generating card lives in the library" UX.
      if (res.status === 202) {
        toast({
          title: t("Generating…"),
          description: t("Still generating. Open My Library in about a minute, or try again with a chapter selected."),
        });
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
      setPaperLanguage(submittedLanguage); // lock a future per-question regen to this language
      // H3: generate is the canonical writer — the paper is ALREADY in the
      // library. Capture its id and mark saved so the Save button doesn't
      // invite a duplicate write (an explicit Save now upserts by this id).
      if (data?.contentId) setContentId(data.contentId);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || t("Something went wrong. Please try again."));
    } finally {
      setGenerating(false);
    }
  }, [t]);

  // Regenerate ONE question via the LLM (an alternative to hand-editing). Keeps
  // the same marks (so sum===maxMarks can't drift) and asks the model to stay
  // in the original's chapter; the new answer key / marking scheme come back
  // with it. Merges the replacement in with the SAME setPaper shape as
  // updateQuestion and flips saved=false so the existing PUT upsert persists it.
  const regenerateQuestion = useCallback(
    async (si: number, qi: number) => {
      const q = paper?.sections?.[si]?.questions?.[qi];
      if (!paper || !q) return;
      setRegeneratingKey(`${si}-${qi}`);
      try {
        const token = await getAuthToken();
        if (!token) {
          setError(t("Session expired. Please log in again."));
          return;
        }
        // Candidate chapters — from the paper's blueprint summary (present for
        // both fresh and hydrated papers). A string/empty summary yields [], and
        // the flow falls back to inferring the topic from the question text.
        const summary = paper.blueprintSummary;
        const chapters =
          summary && typeof summary === 'object' && Array.isArray(summary.chapterWise)
            ? summary.chapterWise.map((c) => c.chapter).filter(Boolean)
            : [];
        const isMcq = !!(q.options && q.options.length > 0);
        const res = await fetch("/api/ai/exam-paper/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            board: paper.board,
            gradeLevel: paper.gradeLevel,
            subject: paper.subject,
            language: paperLanguage,
            chapters,
            originalQuestionText: q.text,
            marks: q.marks,
            isMcq,
            optionCount: q.options?.length ?? 4,
            includeAnswerKey: !!(q.answerKey ?? q.answer),
            includeMarkingScheme: !!q.markingScheme,
            internalChoice: !!q.internalChoice,
          }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || errBody.error || `Failed (${res.status})`);
        }
        const data = await res.json();
        const nq = data?.question;
        if (!nq || !nq.text) throw new Error("empty regen result");
        // Replace only the generated content — never marks/number — with an
        // immutable setPaper patch at (si, qi). Tag source "New": a
        // teacher-regenerated question is freshly invented.
        setPaper((prev) => {
          if (!prev) return prev;
          const sections = prev.sections.map((s, i) =>
            i !== si
              ? s
              : {
                  ...s,
                  questions: s.questions.map((qq, j) =>
                    j !== qi
                      ? qq
                      : {
                          ...qq,
                          text: nq.text,
                          options: isMcq ? nq.options ?? qq.options : undefined,
                          correctOption: nq.correctOption ?? qq.correctOption,
                          answerKey: nq.answerKey || qq.answerKey,
                          markingScheme: nq.markingScheme || qq.markingScheme,
                          internalChoice: nq.internalChoice ?? qq.internalChoice,
                          source: "New",
                        },
                  ),
                },
          );
          return { ...prev, sections };
        });
        setSaved(false);
      } catch {
        toast({
          title: t("Couldn't regenerate"),
          description: t("Couldn't regenerate this question. Please try again."),
          variant: "destructive",
        });
      } finally {
        setRegeneratingKey(null);
      }
    },
    [paper, paperLanguage, t, toast],
  );

  const handleSave = useCallback(async () => {
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
        // H3: echo the id back so the server upserts the existing row.
        body: JSON.stringify({ paper, contentId }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch {
      setError(t("Could not save. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [paper, contentId, t]);

  return {
    // Network
    canUseAI,
    aiUnavailableReason,
    // State
    generating,
    hydrating,
    viewingSaved,
    error,
    inProgress,
    paper,
    saving,
    saved,
    regeneratingKey,
    // Handlers
    handleGenerate,
    handleSave,
    regenerateQuestion,
  };
}
