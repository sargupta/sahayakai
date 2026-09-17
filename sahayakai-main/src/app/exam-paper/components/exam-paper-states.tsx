/**
 * @fileOverview Gate/empty states for the exam-paper page: a full-height
 * spinner while auth resolves, a "please log in" prompt for anonymous
 * visitors, and a load-failure state shown when a saved paper opened from the
 * library (`?id=`) can't be fetched. Dumb — no state, strings via useLanguage.
 */
"use client";

import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { Button } from "@/components/ui/button";

/**
 * 202 in-progress notice: the paper exceeded the request budget but is still
 * generating in the background and will land in My Library. Honest info state,
 * NOT the red error surface — a slow-but-successful run is not a failure.
 */
export function ExamPaperInProgress({ message }: { message: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] gap-4 px-4 text-center rounded-lg border border-primary/20 bg-primary/5 py-8">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link href="/my-library">{t("My Library")}</Link>
      </Button>
    </div>
  );
}

export function ExamPaperLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export function ExamPaperLoginPrompt() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <AlertCircle className="w-12 h-12 text-muted-foreground" />
      <p className="text-muted-foreground text-center">
        {t("Please log in to generate exam papers.")}
      </p>
    </div>
  );
}

/**
 * Shown in view mode (a saved paper opened via `?id=`) when the fetch fails —
 * the generate form is hidden in view mode, so this is the only surface for
 * the error plus a way back to generating a fresh paper.
 */
export function ExamPaperLoadError({ message }: { message: string }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 px-4 text-center">
      <AlertCircle className="w-12 h-12 text-destructive" />
      <p className="text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link href="/exam-paper">{t("Create a new paper")}</Link>
      </Button>
    </div>
  );
}
