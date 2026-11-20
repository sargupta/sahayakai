"use client";

import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText, Loader2, PlugZap, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EDUCATION_BOARDS } from '@/types';
import type { ExamPaperResult } from '@/lib/mcp/exam-paper/schema';
import { SAHAYAK_LANGUAGES } from '@/lib/mcp/shared/schema';
import type { McpConnection, McpError, McpGenerationInfo } from './use-mcp-exam-paper';
import type { ExamPaperFormValues } from './mapping';

const fieldClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function ConnectionStatus({ connection, onRetry }: { connection: McpConnection; onRetry: () => void }) {
    return (
        <div role="status" aria-live="polite" data-testid="mcp-status" className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs text-foreground">
            <PlugZap className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span className="font-semibold">Sahayak MCP</span>
            {connection.state === 'checking' && <span className="text-muted-foreground">Checking connection…</span>}
            {connection.state === 'connected' && <>
                <span className="inline-flex items-center gap-1 font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Connected</span>
                <span className="text-muted-foreground">·</span><code className="font-mono">{connection.server.tool}</code>
            </>}
            {connection.state === 'unavailable' && <>
                <span className="text-muted-foreground">{connection.configured ? 'Not connected' : 'Not configured'}</span>
                {connection.configured && <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={onRetry}><RefreshCw className="h-3 w-3" aria-hidden />Retry</button>}
            </>}
        </div>
    );
}

function ExamPaperResultView({ paper, generation }: { paper: ExamPaperResult; generation: McpGenerationInfo | null }) {
    return (
        <Card className="overflow-hidden border-primary/15 shadow-sm" data-testid="exam-paper-result">
            <CardHeader className="border-b bg-primary/[0.035]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary"><FileText className="h-5 w-5" aria-hidden /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Exam paper</span></div>
                        <CardTitle className="font-headline text-2xl">{paper.title}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span>{paper.board}</span><span aria-hidden>·</span><span>Class {paper.grade}</span><span aria-hidden>·</span><span>{paper.subject}</span><span aria-hidden>·</span><span>{paper.language}</span>
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{paper.max_marks} marks</Badge>
                        <Badge variant="outline" className="gap-1"><Clock3 className="h-3 w-3" aria-hidden />{paper.duration}</Badge>
                    </div>
                </div>
                {generation && <p className="pt-2 text-xs text-muted-foreground">Generated through Sahayak MCP · <code className="font-mono">{generation.tool}</code> · {generation.protocol} · {(generation.durationMs / 1000).toFixed(1)} s</p>}
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
                {paper.general_instructions.length > 0 && <section aria-labelledby="exam-instructions">
                    <h3 id="exam-instructions" className="mb-2 font-headline text-lg font-semibold">General instructions</h3>
                    <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground/80">{paper.general_instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>
                </section>}

                <div className="space-y-5">
                    {paper.sections.map((section, sectionIndex) => <section key={`${section.name}-${sectionIndex}`} className="rounded-xl border border-border/80">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                            <div><h3 className="font-headline font-semibold">{section.name}</h3>{section.label && <p className="text-sm text-muted-foreground">{section.label}</p>}</div>
                            <Badge variant="outline">{section.total_marks} marks</Badge>
                        </div>
                        <ol className="divide-y divide-border/70">
                            {section.questions.map((question) => <li key={`${section.name}-${question.number}`} className="space-y-3 p-4">
                                <div className="flex gap-3">
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{question.number}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3"><p className="font-medium leading-relaxed">{question.text}</p><Badge variant="secondary" className="shrink-0">{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</Badge></div>
                                        {question.options.length > 0 && <ul className="mt-2 grid gap-1 pl-1 text-sm text-foreground/80 sm:grid-cols-2">{question.options.map((option, index) => <li key={index}>{option}</li>)}</ul>}
                                        {question.internal_choice && <p className="mt-2 text-sm"><span className="font-semibold text-primary">OR</span> {question.internal_choice}</p>}
                                        {(question.answer_key || question.marking_scheme) && <div className="mt-3 space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                                            {question.answer_key && <p><span className="font-semibold">Answer:</span> {question.answer_key}</p>}
                                            {question.marking_scheme && <p><span className="font-semibold">Marking scheme:</span> {question.marking_scheme}</p>}
                                        </div>}
                                    </div>
                                </div>
                            </li>)}
                        </ol>
                    </section>)}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-xl border p-4">
                        <h3 className="mb-3 font-headline font-semibold">Blueprint</h3>
                        <div className="space-y-2 text-sm">
                            {paper.blueprint.chapter_marks.map((entry, index) => <div key={`chapter-${index}`} className="flex justify-between gap-3"><span>{entry.chapter}</span><span className="font-medium">{entry.marks} marks</span></div>)}
                            {paper.blueprint.difficulty_mix.map((entry, index) => <div key={`difficulty-${index}`} className="flex justify-between gap-3 text-muted-foreground"><span>{entry.level}</span><span>{entry.percentage}%</span></div>)}
                            {paper.blueprint.chapter_marks.length === 0 && paper.blueprint.difficulty_mix.length === 0 && <p className="text-muted-foreground">No blueprint breakdown returned.</p>}
                        </div>
                    </section>
                    <section className="rounded-xl border p-4">
                        <h3 className="mb-3 font-headline font-semibold">Previous-year sources</h3>
                        {paper.previous_year_sources.length ? <ul className="space-y-2 text-sm">{paper.previous_year_sources.map((source, index) => <li key={index}>{[source.year, source.set, source.chapter].filter(Boolean).join(' · ')}</li>)}</ul> : <p className="text-sm text-muted-foreground">No previous-year sources listed.</p>}
                    </section>
                </div>
                {paper.review_notes.length > 0 && <section role="note" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
                    <h3 className="mb-2 font-semibold">Teacher review notes</h3><ul className="list-disc space-y-1 pl-5">{paper.review_notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
                </section>}
            </CardContent>
        </Card>
    );
}

export function McpExamPaperView({ signedIn, connection, checkConnection, paper, generation, error, isLoading, generate }: {
    signedIn: boolean | null;
    connection: McpConnection;
    checkConnection: () => void;
    paper: ExamPaperResult | null;
    generation: McpGenerationInfo | null;
    error: McpError | null;
    isLoading: boolean;
    generate: (values: ExamPaperFormValues) => Promise<void>;
}) {
    const [values, setValues] = useState<ExamPaperFormValues>({
        board: 'CBSE', grade: 8, subject: 'Science', chaptersText: 'Force and Pressure', difficulty: 'medium',
        language: 'English', maxMarks: 20, durationMinutes: 45, pyqPercent: '', includeAnswerKey: true, includeMarkingScheme: true,
    });
    const set = <K extends keyof ExamPaperFormValues,>(key: K, value: ExamPaperFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void generate(values); };

    return (
        <main className="container mx-auto max-w-6xl space-y-7 px-4 py-8 sm:py-10">
            <header className="flex flex-col items-center gap-4 text-center">
                <ConnectionStatus connection={connection} onRetry={checkConnection} />
                <div className="space-y-2">
                    <p className="type-caption text-primary">MCP DEMO · EXAM PAPER</p>
                    <h1 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl">Exam Paper Generator</h1>
                    <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Create a board-pattern paper using the existing Sahayak Exam Paper capability. Your request goes through the authenticated demo API and the official MCP client.</p>
                </div>
            </header>

            {signedIn === false && <Card role="alert" data-testid="mcp-signed-out" className="border-warning/40 bg-warning/10"><CardContent className="p-4 text-sm">Sign in to Sahayak to use this demo. The demo API only serves signed-in teachers.</CardContent></Card>}

            <Card className="border-primary/15 shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Paper details</CardTitle>
                    <CardDescription>Choose the board, class, subject, chapters, and paper settings.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-6" data-testid="exam-paper-form">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2"><Label htmlFor="exam-board">Board</Label><select id="exam-board" className={fieldClass} value={values.board} onChange={(e) => set('board', e.target.value)}>{EDUCATION_BOARDS.map((board) => <option key={board} value={board}>{board}</option>)}</select></div>
                            <div className="space-y-2"><Label htmlFor="exam-grade">Grade</Label><Input id="exam-grade" type="number" min={1} max={12} step={1} value={values.grade} onChange={(e) => set('grade', Number(e.target.value))} required /></div>
                            <div className="space-y-2"><Label htmlFor="exam-subject">Subject</Label><Input id="exam-subject" value={values.subject} onChange={(e) => set('subject', e.target.value)} required /></div>
                            <div className="space-y-2 sm:col-span-2 lg:col-span-3"><Label htmlFor="exam-chapters">Chapters</Label><Input id="exam-chapters" value={values.chaptersText} onChange={(e) => set('chaptersText', e.target.value)} placeholder="Friction, Force and Pressure" /><p className="text-xs text-muted-foreground">Separate multiple chapter names with commas.</p></div>
                            <div className="space-y-2"><Label htmlFor="exam-difficulty">Difficulty</Label><select id="exam-difficulty" className={fieldClass} value={values.difficulty} onChange={(e) => set('difficulty', e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="mixed">Mixed</option></select></div>
                            <div className="space-y-2"><Label htmlFor="exam-language">Language</Label><select id="exam-language" className={fieldClass} value={values.language} onChange={(e) => set('language', e.target.value)}>{SAHAYAK_LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}</select></div>
                            <div className="space-y-2"><Label htmlFor="exam-marks">Maximum marks</Label><Input id="exam-marks" type="number" min={5} max={100} step={1} value={values.maxMarks} onChange={(e) => set('maxMarks', Number(e.target.value))} required /></div>
                            <div className="space-y-2"><Label htmlFor="exam-duration">Duration (minutes)</Label><Input id="exam-duration" type="number" min={10} max={180} step={1} value={values.durationMinutes} onChange={(e) => set('durationMinutes', Number(e.target.value))} required /></div>
                            <div className="space-y-2"><Label htmlFor="exam-pyq">Previous-year question share (%)</Label><Input id="exam-pyq" type="number" min={0} max={100} step={1} value={values.pyqPercent} onChange={(e) => set('pyqPercent', e.target.value)} placeholder="Use Sahayak default" /></div>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border/70 pt-4">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={values.includeAnswerKey} onChange={(e) => set('includeAnswerKey', e.target.checked)} />Include answer key</label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={values.includeMarkingScheme} onChange={(e) => set('includeMarkingScheme', e.target.checked)} />Include marking scheme</label>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">Generation can take up to two minutes. Review the paper and answer key before using it with students.</p>
                            <Button type="submit" disabled={isLoading || signedIn !== true} className="min-w-52 font-headline">
                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Generating paper…</> : <><FileText className="mr-2 h-4 w-4" aria-hidden />Generate Exam Paper</>}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {isLoading && <Card role="status" className="border-primary/20 bg-primary/[0.035]"><CardContent className="flex items-center gap-3 p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden /><div><p className="font-medium">Building your exam paper</p><p className="text-sm text-muted-foreground">The MCP is preparing questions and checking the marks.</p></div></CardContent></Card>}
            {error && !isLoading && <Card role="alert" data-testid="mcp-error" className="border-destructive/30"><CardContent className="flex items-start gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden /><div><p className="font-semibold">The exam paper could not be generated</p><p className="text-sm text-muted-foreground">{error.message}</p>{error.retryable && <Button className="mt-4" variant="outline" onClick={() => void generate(values)}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />Try again</Button>}</div></CardContent></Card>}
            {paper && <ExamPaperResultView paper={paper} generation={generation} />}
        </main>
    );
}
