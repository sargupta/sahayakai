/**
 * @fileOverview Save to Library (with saving/saved states) and the "Create
 * question sets" (multi-set PDF) action, for the paper toolbar; plus the
 * share-to-community CTA. Dumb — save handler + state + paper passed in.
 */
"use client";

import { Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { ShareToCommunityCTA } from "@/components/share-to-community-cta";
import { QuestionSetsDialog } from "./question-sets-dialog";
import type { GeneratedPaper } from "../types";

interface PaperActionsProps {
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  paper: GeneratedPaper;
}

export function PaperActions({ saving, saved, onSave, paper }: PaperActionsProps) {
  const { t } = useLanguage();
  return (
    <>
      <QuestionSetsDialog paper={paper} />
      <Button onClick={onSave} disabled={saving || saved} variant={saved ? "outline" : "secondary"} size="sm" className="gap-2">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : saved ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        ) : (
          <Save className="h-4 w-4" aria-hidden="true" />
        )}
        {saved ? t("Saved to Library") : t("Save to Library")}
      </Button>
    </>
  );
}

/** The community CTA sits under the outline, away from the paper's own actions. */
export function PaperShareCta() {
  return <ShareToCommunityCTA contentType="exam-paper" />;
}
