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
import { SubjectSelector } from "@/components/subject-selector";
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
    subject?: string;
  };
  generateButton?: React.ReactNode;
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
  generateButton,
}: LessonPlanSidebarProps) {
  const { control } = useFormContext();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-card p-4 sm:p-6 rounded-2xl border border-border shadow-soft h-fit">
      <h3 className="font-headline text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {labels?.configuration || "Lesson Plan Settings"}
      </h3>

      <div className="pt-2"></div>

      {/* Context Image (Moved from Main Area) */}
      <div className="mb-4">
        <FormField
          control={control}
          name="imageDataUri"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-headline text-xs font-medium text-muted-foreground">
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

      <div className="card-section-warm">
        <span className="card-section-label">Configuration</span>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name="gradeLevels"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-headline">
                  {labels?.grade || "Class"}
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
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-headline">
                  {labels?.subject || "Subject"}
                </FormLabel>
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
        </div>

        <div className="mt-4">
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
      </div>

      <div className="col-span-2 h-px bg-border my-4"></div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full justify-between border-border text-muted-foreground hover:text-primary hover:border-primary/50"
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
              {labels?.difficulty || "Difficulty Level"} <span className="text-muted-foreground font-normal text-xs">{labels?.standard || "(Standard)"}</span>
            </FormLabel>
            <DifficultySelector
              value={difficultyLevel}
              onValueChange={setDifficultyLevel}
            />
          </div>

          {/* NCERT Chapter Selector */}
          <div className="space-y-1 pt-2 border-t border-border">
            <FormLabel className="text-xs font-medium text-muted-foreground">
              {labels?.ncert || "Link NCERT Chapter (Optional)"}
            </FormLabel>
            {currentGrade ? (
              <NCERTChapterSelector
                selectedGrade={currentGrade}
                onChapterSelect={(chapter) => {
                  setSelectedChapter(chapter);
                  if (chapter) {
                    setTopic(`Lesson plan for ${chapter.title}`);
                  }
                }}
              />
            ) : (
              <p className="text-xs text-muted-foreground py-2">Select a class above to link an NCERT chapter.</p>
            )}
          </div>
        </div>
      )}

      {generateButton && (
        <div className="mt-6 pt-2">
          {generateButton}
        </div>
      )}
    </div>
  );
}
