"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/layout";
import { LessonPlanHeader } from "@/components/lesson-plan/lesson-plan-header";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { ResourceSelector } from "@/components/resource-selector";
import { DifficultySelector } from "@/components/difficulty-selector";
import { NCERTChapterSelector } from "@/components/ncert-chapter-selector";
import { LessonPlanLoadingOverlay } from "@/components/skeletons";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";
import { MCP_LANGUAGES } from "./mapping";
import { McpLessonPlanDisplay } from "./mcp-lesson-plan-display";
import { McpStatusBadge } from "./mcp-status-badge";
import type { useMcpLessonPlan } from "./use-mcp-lesson-plan";

type Props = ReturnType<typeof useMcpLessonPlan>;

/**
 * /mcp-demo/lesson-planner — the app's Lesson Planner layout (same card,
 * header, two-column form, sidebar, selectors, button, loading overlay and
 * result treatment), but every generation goes through the Sahayak MCP
 * server. Only inputs the public MCP schema supports are offered.
 */
export function McpLessonPlannerView({
    form, onSubmit, retry, cancel, isLoading, lessonPlan, generation, error, connection, checkConnection,
    resourceLevel, setResourceLevel, difficultyLevel, setDifficultyLevel, useLocalContext, setUseLocalContext,
    setSelectedChapter, currentGrade,
}: Props) {
    const { t, language } = useLanguage();
    const uiLang = LANGUAGE_TO_ISO[language] ?? "en";
    const [showAdvanced, setShowAdvanced] = useState(false);

    return (
        <div className="container-wide py-8 md:py-12 space-y-8">
            <SectionCard className="overflow-hidden p-0 md:p-0 space-y-0">
                <div className="card-accent-bar" />
                <LessonPlanHeader
                    title={t("Lesson Plan")}
                    description={t("Create a lesson plan with Sahayak, delivered through the Sahayak MCP server.")}
                />
                <div className="flex justify-center -mt-3 mb-2 px-4">
                    <McpStatusBadge connection={connection} onRetry={checkConnection} />
                </div>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-label={t("MCP lesson plan form")}>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* LEFT COLUMN: topic */}
                                <div className="lg:col-span-7 space-y-4 min-w-0">
                                    <FormField
                                        control={form.control}
                                        name="topic"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-headline">{t("Topic")}</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        {...field}
                                                        className="bg-card min-h-[140px] text-base border-border shadow-soft focus:border-primary focus:ring-primary/10 rounded-lg placeholder:text-muted-foreground font-normal p-4 resize-none"
                                                        placeholder={t("Enter a topic (e.g., Photosynthesis, Newton's Laws)")}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* RIGHT COLUMN: settings (same sidebar treatment as the app page) */}
                                <div className="lg:col-span-5 shrink-0 pt-4 lg:pt-0">
                                    <div className="bg-card p-4 sm:p-6 rounded-surface-lg border border-border shadow-soft h-fit">
                                        <h3 className="font-headline text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            {t("Lesson Plan Settings")}
                                        </h3>

                                        <div className="grid grid-cols-2 gap-3 pt-4 mt-2">
                                            <FormField
                                                control={form.control}
                                                name="gradeLevels"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-headline">{t("Class")}</FormLabel>
                                                        <FormControl>
                                                            {/* Radix Select emits "" when its hidden native select syncs inside a form; ignore it so a chosen/prefilled class is never wiped. */}
                                                            <GradeLevelSelector value={field.value || []} onValueChange={(v) => { if (v[0]) field.onChange(v); }} isMulti={false} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="subject"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-headline">{t("Subject")}</FormLabel>
                                                        <FormControl>
                                                            <SubjectSelector value={field.value} onValueChange={(v) => { if (v) field.onChange(v); }} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="mt-4">
                                            <FormField
                                                control={form.control}
                                                name="language"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-headline">{t("Language")}</FormLabel>
                                                        <Select value={field.value} onValueChange={(v) => { if (v) field.onChange(v); }}>
                                                            <FormControl>
                                                                <SelectTrigger aria-label={t("Language")}>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {MCP_LANGUAGES.map((l) => (
                                                                    <SelectItem key={l} value={l}>{t(l)}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="h-px bg-border my-4" />

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="w-full justify-between border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                                        >
                                            <span className="flex items-center gap-2 text-sm">
                                                <Settings2 className="h-4 w-4" />
                                                {showAdvanced ? t("Hide Advanced Options") : t("Show Advanced Options")}
                                            </span>
                                            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>

                                        {showAdvanced && (
                                            <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-1">
                                                    <FormLabel className="font-headline">{t("Resources Available")}</FormLabel>
                                                    <ResourceSelector value={resourceLevel} onValueChange={setResourceLevel} />
                                                </div>
                                                <div className="space-y-1">
                                                    <FormLabel className="font-headline">{t("Difficulty Level")}</FormLabel>
                                                    <DifficultySelector value={difficultyLevel} onValueChange={setDifficultyLevel} />
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <FormLabel htmlFor="mcp-local-context" className="font-headline">{t("Use local Indian examples")}</FormLabel>
                                                    <Switch id="mcp-local-context" checked={useLocalContext} onCheckedChange={setUseLocalContext} />
                                                </div>
                                                <div className="space-y-1 pt-2 border-t border-border">
                                                    <FormLabel className="text-xs font-medium text-muted-foreground">{t("Link NCERT Chapter (Optional)")}</FormLabel>
                                                    {currentGrade ? (
                                                        <NCERTChapterSelector selectedGrade={currentGrade} onChapterSelect={(chapter) => setSelectedChapter(chapter)} />
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground py-2">{t("Select a class above to link an NCERT chapter.")}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-6 pt-2">
                                            <Button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full text-lg py-6 bg-primary hover:bg-primary/90 text-white shadow-elevated transition-shadow duration-micro ease-out-quart font-headline rounded-surface-md"
                                            >
                                                {isLoading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                                        {t("Generating Lesson Plan...")}
                                                    </>
                                                ) : (
                                                    t("Generate Lesson Plan")
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </SectionCard>

            {isLoading && !lessonPlan && (
                <LessonPlanLoadingOverlay language={uiLang} onCancel={cancel} />
            )}

            {error && !isLoading && (
                <div role="alert" data-testid="mcp-error">
                <SectionCard className="border-l-4 border-l-destructive/70">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" aria-hidden />
                        <div className="flex-1 min-w-0">
                            <p className="font-headline font-semibold text-foreground">{t("The lesson plan could not be generated")}</p>
                            <p className="text-sm text-muted-foreground">{error.message}</p>
                        </div>
                        {error.retryable && (
                            <Button type="button" variant="outline" onClick={retry}>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                {t("Try again")}
                            </Button>
                        )}
                    </div>
                </SectionCard>
                </div>
            )}

            {lessonPlan && (
                <>
                    <div className="flex items-center gap-3">
                        <hr className="flex-1 border-border/40" />
                        <span className="type-caption text-muted-foreground px-2">{t("Result")}</span>
                        <hr className="flex-1 border-border/40" />
                    </div>
                    <SectionCard
                        tone="muted"
                        className="rounded-surface-md border-l-4 border-l-primary/70 bg-primary/5 animate-in fade-in slide-in-from-bottom-8 duration-medium indic-text"
                    >
                        <McpLessonPlanDisplay plan={lessonPlan} generation={generation} />
                    </SectionCard>
                </>
            )}
        </div>
    );
}
