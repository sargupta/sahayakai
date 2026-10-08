"use client";

import { BookOpen, BookText, CheckCircle2, ClipboardList, Clock, Copy, GraduationCap, Home, Info, Languages, ListTree, PlugZap, SpellCheck, TestTube2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ResultShell } from "@/components/ui/result-shell";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import type { LessonPlanResult } from "@/lib/mcp/lesson-planner/schema";
import { lessonPlanToText } from "./mapping";
import type { McpGenerationInfo } from "./use-mcp-lesson-plan";

// Same safe mini-markdown as the app's lesson-plan display: escape first, then basic emphasis.
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const renderMarkdown = (text: string | null | undefined) =>
    !text ? "" : escapeHtml(text)
        .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br/>");

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return <div className="flex items-center gap-2">{icon}{children}</div>;
}

/**
 * Renders the MCP `create_lesson_plan` result in the same visual language as
 * the app's lesson-plan result (ResultShell + accordion sections). It shows
 * only lesson content: no ids, telemetry or server internals. It has no
 * account actions (save / share), because an MCP result is not a Library item.
 */
export function McpLessonPlanDisplay({ plan, generation }: { plan: LessonPlanResult; generation: McpGenerationInfo | null }) {
    const { t } = useLanguage();
    const { toast } = useToast();

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(lessonPlanToText(plan));
            toast({ title: t("Copied to clipboard") });
        } catch {
            toast({ title: t("Could not copy"), variant: "destructive" });
        }
    };

    const meta = [
        { icon: <GraduationCap className="h-3.5 w-3.5" />, value: `${t("Class")} ${plan.grade}` },
        plan.duration && { icon: <Clock className="h-3.5 w-3.5" />, value: plan.duration },
        plan.subject && { icon: <BookOpen className="h-3.5 w-3.5" />, value: t(plan.subject) },
        { icon: <Languages className="h-3.5 w-3.5" />, value: t(plan.language) },
    ].filter(Boolean) as { icon: React.ReactNode; value: string }[];

    return (
        <ResultShell
            id="mcp-lesson-plan-result"
            title={plan.title}
            icon={<BookText />}
            meta={meta}
            actions={[{ label: t("Copy"), icon: <Copy />, onClick: copy, variant: "outline" }]}
            footer={generation ? (
                <p data-testid="mcp-generation-info" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <PlugZap className="h-3.5 w-3.5 text-primary" aria-hidden />
                    {t("Generated via Sahayak MCP")} · <code className="font-mono">{generation.tool}</code> · {generation.protocol} · {(generation.durationMs / 1000).toFixed(1)} s
                </p>
            ) : undefined}
        >
            {plan.curriculum_note && (
                <div role="note" className="mb-4 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{plan.curriculum_note}</span>
                </div>
            )}
            <Accordion type="multiple" className="w-full" defaultValue={["Objectives", "Activities"]}>
                <AccordionItem value="Objectives">
                    <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                        <SectionTitle icon={<CheckCircle2 className="h-5 w-5 text-primary" />}>{t("Learning Objectives")}</SectionTitle>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground/80 space-y-2 pl-8">
                        <ul className="list-disc space-y-2">
                            {plan.learning_objectives.map((o, i) => <li key={i}>{o}</li>)}
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                {plan.key_vocabulary.length > 0 && (
                    <AccordionItem value="Vocabulary">
                        <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                            <SectionTitle icon={<SpellCheck className="h-5 w-5 text-primary" />}>{t("Key Vocabulary")}</SectionTitle>
                        </AccordionTrigger>
                        <AccordionContent className="text-foreground/80 pl-8">
                            <dl className="space-y-2">
                                {plan.key_vocabulary.map((v, i) => (
                                    <div key={i}>
                                        <dt className="inline font-semibold text-foreground">{v.term}</dt>
                                        <dd className="inline"> — {v.meaning}</dd>
                                    </div>
                                ))}
                            </dl>
                        </AccordionContent>
                    </AccordionItem>
                )}

                <AccordionItem value="Materials">
                    <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                        <SectionTitle icon={<ListTree className="h-5 w-5 text-primary" />}>{t("Materials")}</SectionTitle>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground/80 space-y-2 pl-8">
                        <ul className="list-disc space-y-2">
                            {plan.materials.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="Activities">
                    <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                        <SectionTitle icon={<TestTube2 className="h-5 w-5 text-primary" />}>{t("Teaching Sequence (5E)")}</SectionTitle>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground/80 space-y-4 pt-4">
                        {plan.activities.map((a, i) => (
                            <div key={i} className="pl-4 border-l-2 border-primary/50 space-y-2" data-testid="mcp-activity">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">{t(a.phase)}</Badge>
                                    <h4 className="font-semibold text-foreground">
                                        <span dangerouslySetInnerHTML={{ __html: renderMarkdown(a.name) }} /> ({a.duration})
                                    </h4>
                                </div>
                                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(a.description) }} />
                                {a.teacher_tips && (
                                    <p className="text-sm"><span className="font-semibold text-foreground">{t("Teacher tip")}:</span> {a.teacher_tips}</p>
                                )}
                                {a.understanding_check && (
                                    <p className="text-sm"><span className="font-semibold text-foreground">{t("Check for understanding")}:</span> {a.understanding_check}</p>
                                )}
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>

                {plan.assessment && (
                    <AccordionItem value="Assessment">
                        <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                            <SectionTitle icon={<ClipboardList className="h-5 w-5 text-primary" />}>{t("Assessment")}</SectionTitle>
                        </AccordionTrigger>
                        <AccordionContent className="text-foreground/80 space-y-2 pt-2 pl-4">
                            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(plan.assessment) }} />
                        </AccordionContent>
                    </AccordionItem>
                )}

                {plan.homework && (
                    <AccordionItem value="Homework">
                        <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                            <SectionTitle icon={<Home className="h-5 w-5 text-primary" />}>{t("Homework")}</SectionTitle>
                        </AccordionTrigger>
                        <AccordionContent className="text-foreground/80 space-y-2 pt-2 pl-4">
                            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(plan.homework) }} />
                        </AccordionContent>
                    </AccordionItem>
                )}
            </Accordion>
        </ResultShell>
    );
}
