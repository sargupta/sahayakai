
"use client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Globe2, MapPin, Compass } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { useLanguage } from "@/context/language-context";
import { VirtualFieldTripDisplay } from "@/components/virtual-field-trip-display";
import { SubjectSelector } from "@/components/subject-selector";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useVirtualFieldTrip } from "@/features/virtual-field-trip";

/**
 * Decorative journey line for the hero: a dotted route that winds past three
 * map pins. Pure SVG in currentColor (token colours come from the parent's
 * text-* classes), aria-hidden, no motion — calm, not busy.
 */
function JourneyArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 120"
      className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[55%] text-primary sm:block"
      preserveAspectRatio="xMaxYMid meet"
    >
      <path
        d="M10 96 C 60 96, 70 40, 120 44 S 190 100, 236 70 S 290 22, 312 30"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2.5"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {[
        [120, 44],
        [236, 70],
        [312, 30],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="11" fill="currentColor" fillOpacity="0.12" />
          <circle r="5" fill="currentColor" fillOpacity={i === 2 ? 0.9 : 0.55} />
        </g>
      ))}
      <circle cx="10" cy="96" r="4" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

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
    contentId,
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
    <div className="flex w-full max-w-3xl flex-col items-center gap-6">
      {/* Hero: where the teacher is going. */}
      <section className="relative w-full overflow-hidden rounded-surface-lg border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card px-6 py-8 shadow-soft sm:px-8">
        <JourneyArt />
        <div className="relative max-w-md space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated">
            <Globe2 className="h-7 w-7" />
          </div>
          <h1 className="font-headline text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t.pageTitle}
          </h1>
          <p className="text-base text-muted-foreground">{t.pageDescription}</p>
        </div>
      </section>

      {/* Planner */}
      <div className="w-full overflow-hidden rounded-surface-lg border border-border bg-card shadow-soft">
        <div className="card-accent-bar" />
        <div className="space-y-6 p-6 sm:p-8">
          {showLimitPrompt && (
            <UpgradePrompt
              feature="virtual-field-trip"
              used={limitState.used ?? 0}
              limit={limitState.limit ?? 0}
            />
          )}
          {limitState.serviceBusy && limitState.message && (
            <p className="text-center text-xs text-warning" role="status">{limitState.message}</p>
          )}
          {/* A 202 means the trip is still being written, not that it failed.
              The teacher needs somewhere to go, so the notice stays on screen
              with the link — a toast would be gone before they read it. */}
          {stillGenerating && (
            <div
              role="status"
              className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
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
                    <FormLabel className="flex items-center gap-2 font-headline text-base">
                      <MapPin className="h-4 w-4 text-primary" />
                      {t.topicLabel}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t.placeholder}
                        {...field}
                        className="min-h-[120px] rounded-xl bg-muted/20 text-base"
                      />
                    </FormControl>
                    {/* No mic here: VIDYA (the floating orb) already takes the trip idea by voice. */}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={uiLangCode} page="virtual-field-trip" />
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-6 md:grid-cols-3">
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
                      <FormLabel className="font-headline text-xs font-semibold text-muted-foreground">{t.subjectLabel || translate("Subject")}</FormLabel>
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

              <Button
                type="submit"
                disabled={isLoading || !canUseAI}
                className="h-14 w-full rounded-xl text-lg font-semibold shadow-elevated transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.generating}
                  </>
                ) : (
                  <>
                    <Compass className="mr-2 h-5 w-5" />
                    {t.submitButton}
                  </>
                )}
              </Button>
              {aiUnavailableReason && (
                <p className="mt-2 text-center text-xs text-warning">{aiUnavailableReason}</p>
              )}
            </form>
          </Form>
        </div>
      </div>

      {/* Planning: a route that fills in stop by stop. */}
      {isLoading && (
        <div
          role="status"
          className="w-full animate-fade-in-up rounded-surface-lg border border-border bg-card p-8 shadow-soft"
        >
          <div className="mx-auto flex max-w-xs items-center justify-between" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-1 items-center last:flex-none">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary animate-pulse"
                  style={{ animationDelay: `${i * 300}ms` }}
                >
                  <MapPin className="h-4 w-4" />
                </span>
                {i < 3 && <span className="mx-1 h-0 flex-1 border-t-2 border-dashed border-primary/30" />}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">{t.planningText}</p>
        </div>
      )}

      {trip && (
        <div className="w-full">
          <div className="mb-6 flex items-center gap-3">
            <hr className="flex-1 border-border/40" />
            <span className="px-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{translate("Result")}</span>
            <hr className="flex-1 border-border/40" />
          </div>
          <VirtualFieldTripDisplay
            trip={trip}
            topic={form.getValues('topic')}
            gradeLevel={form.getValues('gradeLevel')}
            language={form.getValues('language')}
            contentId={contentId}
          />
        </div>
      )}
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
