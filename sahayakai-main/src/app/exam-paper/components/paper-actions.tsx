/**
 * @fileOverview Action bar under a generated paper: Save to Library (with
 * saving/saved states), the "Create question sets" (multi-set PDF) action, and the
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
      <div className="flex gap-3">
        <Button
          onClick={onSave}
          disabled={saving || saved}
          variant={saved ? "outline" : "default"}
          className="flex-1"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saved ? t("Saved to Library") : t("Save to Library")}
        </Button>
        <QuestionSetsDialog paper={paper} />
      </div>
      <ShareToCommunityCTA contentType="exam-paper" className="mt-3" />
    </>
  );
}
