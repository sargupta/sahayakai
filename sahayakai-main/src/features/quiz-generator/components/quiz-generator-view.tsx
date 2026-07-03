"use client";

/**
 * QuizGeneratorView — all quiz-generator markup, zero orchestration.
 * Composes the GeneratorPage shell; every form field, control and i18n
 * key is preserved from the pre-migration page.
 */

import { FileSignature, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";
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
import { GeneratorPage, GeneratorSubmitBar } from "@/features/generator";
import { questionTypesData } from "../types";
import { useQuizGenerator } from "../hooks/use-quiz-generator";

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
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* LEFT COLUMN: Main Content (7 cols) */}
                            <div className="lg:col-span-7 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="topic"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex flex-col gap-4">
                                                    <Textarea
                                                        placeholder={translate("e.g., The life cycle of a butterfly, using the uploaded image.")}
                                                        {...field}
                                                        className="bg-muted/20 min-h-[120px] resize-none"
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="imageDataUri"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-headline">{translate("Add Context (Optional Image)")}</FormLabel>
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

                                <FormField
                                    control={form.control}
                                    name="questionTypes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-headline">{translate("Question Types")}</FormLabel>
                                            <div className="card-section">
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-2">
                                    <FormLabel className="font-headline">{translate("Quick Ideas")}</FormLabel>
                                    <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="quiz" />
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Configuration (5 cols) */}
                            <div className="lg:col-span-5 space-y-5 bg-card p-4 sm:p-6 rounded-surface-md border border-border shadow-soft h-fit">
                                {/* Subject, Grade and Language Selection */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/30 pt-4 mt-2">
                                    <FormField
                                        control={form.control}
                                        name="subject"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Subject")}</FormLabel>
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
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Class")}</FormLabel>
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
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Language")}</FormLabel>
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
                                            <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Number of Questions")}</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-4">
                                                    <Slider
                                                        min={1}
                                                        max={20}
                                                        step={1}
                                                        value={[field.value]}
                                                        onValueChange={(vals) => field.onChange(vals[0])}
                                                        className="flex-1"
                                                    />
                                                    <span className="font-semibold text-primary bg-primary/8 px-3 py-1 rounded-lg border border-primary/15 min-w-[3rem] text-center">{field.value}</span>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="questionTypes"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Question Types")}</FormLabel>
                                            <div className="grid grid-cols-2 gap-2">
                                                {["multiple_choice", "short_answer", "fill_in_the_blanks", "true_false"].map((type) => (
                                                    <div key={type} className="flex items-center space-x-2 bg-muted/20 p-2 rounded border border-border/50">
                                                        <CheckboxUI
                                                            id={type}
                                                            checked={field.value?.includes(type as any)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    field.onChange([...(field.value || []), type]);
                                                                } else {
                                                                    field.onChange(field.value?.filter((val: string) => val !== type));
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor={type} className="text-xs text-foreground cursor-pointer">
                                                            {translate(type === "multiple_choice" ? "Multiple Choice" : type === "true_false" ? "True/False" : type === "fill_in_the_blanks" ? "Fill in the Blanks" : type === "short_answer" ? "Short Answer" : type)}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="bloomsTaxonomyLevels"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-xs font-semibold text-muted-foreground">{translate("Bloom's Taxonomy Levels")}</FormLabel>
                                            <TooltipProvider>
                                                <div className="card-section flex flex-wrap gap-2">
                                                    {["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"].map((level) => (
                                                        <Tooltip key={level}>
                                                            <TooltipTrigger asChild>
                                                                <Badge
                                                                    variant={field.value?.includes(level) ? "default" : "outline"}
                                                                    className={`cursor-pointer transition-all ${field.value?.includes(level) ? "bg-primary hover:bg-primary/90 text-white" : "bg-muted/20 hover:bg-muted/40 text-muted-foreground"}`}
                                                                    onClick={() => {
                                                                        if (field.value?.includes(level)) {
                                                                            field.onChange(field.value.filter((l: string) => l !== level));
                                                                        } else {
                                                                            field.onChange([...(field.value || []), level]);
                                                                        }
                                                                    }}
                                                                >
                                                                    {translate(level)}
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-[#1e293b] text-white border-slate-700">
                                                                <p className="text-xs">{translate(`Bloom-hint-${level}`)}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ))}
                                                </div>
                                            </TooltipProvider>

                                            {field.value && field.value.length > 0 && (
                                                <div className="mt-3 p-3 bg-muted/20 rounded-xl border border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-2 flex items-center gap-1">
                                                        <Brain className="w-3 h-3" />
                                                        {translate("Pedagogical Strategy")}
                                                    </div>
                                                    <div className="space-y-2">
                                                        {field.value.map((level: string) => (
                                                            <div key={level} className="text-[11px] leading-relaxed text-foreground flex items-start gap-2">
                                                                <div className="mt-1 w-1 h-1 rounded-full bg-primary shrink-0" />
                                                                <span>
                                                                    <span className="font-bold text-foreground">{translate(level)}:</span>{" "}
                                                                    {translate(`Bloom-hint-${level}`)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <GeneratorSubmitBar>
                                    <Button
                                        type="submit"
                                        disabled={isGenerating || isRestoring || !canUseAI}
                                        aria-busy={isGenerating}
                                        className="w-full py-5 text-base font-headline rounded-surface-md shadow-elevated transition-shadow duration-micro ease-out-quart"
                                    >
                                        {isGenerating || isRestoring ? (
                                            <>
                                                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                                {translate("Generating Quiz...")}
                                            </>
                                        ) : (
                                            translate("Generate Quiz")
                                        )}
                                    </Button>
                                </GeneratorSubmitBar>
                                {aiUnavailableReason && (
                                    <p className="text-xs text-amber-600 mt-2 text-center">{aiUnavailableReason}</p>
                                )}
                            </div>
                        </div>
                    </form>
                </Form>
            }
        />
    );
}
