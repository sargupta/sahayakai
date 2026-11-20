"use client";

import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, ListChecks, Loader2, PlugZap, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BLOOMS_LEVELS, QUIZ_QUESTION_TYPES, type QuizResult } from '@/lib/mcp/quiz/schema';
import { SAHAYAK_LANGUAGES } from '@/lib/mcp/shared/schema';
import type { McpConnection, McpError, McpGenerationInfo } from './use-mcp-quiz';
import type { QuizDifficultyChoice, QuizFormValues } from './mapping';

const fieldClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const TYPE_LABELS: Record<typeof QUIZ_QUESTION_TYPES[number], string> = {
    multiple_choice: 'Multiple choice',
    true_false: 'True / false',
    fill_in_the_blanks: 'Fill in the blanks',
    short_answer: 'Short answer',
};

function ConnectionStatus({ connection, onRetry }: { connection: McpConnection; onRetry: () => void }) {
    return (
        <div role="status" aria-live="polite" data-testid="mcp-status" className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs text-foreground">
            <PlugZap className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="font-semibold">Sahayak MCP</span>
            {connection.state === 'checking' && <span className="text-muted-foreground">Checking connection…</span>}
            {connection.state === 'connected' && <>
                <span className="inline-flex items-center gap-1 font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Connected</span>
                <span className="text-muted-foreground">·</span><code className="font-mono">{connection.server.tool}</code>
                <span className="text-muted-foreground">·</span><span className="text-muted-foreground">{connection.server.protocol}</span>
            </>}
            {connection.state === 'unavailable' && <>
                <span className="text-muted-foreground">{connection.configured ? 'Not connected' : 'Not configured'}</span>
                {connection.configured && <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={onRetry}><RefreshCw className="h-3 w-3" aria-hidden />Retry</button>}
            </>}
        </div>
    );
}

function QuizResultView({ quiz, generation }: { quiz: QuizResult; generation: McpGenerationInfo | null }) {
    const [showAnswers, setShowAnswers] = useState(true);
    return (
        <Card className="overflow-hidden border-primary/15 shadow-sm" data-testid="quiz-result">
            <CardHeader className="border-b bg-primary/[0.035]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary"><ListChecks className="h-5 w-5" aria-hidden /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Quiz</span></div>
                        <CardTitle className="font-headline text-2xl">{quiz.topic}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span>Class {quiz.grade}</span>{quiz.subject && <><span aria-hidden>·</span><span>{quiz.subject}</span></>}<span aria-hidden>·</span><span>{quiz.language}</span>
                        </CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAnswers((v) => !v)}>{showAnswers ? 'Hide answers' : 'Show answers'}</Button>
                </div>
                {generation && <p className="pt-2 text-xs text-muted-foreground">Generated through Sahayak MCP · <code className="font-mono">{generation.tool}</code> · {generation.protocol} · {(generation.durationMs / 1000).toFixed(1)} s</p>}
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
                {quiz.review_notes.length > 0 && <section role="note" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
                    <h3 className="mb-2 font-semibold">Teacher review notes</h3><ul className="list-disc space-y-1 pl-5">{quiz.review_notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
                </section>}
                {quiz.quizzes.map((variant) => <section key={variant.difficulty} className="rounded-xl border border-border/80" data-testid={`quiz-${variant.difficulty}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                        <h3 className="font-headline font-semibold">{variant.title}</h3>
                        <div className="flex gap-2"><Badge variant="secondary" className="capitalize">{variant.difficulty}</Badge><Badge variant="outline">{variant.questions.length} questions</Badge></div>
                    </div>
                    {variant.teacher_instructions && <p className="border-b px-4 py-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">For the teacher:</span> {variant.teacher_instructions}</p>}
                    <ol className="divide-y divide-border/70">
                        {variant.questions.map((question) => <li key={question.number} className="space-y-3 p-4">
                            <div className="flex gap-3">
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{question.number}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3"><p className="font-medium leading-relaxed">{question.question}</p><Badge variant="outline" className="shrink-0">{TYPE_LABELS[question.type]}</Badge></div>
                                    {question.options.length > 0 && <ul className="mt-2 grid gap-1 pl-1 text-sm text-foreground/80 sm:grid-cols-2">{question.options.map((option, index) => <li key={index}>{option}</li>)}</ul>}
                                    {showAnswers && <div className="mt-3 space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                                        <p><span className="font-semibold">Answer:</span> {question.correct_answer}</p>
                                        <p><span className="font-semibold">Why:</span> {question.explanation}</p>
                                    </div>}
                                </div>
                            </div>
                        </li>)}
                    </ol>
                </section>)}
            </CardContent>
        </Card>
    );
}

export function McpQuizView({ signedIn, connection, checkConnection, quiz, generation, error, isLoading, generate }: {
    signedIn: boolean | null;
    connection: McpConnection;
    checkConnection: () => void;
    quiz: QuizResult | null;
    generation: McpGenerationInfo | null;
    error: McpError | null;
    isLoading: boolean;
    generate: (values: QuizFormValues) => Promise<void>;
}) {
    const [values, setValues] = useState<QuizFormValues>({
        topic: 'Fractions', grade: 7, subject: 'Mathematics', numQuestions: 5, difficulty: 'medium',
        questionTypes: ['multiple_choice', 'short_answer'], bloomsLevels: ['Remember', 'Understand'], language: 'English',
    });
    const set = <K extends keyof QuizFormValues,>(key: K, value: QuizFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const toggle = <T extends string,>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void generate(values); };
    const incomplete = values.questionTypes.length === 0 || values.bloomsLevels.length === 0;

    return (
        <main className="container mx-auto max-w-6xl space-y-7 px-4 py-8 sm:py-10">
            <header className="flex flex-col items-center gap-4 text-center">
                <ConnectionStatus connection={connection} onRetry={checkConnection} />
                <div className="space-y-2">
                    <p className="type-caption text-primary">MCP DEMO · QUIZ</p>
                    <h1 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">Quiz Generator</h1>
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Create a classroom quiz with answers and explanations using the existing Sahayak Quiz capability. Your request goes through the authenticated demo API and the official MCP client.</p>
                </div>
            </header>

            {signedIn === false && <Card role="alert" data-testid="mcp-signed-out" className="border-warning/40 bg-warning/10"><CardContent className="p-4 text-sm">Sign in to Sahayak to use this demo. The demo API only serves signed-in teachers.</CardContent></Card>}

            <Card className="border-primary/15 shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Quiz details</CardTitle>
                    <CardDescription>Choose the topic, class and question mix.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-6" data-testid="quiz-form">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label htmlFor="quiz-topic">Topic</Label><Input id="quiz-topic" value={values.topic} onChange={(e) => set('topic', e.target.value)} placeholder="Fractions" required minLength={3} maxLength={200} /></div>
                            <div className="space-y-2"><Label htmlFor="quiz-grade">Grade</Label><select id="quiz-grade" className={fieldClass} value={values.grade} onChange={(e) => set('grade', Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>Class {g}</option>)}</select></div>
                            <div className="space-y-2"><Label htmlFor="quiz-subject">Subject</Label><Input id="quiz-subject" value={values.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Mathematics" maxLength={60} /></div>
                            <div className="space-y-2"><Label htmlFor="quiz-language">Language</Label><select id="quiz-language" className={fieldClass} value={values.language} onChange={(e) => set('language', e.target.value)}>{SAHAYAK_LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}</select></div>
                            <div className="space-y-2"><Label htmlFor="quiz-count">Questions</Label><Input id="quiz-count" type="number" min={1} max={20} step={1} value={values.numQuestions} onChange={(e) => set('numQuestions', Number(e.target.value))} required /></div>
                            <div className="space-y-2"><Label htmlFor="quiz-difficulty">Difficulty</Label><select id="quiz-difficulty" className={fieldClass} value={values.difficulty} onChange={(e) => set('difficulty', e.target.value as QuizDifficultyChoice)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="all">All three levels (slower)</option></select></div>
                        </div>
                        <fieldset className="space-y-2 border-t border-border/70 pt-4">
                            <legend className="text-sm font-medium">Question types</legend>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">{QUIZ_QUESTION_TYPES.map((type) => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={values.questionTypes.includes(type)} onChange={() => set('questionTypes', toggle(values.questionTypes, type))} />{TYPE_LABELS[type]}</label>)}</div>
                        </fieldset>
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium">Bloom&apos;s levels</legend>
                            <div className="flex flex-wrap gap-x-6 gap-y-2">{BLOOMS_LEVELS.map((level) => <label key={level} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={values.bloomsLevels.includes(level)} onChange={() => set('bloomsLevels', toggle(values.bloomsLevels, level))} />{level}</label>)}</div>
                        </fieldset>
                        <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{incomplete ? 'Pick at least one question type and one Bloom’s level.' : 'Generation usually takes 15–40 seconds. Review the answers before using the quiz with students.'}</p>
                            <Button type="submit" disabled={isLoading || incomplete || signedIn !== true} className="min-w-52 font-headline">
                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Generating quiz…</> : <><ListChecks className="mr-2 h-4 w-4" aria-hidden />Generate Quiz</>}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {isLoading && <Card role="status" className="border-primary/20 bg-primary/[0.035]"><CardContent className="flex items-center gap-3 p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /><div><p className="font-medium">Building your quiz</p><p className="text-sm text-muted-foreground">The MCP is writing questions, answers and explanations.</p></div></CardContent></Card>}
            {error && !isLoading && <Card role="alert" data-testid="mcp-error" className="border-destructive/30"><CardContent className="flex items-start gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden /><div><p className="font-semibold">The quiz could not be generated</p><p className="text-sm text-muted-foreground">{error.message}</p>{error.retryable && <Button className="mt-4" variant="outline" onClick={() => void generate(values)}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />Try again</Button>}</div></CardContent></Card>}
            {quiz && <QuizResultView quiz={quiz} generation={generation} />}
        </main>
    );
}
