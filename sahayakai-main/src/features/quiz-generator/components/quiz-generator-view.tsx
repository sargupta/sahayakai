"use client";

/**
 * QuizGeneratorView — all quiz-generator markup, zero orchestration.
 * Composes the GeneratorPage shell: the topic, optional image and question
 * types on the left; a sticky Settings panel (subject/class/language, count,
 * Bloom's levels, Generate) on the right on wide screens. Every form field,
 * control and i18n key is preserved from the pre-migration page.
 */

import { FileSignature, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { ImageUploader } from "@/components/image-uploader";
import { SubjectSelector } from "@/components/subject-selector";
import { QuizDisplay } from "@/components/quiz-display";
import { SelectableCard } from "@/components/selectable-card";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { UsageRemainingBadge } from "@/components/usage-remaining-badge";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { GeneratorPage, GeneratorSection, GeneratorSubmitBar, GENERATOR_SUBMIT_CLASS } from "@/features/generator";
import { questionTypesData } from "../types";
import { useQuizGenerator } from "../hooks/use-quiz-generator";


// Bloom's taxonomy level hints. Keys are English sentences (the app i18n
// convention; translations in src/locales/*.json). Previously translated
// `Bloom-hint-${level}` — keys in no locale, so the raw key leaked to the UI.
const BLOOM_HINTS: Record<string, string> = {
    Remember: "Recall facts, terms, and basic concepts.",
    Understand: "Explain ideas or concepts in their own words.",
    Apply: "Use knowledge to solve problems in new situations.",
    Analyze: "Break information into parts and find connections.",
    Evaluate: "Justify a decision or judge the value of ideas.",
    Create: "Combine ideas to produce original work or solutions.",
};
const BLOOM_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;

type QuizGeneratorViewProps = ReturnType<typeof useQuizGenerator>;

export function QuizGeneratorView({
    form,
    onSubmit,
    selectedLanguage,
    handlePromptClick,
    isRestoring,
    canUseAI,
    aiUnavailableReason,
    quiz,
    status,
    isGenerating,
    limitState,
}: QuizGeneratorViewProps) {
    const { t: translate } = useLanguage();

    return (
        <GeneratorPage
            icon={FileSignature}
            title={translate("Quiz Generator")}
            description={translate("Create a quiz on any topic, with various question types.")}
            headerExtra={<UsageRemainingBadge feature="quiz" />}
            feature="quiz"
            limitState={limitState}
            width="wide"
            status={status}
            progressMessages={[translate("Generating Quiz...")]}
            result={
                quiz && (
                    <QuizDisplay
                        quiz={quiz as any}
                        onRegenerate={() => form.handleSubmit(onSubmit)()}
                        selectedLanguage={selectedLanguage}
                    />
                )
            }
            afterResult={<ShareToCommunityCTA contentType="quiz" />}
            form={
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
                            {/* ── What the quiz is about ─────────────────────── */}
                            <div className="space-y-6 xl:col-span-7">
                                <GeneratorSection step={1} title={translate("Topic")}>
                                    <div className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="topic"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="sr-only">{translate("Topic")}</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder={translate("e.g., The life cycle of a butterfly, using the uploaded image.")}
                                                            {...field}
                                                            className="min-h-32 resize-none rounded-field bg-muted/30 text-base leading-relaxed"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground indic-text">{translate("Quick Ideas")}</p>
                                            <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="quiz" />
                                        </div>
                                    </div>
                                </GeneratorSection>

                                <GeneratorSection step={2} title={translate("Add Context (Optional Image)")}>
                                    <FormField
                                        control={form.control}
                                        name="imageDataUri"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="sr-only">{translate("Add Context (Optional Image)")}</FormLabel>
                                                <FormControl>
                                                    <ImageUploader
                                                        onImageUpload={(dataUri) => field.onChange(dataUri)}
                                                        language={selectedLanguage}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </GeneratorSection>

                                <GeneratorSection step={3} title={translate("Question Types")}>
                                    <FormField
                                        control={form.control}
                                        name="questionTypes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="sr-only">{translate("Question Types")}</FormLabel>
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                    {questionTypesData.map((item) => (
                                                        <SelectableCard
                                                            key={item.id}
                                                            icon={item.icon}
                                                            label={translate(item.labelKey)}
                                                            isSelected={field.value?.includes(item.id)}
                                                            onSelect={() => {
                                                                const currentValues = field.value || [];
                                                                const newValues = currentValues.includes(item.id)
                                                                    ? currentValues.filter((v) => v !== item.id)
                                                                    : [...currentValues, item.id];
                                                                field.onChange(newValues);
                                                            }}
                                                            className="h-20"
                                                        />
                                                    ))}
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </GeneratorSection>
                            </div>

                            {/* ── Settings panel ─────────────────────────────── */}
                            <aside className="h-fit space-y-6 rounded-panel border border-border bg-muted/30 p-4 sm:p-6 xl:sticky xl:top-24 xl:col-span-5">
                                <h2 className="font-headline text-lg font-semibold text-foreground indic-text">{translate("Settings")}</h2>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="subject"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm font-medium text-foreground">{translate("Subject")}</FormLabel>
                                                <FormControl>
                                                    <SubjectSelector
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        language={selectedLanguage}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="gradeLevel"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-sm font-medium text-foreground">{translate("Class")}</FormLabel>
                                                <FormControl>
                                                    <GradeLevelSelector
                                                        value={field.value ? [field.value] : []}
                                                        onValueChange={(val) => field.onChange(val[0] || undefined)}
                                                        language={selectedLanguage}
                                                        isMulti={false}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="language"
                                        render={({ field }) => (
                                            <FormItem className="xl:col-span-2">
                                                <FormLabel className="text-sm font-medium text-foreground">{translate("Language")}</FormLabel>
                                                <FormControl>
                                                    <LanguageSelector
                                                        onValueChange={field.onChange}
                                                        value={field.value}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="numQuestions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-foreground">{translate("Number of Questions")}</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-4">
                                                    <Slider
                                                        min={1}
                                                        max={20}
                                                        step={1}
                                                        value={[field.value]}
                                                        onValueChange={(vals) => field.onChange(vals[0])}
                                                        className="flex-1"
                                                        aria-label={translate("Number of Questions")}
                                                    />
                                                    <span className="min-w-12 rounded-row border border-primary/20 bg-card px-3 py-1 text-center font-semibold tabular-nums text-saffron-700">{field.value}</span>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="bloomsTaxonomyLevels"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-sm font-medium text-foreground">{translate("Bloom's Taxonomy Levels")}</FormLabel>
                                            <TooltipProvider>
                                                <div className="flex flex-wrap gap-2" role="group" aria-label={translate("Bloom's Taxonomy Levels")}>
                                                    {BLOOM_LEVELS.map((level) => {
                                                        const selected = !!field.value?.includes(level);
                                                        return (
                                                            <Tooltip key={level}>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        type="button"
                                                                        aria-pressed={selected}
                                                                        onClick={() => field.onChange(
                                                                            selected
                                                                                ? (field.value ?? []).filter((l: string) => l !== level)
                                                                                : [...(field.value || []), level],
                                                                        )}
                                                                        className={cn(
                                                                            "focus-ring rounded-pill border px-3 py-1 text-sm font-medium transition-colors duration-micro ease-out-quart indic-text",
                                                                            selected
                                                                                ? "border-saffron-600 bg-saffron-600 text-white hover:bg-saffron-700"
                                                                                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                                                                        )}
                                                                    >
                                                                        {translate(level)}
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-popover text-popover-foreground border-border">
                                                                    <p className="text-xs">{translate(BLOOM_HINTS[level] ?? level)}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </div>
                                            </TooltipProvider>

                                            {field.value && field.value.length > 0 && (
                                                <div className="rounded-row border border-border bg-card p-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="type-eyebrow mb-2 flex items-center gap-1 text-saffron-700 indic-text">
                                                        <Brain className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {translate("Pedagogical Strategy")}
                                                    </div>
                                                    <ul className="space-y-2">
                                                        {field.value.map((level: string) => (
                                                            <li key={level} className="flex items-start gap-2 text-sm leading-relaxed text-foreground indic-text">
                                                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                                                                <span>
                                                                    <span className="font-semibold">{translate(level)}:</span>{" "}
                                                                    <span className="text-muted-foreground">{translate(BLOOM_HINTS[level] ?? level)}</span>
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <GeneratorSubmitBar hint={aiUnavailableReason} className="md:block md:border-t-0 md:pt-0">
                                    <Button
                                        type="submit"
                                        disabled={isGenerating || isRestoring || !canUseAI}
                                        aria-busy={isGenerating}
                                        className={cn(GENERATOR_SUBMIT_CLASS, "md:w-full md:min-w-0")}
                                    >
                                        {isGenerating || isRestoring ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                {translate("Generating Quiz...")}
                                            </>
                                        ) : (
                                            translate("Generate Quiz")
                                        )}
                                    </Button>
                                </GeneratorSubmitBar>
                            </aside>
                        </div>
                    </form>
                </Form>
            }
        />
    );
}
