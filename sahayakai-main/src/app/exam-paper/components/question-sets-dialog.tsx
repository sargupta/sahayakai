/**
 * @fileOverview "Create question sets" modal — derives N anti-cheating variants
 * (Set A/B/C…) from the one generated paper and downloads them for printing. Same
 * questions in every set, only placement reshuffled within each section; each set is
 * renumbered sequentially and carries its own answer key. Pure client-side: reuses
 * `buildQuestionSets` (the seeded shuffle) + the shared exam-paper print helpers.
 */
"use client";

import { useState } from "react";
import { FileStack, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { buildQuestionSets, setLabel } from "@/lib/exam-paper-sets";
import { buildExamPaperBodyHtml, wrapExamPaperDoc, openPrintBlob } from "@/lib/exam-paper-print";
import type { GeneratedPaper } from "../types";

interface QuestionSetsDialogProps {
  paper: GeneratedPaper;
}

const SET_COUNTS = [2, 3, 4];

export function QuestionSetsDialog({ paper }: QuestionSetsDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [count, setCount] = useState(3);

  const cleanTitle = (suffix: string) => {
    const base = (paper.title || "Untitled").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "Untitled";
    return `${base}_${suffix}`;
  };

  const docTitle = paper.title || `${paper.board || ""} ${paper.subject || ""}`.trim() || t("Question Sets");

  const onPopupBlocked = () =>
    toast({
      title: t("Popup blocked"),
      description: t("Saved as HTML instead. Open the file and press Ctrl/Cmd+P to save as PDF."),
    });

  const guardEmpty = () => {
    if (!paper.sections || !paper.sections.length) {
      toast({
        title: t("Download Failed"),
        description: t("This paper has no content to export."),
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  const bodyForSet = (s: GeneratedPaper, i: number) =>
    `<div class="exam-set">${buildExamPaperBodyHtml(s, t, `${t("Set")} ${setLabel(i)}`)}</div>`;

  const downloadAll = () => {
    if (guardEmpty()) return;
    const sets = buildQuestionSets(paper, count);
    const html = wrapExamPaperDoc(docTitle, sets.map(bodyForSet).join(""));
    openPrintBlob(html, cleanTitle(`${t("Set")}_A-${setLabel(count - 1)}`), onPopupBlocked);
  };

  const downloadOne = (i: number) => {
    if (guardEmpty()) return;
    const set = buildQuestionSets(paper, count)[i];
    const html = wrapExamPaperDoc(docTitle, bodyForSet(set, i));
    openPrintBlob(html, cleanTitle(`${t("Set")}_${setLabel(i)}`), onPopupBlocked);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1">
          <FileStack className="w-4 h-4 mr-2" />
          {t("Create question sets")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Question Sets")}</DialogTitle>
          <DialogDescription>
            {t("Same questions, reshuffled placement — anti-cheating variants of this paper.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">{t("Number of sets")}</p>
            <div className="flex gap-2">
              {SET_COUNTS.map((n) => (
                <Button
                  key={n}
                  variant={count === n ? "default" : "outline"}
                  size="sm"
                  className="w-12"
                  onClick={() => setCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={downloadAll}>
            <Download className="w-4 h-4 mr-2" />
            {t("Download all (PDF)")}
          </Button>

          <div className="space-y-2 border-t border-border pt-3">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>
                  {t("Set")} {setLabel(i)}
                </span>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => downloadOne(i)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {t("Download")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
