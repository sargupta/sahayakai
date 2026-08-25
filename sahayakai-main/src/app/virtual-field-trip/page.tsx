
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Globe2 } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { MicrophoneInput } from "@/components/microphone-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { useLanguage } from "@/context/language-context";
import { VirtualFieldTripDisplay } from "@/components/virtual-field-trip-display";
import { SubjectSelector } from "@/components/subject-selector";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useVirtualFieldTrip } from "@/features/virtual-field-trip";

function VirtualFieldTripContent() {
  const { t: translate } = useLanguage();
  const {
    form,
    onSubmit,
    t,
    uiLangCode,
    selectedLanguage,
    handlePromptClick,
    trip,
    isGenerating,
    isRestoring,
    limitState,
    stillGenerating,
    canUseAI,
    aiUnavailableReason,
  } = useVirtualFieldTrip();

  const isLoading = isGenerating || isRestoring;
  const showLimitPrompt = limitState.limitReached || limitState.upgradeRequired;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="w-full bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="card-accent-bar" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Globe2 className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline tracking-tight text-2xl sm:text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription>
            {t.pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showLimitPrompt && (
            <UpgradePrompt
              feature="virtual-field-trip"
              used={limitState.used ?? 0}
              limit={limitState.limit ?? 0}
            />
          )}
          {limitState.serviceBusy && limitState.message && (
            <p className="text-xs text-amber-600 text-center" role="status">{limitState.message}</p>
          )}
          {/* A 202 means the trip is still being written, not that it failed.
              The teacher needs somewhere to go, so the notice stays on screen
              with the link — a toast would be gone before they read it. */}
          {stillGenerating && (
            <div
              role="status"
              className="rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-200"
            >
              <span>{stillGenerating}</span>{" "}
              <Link href="/my-library" className="font-medium underline underline-offset-2">
                {translate("Open My Library")}
              </Link>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.topicLabel}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t.placeholder}
                        {...field}
                        className="bg-muted/20 min-h-[120px]"
                      />
                    </FormControl>
                    <MicrophoneInput
                      onTranscriptChange={(text, lang) => { form.setValue("topic", text); if (lang) form.setValue("language", lang); }}
                      label={t.speakLabel}
                      iconSize="sm"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-3 bg-accent/20 rounded-lg">
                <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={uiLangCode} page="virtual-field-trip" />
              </div>

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
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.subjectLabel || "Subject"}</FormLabel>
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

              <Button type="submit" disabled={isLoading || !canUseAI} className="w-full text-lg py-6 shadow-lg shadow-primary/20 transition-all">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.generating}
                  </>
                ) : (
                  t.submitButton
                )}
              </Button>
              {aiUnavailableReason && (
                <p className="text-xs text-amber-600 mt-1.5 text-center">{aiUnavailableReason}</p>
              )}
            </form>
          </Form>
        </CardContent>
      </div>

      {
        isLoading && (
          <Card className="mt-8 w-full max-w-2xl bg-card border border-border shadow-soft rounded-2xl animate-fade-in-up">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">{t.planningText}</p>
            </CardContent>
          </Card>
        )
      }

      {
        trip && (
          <>
          <div className="my-8 flex items-center gap-3">
            <hr className="flex-1 border-border/40" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">{translate("Result")}</span>
            <hr className="flex-1 border-border/40" />
          </div>
          <div className="rounded-xl border border-border/60 border-l-4 border-l-primary/70 bg-primary/5 p-4"><VirtualFieldTripDisplay
            trip={trip}
            topic={form.getValues('topic')}
            gradeLevel={form.getValues('gradeLevel')}
            language={form.getValues('language')}
          /></div>
          </>
        )
      }
    </div>
  );
}

export default function VirtualFieldTripPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <VirtualFieldTripContent />
    </Suspense>
  );
}
