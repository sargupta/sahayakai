"use client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MicrophoneInput } from "@/components/microphone-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { QuickTemplates } from "@/components/quick-templates";
import { useFormContext } from "react-hook-form";
import { type QuickTemplate } from "@/data/quick-templates";

interface LessonPlanInputSectionProps {
  topicPlaceholder: string;
  selectedLanguage: string;
  onTranscriptChange: (transcript: string) => void;
  onPromptClick: (prompt: string) => void;
  onTemplateSelect: (template: QuickTemplate) => void;
  generateButton?: React.ReactNode;
  labels?: {
    microphone?: string;
    quickIdeas?: string;
    quickTemplates?: string;
  };
}

export function LessonPlanInputSection({
  topicPlaceholder,
  selectedLanguage,
  onTranscriptChange,
  onPromptClick,
  onTemplateSelect,
  generateButton,
  labels,
}: LessonPlanInputSectionProps) {
  const { control, setValue, trigger } = useFormContext();

  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="topic"
        render={({ field }) => (
          <FormItem>
            <div className="space-y-1">
              {/* <FormLabel> removed, redundant */}
            </div>
            <FormControl>
              <div className="flex flex-col gap-4">
                <MicrophoneInput
                  onTranscriptChange={onTranscriptChange}
                  iconSize="lg"
                  label={labels?.microphone || "Speak your lesson topic..."}
                  className="bg-white"
                />
                <Textarea
                  value={field.value}
                  onChange={field.onChange}
                  className="bg-white min-h-[140px] text-base border-slate-300 shadow-sm focus:border-primary focus:ring-primary/10 rounded-lg placeholder:text-slate-400 font-normal p-4 resize-none"
                  placeholder="e.g., A lesson on 'Healthy Food' for grades 1, 2, and 3."
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Secondary Inputs (Below Fold) */}
      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-none">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-blue-100 text-blue-700 p-0.5 rounded-md">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
            <h4 className="font-semibold text-slate-700 text-xs">{labels?.quickIdeas || "Quick Ideas"}</h4>
          </div>
          <ExamplePrompts
            onPromptClick={onPromptClick}
            selectedLanguage={selectedLanguage}
            page="homeWithImage"
          />
        </div>

        {/* Quick Templates */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-[#FF9933]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <h3 className="font-semibold text-gray-900 text-sm">
              {labels?.quickTemplates || "Quick Start Templates"}
            </h3>
          </div>
          <div className="overflow-x-auto pb-1">
            <QuickTemplates onTemplateSelect={onTemplateSelect} className="scale-95 origin-left" />
          </div>
        </div>
      </div>
    </div>
  );
}
