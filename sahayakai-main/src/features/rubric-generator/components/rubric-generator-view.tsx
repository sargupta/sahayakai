"use client";

/**
 * RubricGeneratorView — all rubric-generator markup, zero orchestration.
 * Composes the GeneratorPage shell: (1) the assignment, with the "What is a
 * Rubric?" dialog beside its heading, (2) class/subject/language, Generate.
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
import { GeneratorPage, GeneratorSection, GeneratorSubmitBar, GENERATOR_SUBMIT_CLASS } from "@/features/generator";
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
    contentId,
    status,
    isGenerating,
    limitState,
}: RubricGeneratorViewProps) {
    const { t: translate } = useLanguage();

    const infoDialog = (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-muted-foreground hover:text-primary">
                    <Info className="h-4 w-4" aria-hidden="true" />
                    <span className="indic-text">{translate("What is a Rubric?")}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
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
    );

    return (
        <GeneratorPage
            icon={ClipboardCheck}
            title={translate("Rubric Generator")}
            description={translate("Create clear and fair grading rubrics for any assignment.")}
            feature="rubric"
            limitState={limitState}
            width="default"
            status={status}
            progressMessages={[translate("Building your rubric...")]}
            result={rubric && <RubricDisplay rubric={rubric} contentId={contentId} selectedLanguage={selectedLanguage} />}
            form={
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <GeneratorSection step={1} title={translate("Assignment Description")} aside={infoDialog}>
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="assignmentDescription"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="sr-only">{translate("Assignment Description")}</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={translate("e.g., A project to build a model of the solar system for 6th graders.")}
                                                    {...field}
                                                    className="min-h-32 rounded-field bg-muted/30 text-base leading-relaxed"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={uiLangCode} page="rubric" />
                            </div>
                        </GeneratorSection>

                        <GeneratorSection step={2} title={translate("Details")}>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="gradeLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-foreground">{translate("Class")}</FormLabel>
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
                                            <FormLabel className="text-sm font-medium text-foreground">{translate("Subject")}</FormLabel>
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
                        </GeneratorSection>

                        <GeneratorSubmitBar hint={aiUnavailableReason}>
                            <Button
                                type="submit"
                                disabled={isGenerating || isRestoring || !canUseAI}
                                aria-busy={isGenerating}
                                className={GENERATOR_SUBMIT_CLASS}
                            >
                                {isGenerating || isRestoring ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {translate("Generating Rubric...")}
                                    </>
                                ) : (
                                    translate("Generate Rubric")
                                )}
                            </Button>
                        </GeneratorSubmitBar>
                    </form>
                </Form>
            }
        />
    );
}
