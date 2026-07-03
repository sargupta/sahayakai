"use client";

/**
 * useExamPaper — all exam-paper logic, zero markup.
 *
 * Composes the shared useGenerator spine (abortable fetch, 202
 * "still generating" branch, malformed-response guard — the "undefined
 * undefined undefined" fix — and limit taxonomy) with exam-paper-specific
 * behavior: the page-level auth gate, preferred-board defaulting (QA #9),
 * blueprint lookup, chapter selection, the BUG #21 chapter requirement,
 * VIDYA URL prefill, and PUT-to-save.
 *
 * Exam-paper keeps its imperative useState form (no react-hook-form) —
 * the generator spine is deliberately form-library agnostic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useLanguage } from "@/context/language-context";
import { getAuthToken } from "@/lib/get-auth-token";
import { useSearchParams } from "next/navigation";
import { normaliseVidyaLanguage, normaliseVidyaGradeLevel } from "@/lib/vidya-action-normalizer";
import { EDUCATION_BOARDS, LANGUAGE_CODE_MAP } from "@/types";
import { getProfileData } from "@/lib/api/profile";
import { useNetworkAware } from "@/hooks/use-network-aware";
import {
    findBlueprint,
    getAvailableBlueprints,
    type ExamBlueprint,
    type SectionBlueprint,
} from "@/ai/data/board-blueprints";
import { MalformedResponseError, useGenerator } from "@/features/generator";
import type { ExamPaperFormValues, GeneratedPaper } from "../types";

export function useExamPaper() {
    const { t } = useLanguage();

    // Auth state
    const [authed, setAuthed] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

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

    // Save / local error state (save failures + session-expired pre-checks
    // share the same inline error strip as generation failures, as before)
    const { canUseAI, aiUnavailableReason } = useNetworkAware();
    const [localError, setLocalError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const generator = useGenerator<ExamPaperFormValues, GeneratedPaper>({
        feature: "exam-paper",
        endpoint: "/api/ai/exam-paper",
        // Page gates rendering on auth itself — don't pop the modal guard.
        requireAuthOnSubmit: false,
        openAuthModalOn401: false,
        buildRequest: (values) => ({
            ...values,
            // NCERT-demo 2026-05-19 hardening: ALWAYS send a non-empty
            // `language`. Exam-paper uses display name format ("English"); the
            // initial useState default ensures it can never be empty, but we
            // defend in depth in case future code wires this to a controlled
            // selector with a transient empty value.
            language: values.language && values.language.trim() ? values.language : "English",
        }),
        // Defensive: a 200 with no title/sections is the same garbage shape
        // as the old 202 mis-render. Treat it as an error instead of
        // rendering "undefined undefined undefined".
        parseResponse: (json) => {
            const data = json as { paper?: GeneratedPaper } & GeneratedPaper;
            const candidate = data?.paper || data;
            if (
                !candidate ||
                !candidate.title ||
                !Array.isArray(candidate.sections) ||
                candidate.sections.length === 0
            ) {
                throw new MalformedResponseError(
                    t("The AI returned an incomplete paper. Please try again with a chapter selected."),
                );
            }
            return candidate;
        },
        stillGeneratingMessage: t(
            "Still generating. Open My Library in about a minute, or try again with a chapter selected.",
        ),
        failureMessage: t("Something went wrong. Please try again."),
    });

    // ── Auth guard ─────────────────────────────────────────────────────────
    // Guard so the teacher's preferred board is applied only once, on first
    // load — never re-applied after they manually pick a different board.
    const boardDefaultedRef = React.useRef(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setAuthed(!!user);
            setAuthLoading(false);
            // QA #9 — default the board field to the teacher's preferred board so
            // generated papers are board-aligned out of the box. Falls back to the
            // hardcoded "CBSE" default when no board is saved or it's unknown.
            if (user && !boardDefaultedRef.current) {
                getProfileData(user.uid)
                    .then(({ profile }) => {
                        const savedProfile = profile as { preferredBoard?: string; educationBoard?: string } | null;
                        const preferred = savedProfile?.preferredBoard ?? savedProfile?.educationBoard;
                        if (
                            preferred &&
                            (EDUCATION_BOARDS as readonly string[]).includes(preferred) &&
                            !boardDefaultedRef.current
                        ) {
                            boardDefaultedRef.current = true;
                            setBoard(preferred);
                        }
                    })
                    .catch(() => {
                        /* non-fatal — keep the CBSE default */
                    });
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

    const formatSectionPreview = useCallback(
        (section: SectionBlueprint) => {
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
        },
        [t],
    );

    // ── Generate paper ─────────────────────────────────────────────────────

    const handleGenerate = async () => {
        setLocalError(null);
        setSaved(false);
        // Old page cleared the previous paper before validation too — a
        // failed pre-flight leaves the inline error, not a stale paper.
        generator.reset();

        // BUG #21 guard: when there is no official blueprint for the chosen
        // board/grade/subject, the AI route requires at least one chapter to
        // anchor the paper (otherwise Gemini gets two open-ended constraints
        // and either times out or returns a malformed paper). Mirror the
        // server-side 400 here so the teacher gets a clear inline notice
        // instead of submitting an empty form and seeing a generic API error.
        const chapterListFromInput =
            chapters.length > 0
                ? chapters
                : chaptersInput.split(",").map((c) => c.trim()).filter(Boolean);
        if (!matchedBlueprint && chapterListFromInput.length === 0) {
            setLocalError(
                t("Please add at least one chapter for this board / grade / subject. We only have official blueprints for CBSE Class 9 and Class 10 Mathematics and Science."),
            );
            return;
        }

        const token = await getAuthToken();
        if (!token) {
            setLocalError(t("Session expired. Please log in again."));
            return;
        }

        await generator.generate({
            board,
            gradeLevel,
            subject,
            chapters: chapterListFromInput,
            difficulty,
            language,
            includeAnswerKey,
            includeMarkingScheme,
        });
    };

    // ── Save to library ────────────────────────────────────────────────────

    const handleSave = async () => {
        const paper = generator.result;
        if (!paper) return;
        setSaving(true);
        try {
            const token = await getAuthToken();
            if (!token) {
                setLocalError(t("Session expired. Please log in again."));
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
            setLocalError(t("Could not save. Please try again."));
        } finally {
            setSaving(false);
        }
    };

    // Inline error strip = local (validation / session / save) errors first,
    // then whatever the generator run surfaced (202 / malformed / failure).
    const generatorError =
        generator.error && generator.error.code !== "ABORTED" ? generator.error.message : null;
    const error = localError ?? generatorError;

    return {
        // auth gate
        authed,
        authLoading,
        // form state
        board, setBoard,
        gradeLevel, setGradeLevel,
        subject, setSubject,
        chapters, setChapters,
        chaptersInput, setChaptersInput,
        difficulty, setDifficulty,
        language, setLanguage,
        includeAnswerKey, setIncludeAnswerKey,
        includeMarkingScheme, setIncludeMarkingScheme,
        // blueprint
        availableSubjects,
        matchedBlueprint,
        chapterSuggestions,
        formatSectionPreview,
        // generation
        handleGenerate,
        generating: generator.isGenerating,
        status: generator.status,
        paper: generator.result,
        limitState: generator.limitState,
        error,
        canUseAI,
        aiUnavailableReason,
        // save
        handleSave,
        saving,
        saved,
    };
}
