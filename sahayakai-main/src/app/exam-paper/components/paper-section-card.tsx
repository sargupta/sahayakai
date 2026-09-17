/**
 * @fileOverview Renders a single generated section (heading, marks badge,
 * instructions) and its questions with options. Questions are always read-only;
 * clicking Edit (in the parent) reveals a per-question Regenerate button that
 * re-generates that question via the LLM. Marks are never editable (the
 * sum===maxMarks invariant stays intact). Dumb — receives one section + the
 * regenerate callback.
 */
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import type { GeneratedSection } from "../types";

interface PaperSectionCardProps {
  section: GeneratedSection;
  sectionIndex: number;
  isEditing?: boolean;
  /** Regenerate one question via the LLM (edit mode only). */
  onRegenerateQuestion?: (si: number, qi: number) => void;
  /** `"si-qi"` of the question mid-regeneration, or null. */
  regeneratingKey?: string | null;
}

// Options sometimes arrive already labelled by the model ("a) …", "(a) …",
// "a. …"). Strip any leading label so the canonical "(x)" prepended below
// doesn't double up (e.g. "(a) a) x^3 y^3"). Mirrors the flow's
// stampObjectiveKeys strip regex (exam-paper-generator.ts).
function stripOptionLabel(opt: string): string {
  // Strip ONE OR MORE repeated leading labels — "(a) ", "a) ", "a. ", and the
  // doubled "a) a) …" case seen in some generated papers.
  return opt.replace(/^(?:\s*(?:\([a-dA-D]\)|[a-dA-D][.)]))+\s*/, "");
}

export function PaperSectionCard({
  section,
  sectionIndex,
  isEditing = false,
  onRegenerateQuestion,
  regeneratingKey,
}: PaperSectionCardProps) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>
            {section.name}
            {section.label && (
              <span className="font-normal text-muted-foreground">
                {" "}
                — {section.label}
              </span>
            )}
          </span>
          <Badge variant="outline" className="text-xs">
            {section.totalMarks} {t("marks")}
          </Badge>
        </CardTitle>
        {section.instructions && (
          <p className="text-xs text-muted-foreground">
            {section.instructions}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {section.questions?.map((q, qi) => {
          const number = q.number ?? q.questionNumber;
          const hasOptions = !!(q.options && q.options.length > 0);
          return (
            <div
              key={qi}
              className="text-sm border-b border-border last:border-0 pb-3 last:pb-0"
            >
              <div className="flex justify-between items-start gap-2">
                <p>
                  <span className="font-medium">Q{number}.</span> {q.text}
                </p>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  {/* Source tag: PYQ attribution (model data, e.g. "PYQ 2024 Set 1") or "New". */}
                  {(() => {
                    const isPyq = /^pyq/i.test(q.source ?? "");
                    return (
                      <Badge
                        variant={isPyq ? "secondary" : "outline"}
                        className="text-xs font-normal"
                      >
                        {isPyq ? q.source : t("New")}
                      </Badge>
                    );
                  })()}
                  {/* Marks are read-only — editing them would break sum===maxMarks. */}
                  <span className="text-xs text-muted-foreground">[{q.marks}m]</span>
                  {/* Regenerate this question via the LLM — edit mode only, keeps
                      the read/print view clean. Marks stay fixed; the new answer
                      key comes back with the question. */}
                  {isEditing && onRegenerateQuestion && (() => {
                    const busy = regeneratingKey === `${sectionIndex}-${qi}`;
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        disabled={!!regeneratingKey}
                        onClick={() => onRegenerateQuestion(sectionIndex, qi)}
                        title={t("Regenerate")}
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1.5 text-xs">{busy ? t("Regenerating…") : t("Regenerate")}</span>
                      </Button>
                    );
                  })()}
                </div>
              </div>

              {hasOptions && (
                <div className="mt-2 ml-6 space-y-1">
                  {q.options!.map((opt, oi) => (
                    <p key={oi} className="text-muted-foreground">
                      ({String.fromCharCode(97 + oi)}) {stripOptionLabel(opt)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
