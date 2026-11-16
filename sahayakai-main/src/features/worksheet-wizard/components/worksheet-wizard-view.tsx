"use client";

/**
 * WorksheetWizardView — all worksheet-wizard markup, zero orchestration.
 * A worksheet studio on the GeneratorPage shell: the three steps — (1) the
 * textbook page, (2) what to make from it, (3) class/subject/language — on the
 * left, and "Your sheet" (WorksheetSheetPreview) on the right, the top of the
 * printed sheet drawn live from the form. Keeps every form field and the
 * 11-language chrome dict (../i18n) from the pre-migration page.
 */

import { Loader2, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { ImageUploader } from "@/components/image-uploader";
import { SubjectSelector } from "@/components/subject-selector";
import { WorksheetDisplay } from "@/components/worksheet-display";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { UsageRemainingBadge } from "@/components/usage-remaining-badge";
import { useLanguage } from "@/context/language-context";
import { GeneratorPage, GeneratorSection, GeneratorSubmitBar, GENERATOR_SUBMIT_CLASS } from "@/features/generator";
import { LANGUAGES, LANGUAGE_TO_ISO } from "@/types";
import { useWorksheetWizard } from "../hooks/use-worksheet-wizard";
import { WorksheetSheetPreview } from "./worksheet-sheet-preview";

type WorksheetWizardViewProps = ReturnType<typeof useWorksheetWizard>;

export function WorksheetWizardView({
    form,
    onSubmit,
    t,
    selectedLanguage,
    handlePromptClick,
    isRestoring,
    canUseAI,
    aiUnavailableReason,
    worksheet,
    contentId,
    status,
    isGenerating,
    limitState,
}: WorksheetWizardViewProps) {
    const { t: translate } = useLanguage();
    const [watchedPrompt, watchedGrade, watchedSubject, watchedLanguage, watchedImage] = form.watch([
        "prompt",
        "gradeLevel",
        "subject",
        "language",
        "imageDataUri",
    ]);
    const languageName = LANGUAGES.find((l) => LANGUAGE_TO_ISO[l] === watchedLanguage);

    return (
        <GeneratorPage
            icon={PencilRuler}
            title={t.pageTitle}
            description={t.pageDescription}
            headerExtra={<UsageRemainingBadge feature="worksheet" />}
            feature="worksheet"
            limitState={limitState}
            width="wide"
            status={status}
            progressMessages={[t.wizardMagic]}
            result={
                worksheet && (
                    <WorksheetDisplay
                        worksheet={{
                            worksheetContent: worksheet,
                            gradeLevel: form.getValues("gradeLevel"),
                            subject: form.getValues("subject") || "General",
                        }}
                        title={form.getValues("prompt") || t.resultTitle}
                        selectedLanguage={selectedLanguage}
                        contentId={contentId}
                    />
                )
            }
            afterResult={<ShareToCommunityCTA contentType="worksheet" className="mt-3" />}
            form={
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
                        <div className="min-w-0 space-y-6 xl:col-span-8">
                        <GeneratorSection step={1} title={t.imageLabel}>
                            <FormField
                                control={form.control}
                                name="imageDataUri"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="sr-only">{t.imageLabel}</FormLabel>
                                        <FormControl>
                                            <ImageUploader
                                                onImageUpload={(dataUri) => {
                                                    field.onChange(dataUri);
                                                    form.trigger("imageDataUri");
                                                }}
                                                language={selectedLanguage}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </GeneratorSection>

                        <GeneratorSection step={2} title={t.instructionsLabel}>
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="prompt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="sr-only">{t.instructionsLabel}</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={t.placeholder}
                                                    {...field}
                                                    className="min-h-32 rounded-field bg-muted/30 text-base leading-relaxed"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="worksheet" />
                            </div>
                        </GeneratorSection>

                        <GeneratorSection step={3} title={translate("Details")}>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="gradeLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-foreground">{t.gradeLabel}</FormLabel>
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
                                    name="language"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-foreground">{t.languageLabel}</FormLabel>
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
                        </div>

                        <WorksheetSheetPreview
                            prompt={watchedPrompt}
                            gradeLevel={watchedGrade}
                            subject={watchedSubject}
                            languageLabel={languageName ? translate(languageName) : undefined}
                            imageDataUri={watchedImage}
                            className="xl:sticky xl:top-24 xl:col-span-4 xl:self-start"
                        />
                        </div>

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
                                        {t.generating}
                                    </>
                                ) : (
                                    t.submitButton
                                )}
                            </Button>
                        </GeneratorSubmitBar>
                    </form>
                </Form>
            }
        />
    );
}
