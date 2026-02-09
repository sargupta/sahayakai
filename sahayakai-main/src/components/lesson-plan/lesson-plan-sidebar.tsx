"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { LanguageSelector } from "@/components/language-selector";
import { ResourceSelector, type ResourceLevel } from "@/components/resource-selector";
import { DifficultySelector, type DifficultyLevel } from "@/components/difficulty-selector";
import { NCERTChapterSelector } from "@/components/ncert-chapter-selector";
import { type NCERTChapter } from "@/data/ncert";
import { useFormContext } from "react-hook-form";
import { ImageUploader } from "@/components/image-uploader";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";

interface LessonPlanSidebarProps {
  selectedLanguage: string;
  resourceLevel: ResourceLevel;
  setResourceLevel: (level: ResourceLevel) => void;
  difficultyLevel: DifficultyLevel;
  setDifficultyLevel: (level: DifficultyLevel) => void;
  currentGrade?: number;
  setSelectedChapter: (chapter: NCERTChapter | null) => void;
  setTopic: (topic: string) => void;
  labels?: {
    configuration?: string;
    customizeOutput?: string;
    contextImage?: string;
    grade?: string;
    language?: string;
    showAdvanced?: string;
    hideAdvanced?: string;
    resources?: string;
    difficulty?: string;
    standard?: string;
    ncert?: string;
  };
}

export function LessonPlanSidebar({
  selectedLanguage,
  resourceLevel,
  setResourceLevel,
  difficultyLevel,
  setDifficultyLevel,
  currentGrade,
  setSelectedChapter,
  setTopic,
  labels,
}: LessonPlanSidebarProps) {
  const { control } = useFormContext();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100 h-fit">
      <h3 className="font-headline text-lg mb-1">
        {labels?.configuration || "2. Configuration"}
      </h3>
      <p className="text-sm text-slate-500 mb-4">{labels?.customizeOutput || "Customize the output."}</p>

      {/* Context Image (Moved from Main Area) */}
      <div className="mb-4">
        <FormField
          control={control}
          name="imageDataUri"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-headline text-xs font-semibold text-slate-600">
                {labels?.contextImage || "Add Context Image (Optional)"}
              </FormLabel>
              <FormControl>
                <ImageUploader
                  onImageUpload={(dataUri) => {
                    field.onChange(dataUri);
                  }}
                  language={selectedLanguage}
                  compact={true}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="gradeLevels"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-headline">
                {labels?.grade || "Grade"}
              </FormLabel>
              <FormControl>
                <GradeLevelSelector
                  value={field.value || []}
                  onValueChange={field.onChange}
                  language={selectedLanguage}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-headline">
                {labels?.language || "Language"}
              </FormLabel>
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

      <div className="col-span-2 h-px bg-slate-200 my-4"></div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full justify-between border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50"
      >
        <span className="flex items-center gap-2 text-sm">
          <Settings2 className="h-4 w-4" />
          {showAdvanced ? (labels?.hideAdvanced || "Hide Advanced Options") : (labels?.showAdvanced || "Show Advanced Options")}
        </span>
        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {showAdvanced && (
        <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <FormLabel className="font-headline">
              Resources Available
            </FormLabel>
            <ResourceSelector
              value={resourceLevel}
              onValueChange={setResourceLevel}
            />
          </div>

          <div className="space-y-1">
            <FormLabel className="font-headline">
              {labels?.difficulty || "Difficulty Level"} <span className="text-slate-400 font-normal text-xs">{labels?.standard || "(Standard)"}</span>
            </FormLabel>
            <DifficultySelector
              value={difficultyLevel}
              onValueChange={setDifficultyLevel}
            />
          </div>

          {/* NCERT Chapter Selector */}
          {currentGrade && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <FormLabel className="text-xs font-semibold text-slate-600">
                {labels?.ncert || "Link NCERT Chapter (Optional)"}
              </FormLabel>
              <NCERTChapterSelector
                selectedGrade={currentGrade}
                onChapterSelect={(chapter) => {
                  setSelectedChapter(chapter);
                  if (chapter) {
                    setTopic(`Lesson plan for ${chapter.title}`);
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
