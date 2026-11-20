"use client";

/**
 * QuizPlayer — take a generated quiz one question at a time.
 *
 * Intro (what the quiz is, how many questions, which kinds) → one focused
 * question per screen with a numbered answer-status strip, "Check" that marks
 * the answer and shows the generator's explanation, Previous/Next → a results
 * screen with the score and every answer beside the key.
 *
 * Grading is src/lib/quiz-scoring.ts: multiple choice and true/false are
 * marked automatically when the key resolves to an option; typed answers are
 * marked automatically only on a normalised exact match, otherwise the learner
 * sees the key and marks themselves ("review"). Nothing is saved — this is a
 * practice run in the browser over the quiz already on screen.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Flag, Lightbulb, Play, RotateCcw, X } from "lucide-react";
import type { QuizGeneratorOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/language-context";
import { correctOptionIndex, gradeResponse, scoreQuiz, type QuizGrade, type QuizResponse } from "@/lib/quiz-scoring";
import { cn } from "@/lib/utils";

type Question = QuizGeneratorOutput["questions"][number];

interface QuizPlayerProps {
    quiz: QuizGeneratorOutput;
    difficultyLabel: string;
    subject?: string | null;
    gradeLevel?: string | null;
    typeLabel: (type: string) => string;
    onExit: () => void;
}

const LETTERS = "ABCDEFGH";

/** The key as the learner saw it: the option text when the key is just a letter ("B"). */
function answerText(q: Question): string {
    const i = q.options?.length ? correctOptionIndex(q) : null;
    return i !== null && q.options ? q.options[i] : q.correctAnswer;
}

const GRADE_DOT: Record<QuizGrade, string> = {
    correct: "bg-success text-success-foreground ring-success",
    incorrect: "bg-destructive text-destructive-foreground ring-destructive",
    review: "bg-warning text-warning-foreground ring-warning",
};

function ScoreRing({ percent }: { percent: number }) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const tone = percent >= 80 ? "text-success" : percent >= 50 ? "text-primary" : "text-warning";
    return (
        <svg viewBox="0 0 120 120" className="h-40 w-40" role="img" aria-label={`${percent}%`}>
            <circle cx="60" cy="60" r={r} className="fill-none stroke-muted" strokeWidth="10" />
            <circle
                cx="60"
                cy="60"
                r={r}
                className={cn("fill-none stroke-current transition-[stroke-dashoffset] duration-700 ease-out-quart", tone)}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - percent / 100)}
                transform="rotate(-90 60 60)"
            />
            <text x="60" y="58" textAnchor="middle" className="fill-foreground font-headline text-3xl font-semibold">
                {percent}%
            </text>
        </svg>
    );
}

export function QuizPlayer({ quiz, difficultyLabel, subject, gradeLevel, typeLabel, onExit }: QuizPlayerProps) {
    const { t } = useLanguage();
    const questions = quiz.questions;
    const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
    const [index, setIndex] = useState(0);
    const [responses, setResponses] = useState<Record<number, QuizResponse>>({});
    const [checked, setChecked] = useState<Record<number, boolean>>({});
    const headingRef = useRef<HTMLHeadingElement>(null);

    // A new quiz (difficulty tab, regenerate) starts the player over.
    useEffect(() => {
        setStage("intro");
        setIndex(0);
        setResponses({});
        setChecked({});
    }, [quiz]);

    // Move focus to the question so keyboard and screen-reader users follow along.
    useEffect(() => {
        if (stage === "playing") headingRef.current?.focus();
    }, [index, stage]);

    const typeCounts = useMemo(() => {
        const m = new Map<string, number>();
        for (const q of questions) m.set(q.questionType, (m.get(q.questionType) ?? 0) + 1);
        return [...m.entries()];
    }, [questions]);

    const score = useMemo(() => scoreQuiz(questions, responses), [questions, responses]);
    const q: Question | undefined = questions[index];
    const response = responses[index];
    const isChecked = !!checked[index];
    const grade = isChecked && q ? gradeResponse(q, response) : null;
    const hasOptions = !!q?.options?.length;
    const answered = hasOptions ? response?.optionIndex !== undefined : !!response?.text?.trim();
    const rightIndex = q && hasOptions ? correctOptionIndex(q) : null;
    const answeredCount = questions.filter((_, i) => checked[i]).length;

    const setResponse = (patch: Partial<QuizResponse>) =>
        setResponses((prev) => ({ ...prev, [index]: { ...prev[index], ...patch } }));

    const restart = () => {
        setResponses({});
        setChecked({});
        setIndex(0);
        setStage("playing");
    };

    const next = () => {
        if (index < questions.length - 1) setIndex(index + 1);
        else setStage("done");
    };

    if (!questions.length) return null;

    // ── Intro ────────────────────────────────────────────────────────────
    if (stage === "intro") {
        return (
            <div className="animate-fade-in-up overflow-hidden rounded-card border border-border bg-card shadow-card">
                <div className="bg-tint-accent-soft px-6 py-10 text-center sm:px-10">
                    <p className="type-eyebrow text-saffron-700">{t("Quiz")}</p>
                    <h2 className="mx-auto mt-3 max-w-2xl font-headline text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                        {quiz.title}
                    </h2>
                    <ul className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
                        {[subject, gradeLevel, difficultyLabel].filter(Boolean).map((v) => (
                            <li key={v as string} className="rounded-pill bg-card px-3 py-1 font-medium text-foreground ring-1 ring-border">
                                {v}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="grid gap-6 px-6 py-8 sm:grid-cols-3 sm:px-10">
                    <div>
                        <p className="font-headline text-4xl font-semibold tabular-nums text-foreground">{questions.length}</p>
                        <p className="text-sm text-muted-foreground">{t("Questions")}</p>
                    </div>
                    <ul className="space-y-1 text-sm sm:col-span-2">
                        {typeCounts.map(([type, n]) => (
                            <li key={type} className="flex items-center justify-between gap-4 border-b border-border pb-1 last:border-0">
                                <span className="text-foreground">{typeLabel(type)}</span>
                                <span className="tabular-nums text-muted-foreground">{n}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
                    <p className="text-sm text-muted-foreground">{t("Answer one question at a time. Check each answer to see why it is right.")}</p>
                    <Button size="lg" className="h-12 gap-2 px-8 font-headline shadow-cta" onClick={() => setStage("playing")}>
                        <Play className="h-4 w-4" aria-hidden="true" />
                        {t("Start quiz")}
                    </Button>
                </div>
            </div>
        );
    }

    // ── Results ──────────────────────────────────────────────────────────
    if (stage === "done") {
        const verdict =
            score.percent >= 80 ? t("Excellent work!") : score.percent >= 50 ? t("Good effort!") : t("Keep practising!");
        return (
            <div className="animate-fade-in-up space-y-6">
                <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                    <div className="flex flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:px-10">
                        <ScoreRing percent={score.percent} />
                        <div className="text-center sm:text-left">
                            <p className="type-eyebrow text-muted-foreground">{t("Your score")}</p>
                            <h2 className="mt-2 font-headline text-3xl font-semibold text-foreground">{verdict}</h2>
                            <p className="mt-1 text-muted-foreground">
                                {t("{correct} of {total} correct").replace("{correct}", String(score.correct)).replace("{total}", String(score.total))}
                            </p>
                            <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm sm:justify-start">
                                <li className="rounded-pill bg-tint-success px-3 py-1 font-medium text-success">
                                    {score.correct} {t("correct")}
                                </li>
                                <li className="rounded-pill bg-tint-danger px-3 py-1 font-medium text-destructive">
                                    {score.incorrect} {t("wrong")}
                                </li>
                                {score.review > 0 && (
                                    <li className="rounded-pill bg-tint-warning px-3 py-1 font-medium text-warning">
                                        {score.review} {t("to check")}
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border px-6 py-4 sm:px-10">
                        <Button onClick={restart} className="gap-2">
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            {t("Try again")}
                        </Button>
                        <Button variant="outline" onClick={onExit}>
                            {t("Back to the quiz")}
                        </Button>
                    </div>
                </div>

                <ol className="space-y-3" aria-label={t("Your answers")}>
                    {questions.map((qq, i) => {
                        const g = gradeResponse(qq, responses[i]);
                        const r = responses[i];
                        const yours =
                            r?.optionIndex !== undefined && qq.options ? qq.options[r.optionIndex] : r?.text?.trim() || t("Not answered");
                        return (
                            <li key={i} className="flex gap-4 rounded-row border border-border bg-card p-4">
                                <span
                                    className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-sm font-semibold", GRADE_DOT[g])}
                                    aria-label={g === "correct" ? t("correct") : g === "incorrect" ? t("wrong") : t("to check")}
                                >
                                    {g === "correct" ? <Check className="h-4 w-4" /> : g === "incorrect" ? <X className="h-4 w-4" /> : "?"}
                                </span>
                                <div className="min-w-0 flex-1 space-y-1 text-sm">
                                    <p className="font-medium text-foreground">
                                        {i + 1}. {qq.questionText}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {t("Your answer")}: <span className="text-foreground">{yours}</span>
                                    </p>
                                    {g !== "correct" && (
                                        <p className="text-muted-foreground">
                                            {t("Correct answer")}: <span className="font-medium text-success">{answerText(qq)}</span>
                                        </p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        );
    }

    // ── One question ─────────────────────────────────────────────────────
    if (!q) return null;
    const progress = Math.round(((index + (isChecked ? 1 : 0)) / questions.length) * 100);

    return (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
            {/* Progress */}
            <div className="space-y-3 border-b border-border px-4 py-4 sm:px-8">
                <div className="flex items-center justify-between gap-3 text-sm">
                    <button type="button" onClick={onExit} className="focus-ring flex items-center gap-2 rounded-pill px-2 py-1 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        {t("Exit")}
                    </button>
                    <p className="font-medium tabular-nums text-foreground" aria-live="polite">
                        {t("Question {n} of {total}").replace("{n}", String(index + 1)).replace("{total}", String(questions.length))}
                    </p>
                    <p className="tabular-nums text-muted-foreground">
                        {answeredCount}/{questions.length}
                    </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-pill bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-pill bg-primary transition-[width] duration-500 ease-out-quart" style={{ width: `${progress}%` }} />
                </div>
                <nav aria-label={t("Questions")} className="flex flex-wrap gap-2">
                    {questions.map((qq, i) => {
                        const g = checked[i] ? gradeResponse(qq, responses[i]) : null;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setIndex(i)}
                                aria-current={i === index ? "step" : undefined}
                                aria-label={t("Question {n} of {total}").replace("{n}", String(i + 1)).replace("{total}", String(questions.length))}
                                className={cn(
                                    "focus-ring flex h-8 w-8 items-center justify-center rounded-pill text-xs font-semibold tabular-nums transition-colors duration-micro",
                                    g ? GRADE_DOT[g] : "bg-muted text-muted-foreground hover:bg-milk-300",
                                    i === index && "ring-2 ring-offset-2 ring-offset-card",
                                    i === index && !g && "ring-primary",
                                )}
                            >
                                {i + 1}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Question */}
            <div key={index} className="animate-fade-in-up space-y-6 px-4 py-8 sm:px-8 sm:py-10">
                <div className="space-y-3">
                    <span className="inline-block rounded-pill bg-tint-accent-soft px-3 py-1 text-xs font-semibold text-saffron-700">
                        {typeLabel(q.questionType)}
                    </span>
                    <h3 ref={headingRef} tabIndex={-1} className="font-headline text-2xl font-semibold leading-snug text-foreground outline-none sm:text-3xl">
                        {q.questionText}
                    </h3>
                </div>

                {hasOptions ? (
                    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={q.questionText}>
                        {q.options!.map((opt, oi) => {
                            const selected = response?.optionIndex === oi;
                            const isRight = isChecked && rightIndex === oi;
                            const isWrongPick = isChecked && selected && rightIndex !== null && rightIndex !== oi;
                            return (
                                <button
                                    key={oi}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    disabled={isChecked}
                                    onClick={() => setResponse({ optionIndex: oi })}
                                    className={cn(
                                        "focus-ring group flex min-h-14 items-center gap-3 rounded-row border-2 px-4 py-3 text-left text-base transition-all duration-micro ease-out-quart",
                                        !isChecked && "hover:-translate-y-px hover:border-primary/50 hover:shadow-card",
                                        selected && !isChecked && "border-primary bg-tint-accent-soft",
                                        !selected && !isChecked && "border-border bg-card",
                                        isRight && "border-success bg-tint-success",
                                        isWrongPick && "border-destructive bg-tint-danger",
                                        isChecked && !isRight && !isWrongPick && "border-border bg-card opacity-60",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-sm font-semibold transition-colors",
                                            selected && !isChecked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                                            isRight && "bg-success text-success-foreground",
                                            isWrongPick && "bg-destructive text-destructive-foreground",
                                        )}
                                        aria-hidden="true"
                                    >
                                        {isRight ? <Check className="h-4 w-4" /> : isWrongPick ? <X className="h-4 w-4" /> : LETTERS[oi]}
                                    </span>
                                    <span className="min-w-0 break-words text-foreground">{opt}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <label htmlFor={`quiz-answer-${index}`} className="text-sm font-medium text-foreground">
                            {t("Your answer")}
                        </label>
                        <Input
                            id={`quiz-answer-${index}`}
                            value={response?.text ?? ""}
                            disabled={isChecked}
                            onChange={(e) => setResponse({ text: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && answered && !isChecked) setChecked((c) => ({ ...c, [index]: true }));
                            }}
                            className="h-14 rounded-field text-lg"
                            placeholder={t("Type your answer")}
                        />
                    </div>
                )}

                {/* Feedback */}
                {isChecked && grade && (
                    <div
                        className={cn(
                            "animate-fade-in-up space-y-3 rounded-row p-4",
                            grade === "correct" ? "bg-tint-success" : grade === "incorrect" ? "bg-tint-danger" : "bg-tint-warning",
                        )}
                        role="status"
                    >
                        <p
                            className={cn(
                                "flex items-center gap-2 font-headline text-lg font-semibold",
                                grade === "correct" ? "text-success" : grade === "incorrect" ? "text-destructive" : "text-warning",
                            )}
                        >
                            {grade === "correct" ? <Check className="h-5 w-5" aria-hidden="true" /> : grade === "incorrect" ? <X className="h-5 w-5" aria-hidden="true" /> : <Flag className="h-5 w-5" aria-hidden="true" />}
                            {grade === "correct" ? t("Correct!") : grade === "incorrect" ? t("Not quite") : t("Check your answer")}
                        </p>
                        {grade !== "correct" && (
                            <p className="text-sm text-foreground">
                                {t("Correct answer")}: <span className="font-semibold">{answerText(q)}</span>
                            </p>
                        )}
                        {grade === "review" && (
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-foreground">{t("Did you get it right?")}</span>
                                <Button size="sm" variant="outline" onClick={() => setResponse({ selfMark: "correct" })} className="h-8">
                                    {t("Yes")}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setResponse({ selfMark: "incorrect" })} className="h-8">
                                    {t("No")}
                                </Button>
                            </div>
                        )}
                        {q.explanation && (
                            <p className="flex gap-2 text-sm leading-relaxed text-foreground">
                                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                {q.explanation}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-milk-100 px-4 py-4 sm:px-8">
                <Button variant="ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} className="gap-2">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {t("Previous")}
                </Button>
                {!isChecked ? (
                    <Button onClick={() => setChecked((c) => ({ ...c, [index]: true }))} disabled={!answered} className="h-11 gap-2 px-6 shadow-cta">
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {t("Check answer")}
                    </Button>
                ) : (
                    <Button onClick={next} className="h-11 gap-2 px-6 shadow-cta">
                        {index < questions.length - 1 ? t("Next question") : t("See results")}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}
            </div>
        </div>
    );
}
