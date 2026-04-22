"use client";

import type { FC } from "react";
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
    ThumbsUp,
    ThumbsDown,
    MessageSquareQuote,
    Plus,
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
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

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
    const [editState, setEditState] = useState<EditingState>({
        isEditing: false,
        editedVariants: JSON.parse(JSON.stringify(quiz)),
    });
    const [isRefining, setIsRefining] = useState<number | null>(null);
    const [includeBranding] = useState(true);
    const { toast } = useToast();
    const t = getResultShellDict(selectedLanguage);

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
            <div className="mt-8 w-full max-w-4xl mx-auto p-6 text-center text-muted-foreground bg-white rounded-[var(--radius)] border border-slate-200 shadow-soft">
                No quiz generated for this difficulty level.
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
        const variantTitle = currentQuiz.title || "Quiz";
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
                id: crypto.randomUUID(),
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
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <TabsList className="grid w-full sm:w-[360px] grid-cols-3 bg-muted border border-border shadow-soft p-1 rounded-xl h-11">
                        <TabsTrigger
                            value="easy"
                            disabled={!quiz.easy}
                            className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft font-semibold transition-all"
                        >
                            {t.difficultyEasy}
                        </TabsTrigger>
                        <TabsTrigger
                            value="medium"
                            disabled={!quiz.medium}
                            className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft font-semibold transition-all"
                        >
                            {t.difficultyMedium}
                        </TabsTrigger>
                        <TabsTrigger
                            value="hard"
                            disabled={!quiz.hard}
                            className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft font-semibold transition-all"
                        >
                            {t.difficultyHard}
                        </TabsTrigger>
                    </TabsList>

                    {onRegenerate ? (
                        <Button
                            variant="outline"
                            size="default"
                            onClick={onRegenerate}
                            className="h-11 gap-2"
                        >
                            <RotateCw className="h-4 w-4" />
                            {t.regenerate}
                        </Button>
                    ) : null}
                </div>

                <TabsContent
                    value={activeTab}
                    className="m-0 focus-visible:ring-0 focus-visible:outline-none"
                >
                    <ResultShell
                        id="quiz-display"
                        title={currentQuiz.title}
                        variant="glass"
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
                        actions={[
                            {
                                label: showAnswers
                                    ? t.hideAnswerKey
                                    : t.showAnswerKey,
                                icon: showAnswers ? <EyeOff /> : <Eye />,
                                onClick: () => setShowAnswers(!showAnswers),
                                variant: showAnswers ? "default" : "outline",
                            },
                            {
                                label: editState.isEditing
                                    ? t.save
                                    : t.edit,
                                icon: editState.isEditing ? (
                                    <Check />
                                ) : (
                                    <Edit2 />
                                ),
                                onClick: handleEditToggle,
                                variant: editState.isEditing
                                    ? "default"
                                    : "outline",
                            },
                            {
                                label: t.copy,
                                icon: <Copy />,
                                onClick: handleCopyText,
                            },
                            {
                                label: t.save,
                                icon: <Save />,
                                onClick: handleSaveToLibrary,
                            },
                            {
                                label: t.pdf,
                                icon: <Download />,
                                onClick: handleDownloadPDF,
                            },
                        ]}
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

                        <div className="space-y-4">
                            {currentQuiz.questions.map((q, idx) => (
                                <div
                                    key={idx}
                                    className="relative p-4 sm:p-5 rounded-xl border border-border bg-muted/30"
                                >
                                    <div className="flex justify-between items-start gap-2 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="font-bold text-muted-foreground/70 text-xs tracking-tight uppercase">
                                                    {t.questionLabel} {idx + 1}
                                                </span>
                                                <div className="h-1 w-1 rounded-full bg-border" />
                                                <span className="text-[10px] uppercase font-bold text-primary/80">
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
                                                    className="font-semibold text-base bg-white border-border min-h-[56px]"
                                                />
                                            ) : (
                                                <p className="font-semibold text-base sm:text-lg leading-snug break-words">
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
                                                                    "h-8 w-8 text-amber-600",
                                                                    isRefining ===
                                                                        idx &&
                                                                        "animate-spin",
                                                                )}
                                                                aria-label="Refine"
                                                            >
                                                                <RotateCw className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="text-xs">
                                                            Refine
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                            asChild
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-emerald-600"
                                                                aria-label="Add question"
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
                                                    className="h-8 w-8 text-muted-foreground hover:text-green-600"
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
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
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
                                                            className="flex items-center gap-2 p-2 sm:p-3 rounded-lg border border-border bg-white"
                                                        >
                                                            <div className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground bg-muted flex-shrink-0">
                                                                {String.fromCharCode(
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
                                            <div className="w-full h-20 border-2 border-dashed border-border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground/70 text-xs sm:text-sm">
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
                                        <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 text-sm space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-600" />
                                                <span className="font-bold uppercase text-[10px] tracking-wider">
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
                                                    className="h-9 bg-white border-border"
                                                />
                                            ) : (
                                                <span className="font-bold bg-white px-2 py-1 rounded border border-border inline-block">
                                                    {q.correctAnswer}
                                                </span>
                                            )}
                                            <div className="pt-1">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                    {t.explanation}
                                                </span>
                                                <p className="text-muted-foreground leading-relaxed text-xs mt-1">
                                                    {q.explanation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ResultShell>
                </TabsContent>
            </Tabs>

            {/* Hidden print structure (unchanged layout, used by PDF export). */}
            <div id={PDF_ID} className="hidden print:block">
                <div className="print-header mb-8 text-center border-b pb-4">
                    <h1 className="text-3xl font-bold">
                        {currentQuiz.title}
                    </h1>
                    <p className="text-sm text-muted-foreground uppercase tracking-widest">
                        {difficultyLabel}
                    </p>
                </div>
                <div className="print-questions space-y-8">
                    {currentQuiz.questions.map((q, i) => (
                        <div key={i} className="break-inside-avoid">
                            <p className="font-bold text-lg mb-2">
                                {i + 1}. {q.questionText}
                            </p>
                            {q.options && (
                                <ul className="grid grid-cols-2 gap-4 pl-4">
                                    {q.options.map((o, j) => (
                                        <li
                                            key={j}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="w-6 h-6 border rounded-full inline-block" />
                                            <span>{o}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {!q.options && (
                                <div className="h-20 border-b border-border mt-4" />
                            )}
                        </div>
                    ))}
                </div>
                {includeBranding && (
                    <div className="print-footer mt-12 pt-4 border-t text-center text-xs text-muted-foreground/70">
                        Generated by SahayakAI
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
                                <p className="text-sm text-muted-foreground">
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
