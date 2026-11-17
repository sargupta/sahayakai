"use client";

import type { FC } from "react";
import { useLibraryId } from "@/hooks/use-library-id";
import type { QuizVariantsOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Button } from "./ui/button";
import {
    Download,
    Eye,
    EyeOff,
    Save,
    Copy,
    Edit2,
    Check,
    X,
    Printer,
    RotateCw,
    Loader2,
    ThumbsUp,
    ThumbsDown,
    MessageSquareQuote,
    Plus,
    Play,
    ClipboardList,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { QuickShareButton } from "@/components/quick-share-button";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";
import { buildArtifactActions, omit, OMIT_REASONS } from "@/lib/artifact-actions";
import { useLanguage } from "@/context/language-context";
import { QuizPlayer } from "@/components/quiz-player";
import { correctOptionIndex } from "@/lib/quiz-scoring";

type QuizDisplayProps = {
    quiz: QuizVariantsOutput;
    onRegenerate?: () => void;
    selectedLanguage?: string;
};

type EditingState = {
    isEditing: boolean;
    editedVariants: QuizVariantsOutput;
};

const PDF_ID = "print-area";

export const QuizDisplay: FC<QuizDisplayProps> = ({
    quiz,
    onRegenerate,
    selectedLanguage,
}) => {
    const [activeTab, setActiveTab] = useState<"easy" | "medium" | "hard">(
        "medium",
    );
    const [showAnswers, setShowAnswers] = useState(false);
    // "review" is the teacher's copy (edit, answer key, print); "play" runs
    // the quiz one question at a time (QuizPlayer).
    const [mode, setMode] = useState<"review" | "play">("review");
    const [editState, setEditState] = useState<EditingState>({
        isEditing: false,
        editedVariants: JSON.parse(JSON.stringify(quiz)),
    });
    const [isRefining, setIsRefining] = useState<number | null>(null);
    const [includeBranding] = useState(true);
    const { toast } = useToast();
    const t = getResultShellDict(selectedLanguage);
    const { t: tr } = useLanguage();
    // One quiz = one Library row. `quiz.id` is the id the server filed the
    // generation under (or the restored item's id), so Save updates that row.
    const libraryId = useLibraryId(quiz.id, quiz);

    useEffect(() => {
        setEditState({
            isEditing: false,
            editedVariants: JSON.parse(JSON.stringify(quiz)),
        });
        if (quiz.medium) setActiveTab("medium");
        else if (quiz.easy) setActiveTab("easy");
        else if (quiz.hard) setActiveTab("hard");
    }, [quiz]);

    const currentQuiz = editState.editedVariants[activeTab];

    if (!currentQuiz) {
        return (
            <div className="mt-8 w-full max-w-4xl mx-auto p-6 text-center text-muted-foreground bg-card rounded-card border border-border shadow-card">
                {tr("No quiz generated for this difficulty level.")}
            </div>
        );
    }

    const handleEditToggle = () => {
        setEditState((prev) => ({ ...prev, isEditing: !prev.isEditing }));
    };

    const handleVariantChange = (
        field: string,
        value: any,
        questionIndex?: number,
        optionIndex?: number,
    ) => {
        setEditState((prev) => {
            const newVariants = { ...prev.editedVariants };
            const currentVariant = newVariants[activeTab];
            if (!currentVariant) return prev;
            if (questionIndex !== undefined) {
                const question = currentVariant.questions[questionIndex];
                if (optionIndex !== undefined && question.options) {
                    question.options[optionIndex] = value;
                } else {
                    (question as any)[field] = value;
                }
            } else {
                (currentVariant as any)[field] = value;
            }
            return { ...prev, editedVariants: newVariants };
        });
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById(PDF_ID);
        if (!element) return;
        const originalDisplay = element.style.display;
        element.style.display = "block";
        element.classList.remove("hidden");
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        // Filenames must stay ASCII-safe. In non-Latin UI languages (e.g.
        // Tamil) the quiz title is in a non-Latin script; stripping those
        // characters used to collapse the slug to a bare separator dash.
        // Fall back to "Quiz" whenever the title is empty or has no usable
        // Latin/alphanumeric characters after sanitising.
        const asciiTitle = (currentQuiz.title || "")
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        const variantTitle = asciiTitle || "Quiz";
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_Quiz_${variantTitle}_${activeTab}.pdf`,
        });
        element.style.display = originalDisplay;
        element.classList.add("hidden");
        toast(
            res.ok
                ? { title: t.pdfDoneTitle, description: t.pdfDoneDesc }
                : {
                      title: t.pdfFailedTitle,
                      description: t.pdfFailedDesc,
                      variant: "destructive",
                  },
        );
    };

    const handleSaveToLibrary = async () => {
        try {
            const { auth } = await import("@/lib/firebase");
            const user = auth.currentUser;
            if (!user) {
                toast({
                    title: t.loginRequiredTitle,
                    description: t.loginRequiredDesc,
                    variant: "destructive",
                });
                return;
            }
            const saveTitle = currentQuiz.title || "General Quiz";
            const payload = {
                id: libraryId,
                type: "quiz",
                title: saveTitle,
                gradeLevel: quiz.gradeLevel || "Class 5",
                subject: quiz.subject || "General",
                topic: currentQuiz.title || quiz.topic || "General",
                language: selectedLanguage || "en",
                data: editState.editedVariants,
            };
            const token = await user.getIdToken();
            const response = await fetch("/api/content/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error("Server rejected save");
            toast({ title: t.savedTitle, description: t.savedDesc });
        } catch {
            toast({
                title: t.saveFailedTitle,
                description: t.saveFailedDesc,
                variant: "destructive",
            });
        }
    };

    const handleCopyText = () => {
        const text = `
${currentQuiz.title} (${activeTab.toUpperCase()})

${currentQuiz.questions
    .map(
        (q, i) => `
Q${i + 1}. ${q.questionText}
${q.options ? q.options.map((o, j) => `   ${String.fromCharCode(97 + j)}) ${o}`).join("\n") : ""}
${showAnswers ? `\n${t.correctAnswer}: ${q.correctAnswer}\n${t.explanation}: ${q.explanation}` : ""}
`,
    )
    .join("\n")}
        `.trim();
        navigator.clipboard.writeText(text);
        toast({ title: t.copiedTitle, description: t.copiedDesc });
    };

    const questionTypeLabel = (type: string) => {
        switch (type) {
            case "multiple_choice":
                return t.mcLabel;
            case "fill_in_the_blanks":
                return t.fillBlanksLabel;
            case "short_answer":
                return t.shortAnswerLabel;
            case "true_false":
                return t.tfLabel;
            default:
                return (type || "Question").replace(/_/g, " ");
        }
    };

    const handleRegenerateQuestion = (idx: number) => {
        setIsRefining(idx);
        setTimeout(() => {
            setEditState((prev) => {
                const newVariants = { ...prev.editedVariants };
                if (newVariants[activeTab]) {
                    newVariants[activeTab] = {
                        ...newVariants[activeTab]!,
                        questions: [...newVariants[activeTab]!.questions],
                    };
                    const q = newVariants[activeTab]!.questions[idx];
                    if (q && q.options) {
                        q.options = [...q.options].sort(
                            () => Math.random() - 0.5,
                        );
                    }
                }
                return {
                    ...prev,
                    editedVariants: newVariants,
                    isEditing: true,
                };
            });
            setIsRefining(null);
        }, 1000);
    };

    const handleFeedback = async (idx: number | "global", type: "up" | "down") => {
        toast({
            title: type === "up" ? t.goodFeedback : t.badFeedback,
            description:
                type === "up"
                    ? "Thanks for your feedback!"
                    : "We'll improve this.",
        });
        try {
            const { auth } = await import("@/lib/firebase");
            const user = auth.currentUser;
            if (!user) return;
            const token = await user.getIdToken();
            await fetch("/api/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    feedbackType:
                        idx === "global" ? "quiz_global" : "question",
                    questionIndex: idx === "global" ? null : idx,
                    quizId: "generated_session",
                    difficulty: activeTab,
                    value: type,
                    questionText:
                        idx !== "global"
                            ? currentQuiz.questions[Number(idx)]?.questionText
                            : null,
                }),
            });
        } catch {
            // Feedback send failed silently
        }
    };

    // Per-question "Save Edit": commits the in-progress edits for a single
    // question. Edits already live in editState.editedVariants (local state),
    // so this persists the whole edited quiz to the library — the same path
    // the global Save uses — and toasts a per-question confirmation. If the
    // quiz was already saved, this updates the saved library doc; otherwise it
    // creates one. Network failures are reported via toast.
    const [savingQuestion, setSavingQuestion] = useState<number | null>(null);

    const handleSaveQuestion = async (idx: number) => {
        setSavingQuestion(idx);
        try {
            const { auth } = await import("@/lib/firebase");
            const user = auth.currentUser;
            if (!user) {
                toast({
                    title: t.loginRequiredTitle,
                    description: t.loginRequiredDesc,
                    variant: "destructive",
                });
                return;
            }
            const saveTitle = currentQuiz.title || "General Quiz";
            const payload = {
                id: libraryId,
                type: "quiz",
                title: saveTitle,
                gradeLevel: quiz.gradeLevel || "Class 5",
                subject: quiz.subject || "General",
                topic: currentQuiz.title || quiz.topic || "General",
                language: selectedLanguage || "en",
                data: editState.editedVariants,
            };
            const token = await user.getIdToken();
            const response = await fetch("/api/content/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error("Server rejected save");
            toast({
                title: tr("Saved"),
                description: `${tr("Question")} ${idx + 1} ${tr("saved")}`,
            });
        } catch {
            toast({
                title: t.saveFailedTitle,
                description: t.saveFailedDesc,
                variant: "destructive",
            });
        } finally {
            setSavingQuestion(null);
        }
    };

    const handleAddQuestion = (
        idx: number,
        type:
            | "multiple_choice"
            | "short_answer"
            | "fill_in_the_blanks"
            | "true_false",
    ) => {
        setEditState((prev) => {
            const newVariants = { ...prev.editedVariants };
            if (!newVariants[activeTab]) return prev;
            newVariants[activeTab] = {
                ...newVariants[activeTab]!,
                questions: [...newVariants[activeTab]!.questions],
            };
            const currentQuestions = newVariants[activeTab]!.questions;
            const newQuestion = {
                questionText: "New Question",
                questionType: type,
                options:
                    type === "multiple_choice"
                        ? ["Option A", "Option B", "Option C", "Option D"]
                        : type === "true_false"
                          ? ["True", "False"]
                          : undefined,
                correctAnswer: type === "true_false" ? "True" : "Answer",
                explanation: "Explanation for the new question.",
            };
            currentQuestions.splice(idx + 1, 0, newQuestion as any);
            return { ...prev, editedVariants: newVariants, isEditing: true };
        });
    };

    const difficultyLabel = {
        easy: t.difficultyEasy,
        medium: t.difficultyMedium,
        hard: t.difficultyHard,
    }[activeTab];

    return (
        <div className="w-full max-w-4xl mx-auto mt-8 animate-fade-in-up">
            {/* Difficulty pills — above ResultShell */}
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="w-full"
            >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <TabsList className="grid h-11 w-full grid-cols-3 rounded-pill border border-border bg-muted p-1 sm:w-96">
                        <TabsTrigger
                            value="easy"
                            disabled={!quiz.easy}
                            className="rounded-pill font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card"
                        >
                            {t.difficultyEasy}
                        </TabsTrigger>
                        <TabsTrigger
                            value="medium"
                            disabled={!quiz.medium}
                            className="rounded-pill font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card"
                        >
                            {t.difficultyMedium}
                        </TabsTrigger>
                        <TabsTrigger
                            value="hard"
                            disabled={!quiz.hard}
                            className="rounded-pill font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card"
                        >
                            {t.difficultyHard}
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex flex-wrap gap-2">
                        <div className="flex h-11 rounded-pill border border-border bg-muted p-1" role="group" aria-label={tr("Quiz view")}>
                            <button
                                type="button"
                                onClick={() => setMode("review")}
                                aria-pressed={mode === "review"}
                                className={cn(
                                    "focus-ring flex items-center gap-2 rounded-pill px-4 text-sm font-semibold transition-all",
                                    mode === "review" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                                {tr("Teacher copy")}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("play")}
                                aria-pressed={mode === "play"}
                                className={cn(
                                    "focus-ring flex items-center gap-2 rounded-pill px-4 text-sm font-semibold transition-all",
                                    mode === "play" ? "bg-primary text-primary-foreground shadow-cta" : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Play className="h-4 w-4" aria-hidden="true" />
                                {tr("Play quiz")}
                            </button>
                        </div>
                        {onRegenerate ? (
                            <Button variant="outline" size="default" onClick={onRegenerate} className="h-11 gap-2 rounded-pill">
                                <RotateCw className="h-4 w-4" aria-hidden="true" />
                                {t.regenerate}
                            </Button>
                        ) : null}
                    </div>
                </div>

                <TabsContent
                    value={activeTab}
                    className="m-0 focus-visible:ring-0 focus-visible:outline-none"
                >
                    {mode === "play" ? (
                        <QuizPlayer
                            quiz={currentQuiz}
                            difficultyLabel={difficultyLabel}
                            subject={quiz.subject}
                            gradeLevel={quiz.gradeLevel}
                            typeLabel={questionTypeLabel}
                            onExit={() => setMode("review")}
                        />
                    ) : (
                    <ResultShell
                        id="quiz-display"
                        title={currentQuiz.title}
                        variant="solid"
                        meta={[
                            {
                                label: t.difficulty,
                                value: difficultyLabel,
                                variant: "secondary",
                            },
                            {
                                value: `${currentQuiz.questions.length} ${t.questionsCount}`,
                                variant: "outline",
                            },
                        ]}
                        actions={buildArtifactActions(
                            {
                                copy: { onClick: handleCopyText },
                                save: { onClick: handleSaveToLibrary },
                                download: { onClick: handleDownloadPDF },
                                share: omit(OMIT_REASONS.VIA_QUICK_SHARE),
                                regenerate: onRegenerate
                                    ? { onClick: onRegenerate }
                                    : omit(OMIT_REASONS.NO_GENERATOR),
                                edit: {
                                    onClick: handleEditToggle,
                                    label: editState.isEditing ? t.save : t.edit,
                                    variant: editState.isEditing ? "default" : "outline",
                                },
                            },
                            t,
                            [
                                // Quiz-specific: the answer key is not one of the
                                // canonical six, so it sits after them.
                                {
                                    label: showAnswers ? t.hideAnswerKey : t.showAnswerKey,
                                    icon: showAnswers ? <EyeOff /> : <Eye />,
                                    onClick: () => setShowAnswers(!showAnswers),
                                    variant: showAnswers ? "default" : "outline",
                                },
                            ],
                        )}
                        extraActions={
                            editState.isEditing ? null : (
                                <QuickShareButton
                                    contentType="quiz"
                                    onSave={handleSaveToLibrary}
                                />
                            )
                        }
                        footer={
                            <FeedbackDialog
                                page="quiz-generator"
                                feature="quiz-result"
                                context={{ title: currentQuiz.title }}
                            />
                        }
                    >
                        {editState.isEditing ? (
                            <Input
                                value={currentQuiz.title}
                                onChange={(e) =>
                                    handleVariantChange("title", e.target.value)
                                }
                                className="text-lg font-bold font-headline mb-4"
                            />
                        ) : null}

                        <ol className="divide-y divide-border">
                            {currentQuiz.questions.map((q, idx) => {
                                const rightIdx = showAnswers ? correctOptionIndex(q) : null;
                                return (
                                <li
                                    key={idx}
                                    className="relative grid grid-cols-[2.5rem_1fr] gap-x-3 py-6 first:pt-2 sm:grid-cols-[3rem_1fr] sm:gap-x-4"
                                >
                                    <span
                                        className="flex h-10 w-10 items-center justify-center rounded-pill bg-tint-accent-soft font-headline text-lg font-semibold tabular-nums text-saffron-700 ring-1 ring-tint-accent-border sm:h-12 sm:w-12 sm:text-xl"
                                        aria-label={`${t.questionLabel} ${idx + 1}`}
                                    >
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                    <div className="flex justify-between items-start gap-2 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className="rounded-pill bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                                                    {questionTypeLabel(
                                                        q.questionType,
                                                    )}
                                                </span>
                                            </div>
                                            {editState.isEditing ? (
                                                <Textarea
                                                    value={q.questionText}
                                                    onChange={(e) =>
                                                        handleVariantChange(
                                                            "questionText",
                                                            e.target.value,
                                                            idx,
                                                        )
                                                    }
                                                    className="font-semibold text-base bg-card border-border min-h-[56px]"
                                                />
                                            ) : (
                                                <p className="break-words font-headline text-lg font-semibold leading-snug text-foreground sm:text-xl">
                                                    {q.questionText}
                                                </p>
                                            )}
                                        </div>

                                        {editState.isEditing ? (
                                            <TooltipProvider delayDuration={100}>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    handleRegenerateQuestion(
                                                                        idx,
                                                                    )
                                                                }
                                                                className={cn(
                                                                    "h-8 w-8 text-warning",
                                                                    isRefining ===
                                                                        idx &&
                                                                        "animate-spin",
                                                                )}
                                                                aria-label={tr("Refine")}
                                                            >
                                                                <RotateCw className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="text-xs">
                                                            {tr("Refine")}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    handleSaveQuestion(
                                                                        idx,
                                                                    )
                                                                }
                                                                disabled={
                                                                    savingQuestion ===
                                                                    idx
                                                                }
                                                                className="h-8 w-8 text-info"
                                                                aria-label={tr(
                                                                    "Save Edit",
                                                                )}
                                                            >
                                                                {savingQuestion ===
                                                                idx ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Check className="h-3.5 w-3.5" />
                                                                )}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="text-xs">
                                                            {tr("Save Edit")}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-success"
                                                                aria-label={tr("Add question")}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent
                                                            align="end"
                                                            className="text-xs"
                                                        >
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleAddQuestion(
                                                                        idx,
                                                                        "multiple_choice",
                                                                    )
                                                                }
                                                            >
                                                                {t.mcLabel}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleAddQuestion(
                                                                        idx,
                                                                        "true_false",
                                                                    )
                                                                }
                                                            >
                                                                {t.tfLabel}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleAddQuestion(
                                                                        idx,
                                                                        "fill_in_the_blanks",
                                                                    )
                                                                }
                                                            >
                                                                {t.fillBlanksLabel}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    handleAddQuestion(
                                                                        idx,
                                                                        "short_answer",
                                                                    )
                                                                }
                                                            >
                                                                {t.shortAnswerLabel}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TooltipProvider>
                                        ) : (
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        handleFeedback(
                                                            idx,
                                                            "up",
                                                        )
                                                    }
                                                    className="h-8 w-8 text-muted-foreground hover:text-success"
                                                    aria-label={t.goodFeedback}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        handleFeedback(
                                                            idx,
                                                            "down",
                                                        )
                                                    }
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    aria-label={t.badFeedback}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {(q.questionType ===
                                            "multiple_choice" ||
                                            q.questionType ===
                                                "true_false") && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                                {q.options?.map(
                                                    (opt, optIdx) => (
                                                        <div
                                                            key={optIdx}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-row border px-3 py-2.5 transition-colors duration-micro",
                                                                rightIdx === optIdx ? "border-success bg-tint-success" : "border-border bg-card",
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-pill text-xs font-semibold",
                                                                    rightIdx === optIdx ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
                                                                )}
                                                            >
                                                                {rightIdx === optIdx ? <Check className="h-3.5 w-3.5" aria-label={t.correctAnswer} /> : String.fromCharCode(
                                                                    65 + optIdx,
                                                                )}
                                                            </div>
                                                            {editState.isEditing ? (
                                                                <Input
                                                                    value={opt}
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleVariantChange(
                                                                            "options",
                                                                            e
                                                                                .target
                                                                                .value,
                                                                            idx,
                                                                            optIdx,
                                                                        )
                                                                    }
                                                                    className="text-sm h-8 border-border"
                                                                />
                                                            ) : (
                                                                <span className="text-sm font-medium break-words">
                                                                    {opt}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}

                                        {(q.questionType === "short_answer" ||
                                            q.questionType ===
                                                "fill_in_the_blanks") && (
                                            <div className="flex h-16 w-full items-end rounded-row border border-dashed border-border bg-milk-100 px-4 pb-2 text-xs text-muted-foreground sm:text-sm">
                                                {t.studentAnswerArea}
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        className={cn(
                                            "mt-3 pt-3 border-t border-border transition-all duration-300 overflow-hidden",
                                            showAnswers
                                                ? "opacity-100 max-h-96"
                                                : "opacity-0 max-h-0 py-0 border-none",
                                        )}
                                    >
                                        <div className="space-y-2 rounded-row bg-tint-success p-3 text-sm">
                                            <div className="flex items-center gap-2 text-success">
                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                <span className="text-xs font-semibold uppercase tracking-wider">
                                                    {t.correctAnswer}
                                                </span>
                                            </div>
                                            {editState.isEditing ? (
                                                <Input
                                                    value={q.correctAnswer}
                                                    onChange={(e) =>
                                                        handleVariantChange(
                                                            "correctAnswer",
                                                            e.target.value,
                                                            idx,
                                                        )
                                                    }
                                                    className="h-9 bg-card border-border"
                                                />
                                            ) : (
                                                <span className="font-bold bg-card px-2 py-1 rounded border border-border inline-block">
                                                    {q.correctAnswer}
                                                </span>
                                            )}
                                            <div className="pt-1">
                                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {t.explanation}
                                                </span>
                                                <p className="mt-1 text-sm leading-relaxed text-foreground">
                                                    {q.explanation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    </div>
                                </li>
                                );
                            })}
                        </ol>
                    </ResultShell>
                    )}
                </TabsContent>
            </Tabs>

            {/* Hidden print structure (unchanged layout, used by PDF export). */}
            <div id={PDF_ID} className="paper-sheet hidden p-10 print:block">
                <div className="print-header mb-8 border-b-2 border-double paper-rule pb-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] paper-muted">
                        {[quiz.subject, quiz.gradeLevel, difficultyLabel].filter(Boolean).join(" · ")}
                    </p>
                    <h1 className="mt-2 text-3xl font-bold">
                        {currentQuiz.title}
                    </h1>
                    <div className="paper-ui mt-4 flex justify-between gap-6 text-sm">
                        <span className="flex-1 border-b paper-rule pb-1 text-left">{tr("Name")}:</span>
                        <span className="w-40 border-b paper-rule pb-1 text-left">{tr("Date")}:</span>
                    </div>
                </div>
                <div className="print-questions space-y-8">
                    {currentQuiz.questions.map((q, i) => (
                        <div key={i} className="break-inside-avoid">
                            <p className="mb-2 text-lg font-bold">
                                {i + 1}. {q.questionText}
                            </p>
                            {q.options && (
                                <ul className="grid grid-cols-2 gap-4 pl-4">
                                    {q.options.map((o, j) => (
                                        <li
                                            key={j}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="inline-block h-5 w-5 rounded-full border paper-rule" />
                                            <span>{o}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {!q.options && (
                                <div className="paper-lines mt-2 h-16" />
                            )}
                        </div>
                    ))}
                </div>
                {includeBranding && (
                    <div className="print-footer paper-ui mt-12 border-t paper-rule pt-4 text-center text-xs paper-muted">
                        {tr("Generated by SahayakAI")}
                    </div>
                )}
                <div className="page-break-before-always mt-12 pt-12 border-t-2 border-black">
                    <h2 className="text-2xl font-bold mb-6">
                        {t.correctAnswer} ({difficultyLabel})
                    </h2>
                    <ol className="list-decimal pl-5 space-y-4">
                        {currentQuiz.questions.map((q, i) => (
                            <li key={i}>
                                <span className="font-bold">
                                    {q.correctAnswer}
                                </span>
                                <p className="text-sm paper-muted">
                                    {q.explanation}
                                </p>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #${PDF_ID},
                    #${PDF_ID} * {
                        visibility: visible;
                    }
                    #${PDF_ID} {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 2rem;
                    }
                    .page-break-before-always {
                        page-break-before: always;
                    }
                }
            `}</style>
        </div>
    );
};
