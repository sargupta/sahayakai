"use client";

/**
 * RubricGeneratorView — all rubric-generator markup, zero orchestration.
 * Composes the GeneratorPage shell; the "What is a Rubric?" info dialog
 * rides in the description slot exactly as before.
 */

import { ClipboardCheck, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { RubricDisplay } from "@/components/rubric-display";
import { useLanguage } from "@/context/language-context";
import { GeneratorPage, GeneratorSubmitBar } from "@/features/generator";
import { useRubricGenerator } from "../hooks/use-rubric-generator";

type RubricGeneratorViewProps = ReturnType<typeof useRubricGenerator>;

export function RubricGeneratorView({
    form,
    onSubmit,
    selectedLanguage,
    uiLangCode,
    handlePromptClick,
    isRestoring,
    canUseAI,
    aiUnavailableReason,
    rubric,
    status,
    isGenerating,
    limitState,
}: RubricGeneratorViewProps) {
    const { t: translate } = useLanguage();

    return (
        <GeneratorPage
            icon={ClipboardCheck}
            title={translate("Rubric Generator")}
            description={
                <span className="flex items-center justify-center gap-2">
                    <span>{translate("Create clear and fair grading rubrics for any assignment.")}</span>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={translate("What is a Rubric?")}>
                                <Info className="h-5 w-5 text-accent-foreground/50" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="font-headline">{translate("What is a Rubric?")}</DialogTitle>
                                <DialogDescription>
                                    {translate("A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.")}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p><strong className="text-foreground">{translate("Why are they important?")}</strong></p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong className="text-foreground/80">{translate("Clarity:")}</strong> {translate("They demystify assignments by making expectations clear to students before they start.")}</li>
                                    <li><strong className="text-foreground/80">{translate("Consistency:")}</strong> {translate("They ensure all students are graded with the same criteria, making assessment fair and objective.")}</li>
                                    <li><strong className="text-foreground/80">{translate("Feedback:")}</strong> {translate("They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.")}</li>
                                    <li><strong className="text-foreground/80">{translate("Efficiency:")}</strong> {translate("They can make the grading process faster and more straightforward for teachers.")}</li>
                                </ul>
                            </div>
                        </DialogContent>
                    </Dialog>
                </span>
            }
            feature="rubric"
            limitState={limitState}
            width="default"
            status={status}
            progressMessages={[translate("Building your rubric...")]}
            result={rubric && <RubricDisplay rubric={rubric} selectedLanguage={selectedLanguage} />}
            form={
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="assignmentDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-headline">{translate("Assignment Description")}</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-col gap-4">
                                            <Textarea
                                                placeholder={translate("e.g., A project to build a model of the solar system for 6th graders.")}
                                                {...field}
                                                className="bg-muted/20 min-h-[120px]"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={uiLangCode} page="rubric" />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border/30 pt-4 mt-2">
                            <FormField
                                control={form.control}
                                name="gradeLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{translate("Class")}</FormLabel>
                                        <FormControl>
                                            <GradeLevelSelector
                                                value={field.value ? [field.value] : []}
                                                onValueChange={(values) => field.onChange(values?.[0])}
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
                                name="subject"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{translate("Subject")}</FormLabel>
                                        <FormControl>
                                            <SubjectSelector
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                language={selectedLanguage}
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
                                        <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{translate("Language")}</FormLabel>
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

                        <GeneratorSubmitBar>
                            <Button
                                type="submit"
                                disabled={isGenerating || isRestoring || !canUseAI}
                                aria-busy={isGenerating}
                                className="w-full py-5 text-base font-headline shadow-lg shadow-primary/20 transition-all"
                            >
                                {isGenerating || isRestoring ? (
                                    <>
                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                        {translate("Generating Rubric...")}
                                    </>
                                ) : (
                                    translate("Generate Rubric")
                                )}
                            </Button>
                        </GeneratorSubmitBar>
                        {aiUnavailableReason && (
                            <p className="text-xs text-amber-600 mt-1.5 text-center">{aiUnavailableReason}</p>
                        )}
                    </form>
                </Form>
            }
        />
    );
}
