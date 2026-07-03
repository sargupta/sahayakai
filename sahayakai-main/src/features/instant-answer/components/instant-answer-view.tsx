"use client";

/**
 * InstantAnswerView — all instant-answer markup, zero orchestration.
 * Composes the GeneratorPage shell; the answer card (Save button,
 * markdown body, YouTube suggestion) is preserved from the
 * pre-migration page.
 */

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Loader2, Save, Wand2, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { useLanguage } from "@/context/language-context";
import { GeneratorPage, GeneratorSubmitBar } from "@/features/generator";
import { useInstantAnswer } from "../hooks/use-instant-answer";

type InstantAnswerViewProps = ReturnType<typeof useInstantAnswer>;

export function InstantAnswerView({
    form,
    onSubmit,
    t,
    selectedLanguage,
    handlePromptClick,
    handleSave,
    isSaving,
    savedToLib,
    isRestoring,
    canUseAI,
    aiUnavailableReason,
    answer,
    status,
    isGenerating,
    limitState,
}: InstantAnswerViewProps) {
    const { t: translate } = useLanguage();

    return (
        <GeneratorPage
            icon={Wand2}
            title={t.pageTitle}
            description={t.pageDescription}
            feature="instant-answer"
            limitState={limitState}
            width="narrow"
            status={status}
            progressMessages={[t.searchingText]}
            result={
                answer && (
                    <div>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="font-headline text-2xl">{t.answerTitle}</CardTitle>
                                    <CardDescription className="italic">For the question: "{answer.question}"</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={isSaving || savedToLib}
                                >
                                    {isSaving ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    {savedToLib ? translate("Saved to Library") : t.saveButton}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="prose prose-lg prose-headings:font-headline max-w-none text-foreground">
                                <ReactMarkdown>{answer.answer}</ReactMarkdown>
                            </div>

                            {answer.videoSuggestionUrl && (
                                <div className="border-t border-primary/20 pt-4">
                                    <h3 className="font-headline text-lg mb-2">{t.videoTitle}</h3>
                                    <Link
                                        href={answer.videoSuggestionUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                                    >
                                        <Youtube className="h-10 w-10 text-red-600" />
                                        <div className="flex-1">
                                            <p className="font-semibold">{t.videoButton}</p>
                                            <p className="text-xs text-muted-foreground truncate">{answer.videoSuggestionUrl}</p>
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                        <ShareToCommunityCTA contentType="instant-answer" className="mt-3" />
                    </div>
                )
            }
            form={
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="question"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-headline">{t.questionLabel}</FormLabel>
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

                        <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="instant-answer" />

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
                                        {t.loadingText}
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
