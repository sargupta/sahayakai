"use client";

/**
 * WorksheetWizardView — all worksheet-wizard markup, zero orchestration.
 * Composes the GeneratorPage shell; every form field and the 11-language
 * chrome dict (now in ../i18n) are preserved from the pre-migration page.
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
import { GeneratorPage, GeneratorSubmitBar } from "@/features/generator";
import { useWorksheetWizard } from "../hooks/use-worksheet-wizard";

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
    status,
    isGenerating,
    limitState,
}: WorksheetWizardViewProps) {
    const { t: translate } = useLanguage();

    return (
        <GeneratorPage
            icon={PencilRuler}
            title={t.pageTitle}
            description={t.pageDescription}
            headerExtra={<UsageRemainingBadge feature="worksheet" />}
            feature="worksheet"
            limitState={limitState}
            width="narrow"
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
                    />
                )
            }
            afterResult={<ShareToCommunityCTA contentType="worksheet" className="mt-3" />}
            form={
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="imageDataUri"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-headline">{t.imageLabel}</FormLabel>
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

                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-headline">{t.instructionsLabel}</FormLabel>
                                    <FormControl>
                                        <div className="flex flex-col gap-4">
                                            <Textarea
                                                placeholder={t.placeholder}
                                                {...field}
                                                className="bg-muted/20 min-h-[120px]"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="worksheet" />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-border/30 pt-4 mt-2">
                            <FormField
                                control={form.control}
                                name="gradeLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.gradeLabel}</FormLabel>
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
                                        <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.languageLabel}</FormLabel>
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
                                        {t.generating}
                                    </>
                                ) : (
                                    t.submitButton
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
