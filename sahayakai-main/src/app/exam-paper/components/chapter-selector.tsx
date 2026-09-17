/**
 * @fileOverview Chapter picker — a toggle-chip list when the matched blueprint
 * has chapter weightage, otherwise a comma-separated free-text input. Dumb:
 * all selection state is owned by the form hook and passed in.
 */
"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";

interface ChapterSelectorProps {
  suggestions: string[];
  chapters: string[];
  setChapters: Dispatch<SetStateAction<string[]>>;
  chaptersInput: string;
  setChaptersInput: Dispatch<SetStateAction<string>>;
}

export function ChapterSelector({
  suggestions,
  chapters,
  setChapters,
  chaptersInput,
  setChaptersInput,
}: ChapterSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="card-section space-y-2">
      <Label>{t("Chapters")}</Label>
      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((ch) => {
              const selected = chapters.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setChapters((prev) =>
                      selected
                        ? prev.filter((c) => c !== ch)
                        : [...prev, ch]
                    );
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {selected ? "✓ " : "+ "}
                  {ch}
                </button>
              );
            })}
          </div>
          {chapters.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {chapters.length} {chapters.length === 1 ? t("chapter") : t("chapters")} {t("selected")}
              {" · "}
              <button
                type="button"
                className="underline hover:no-underline"
                onClick={() => setChapters([])}
              >
                {t("Clear all")}
              </button>
            </p>
          )}
        </div>
      ) : (
        <Input
          id="chapters"
          placeholder={t("e.g. Real Numbers, Polynomials, Triangles")}
          value={chaptersInput}
          onChange={(e) => setChaptersInput(e.target.value)}
        />
      )}
    </div>
  );
}
