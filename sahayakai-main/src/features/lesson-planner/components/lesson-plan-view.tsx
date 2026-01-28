"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { LessonPlanDisplay } from "@/components/lesson-plan-display";
import { LessonPlanHeader } from "@/components/lesson-plan/lesson-plan-header";
import { LessonPlanInputSection } from "@/components/lesson-plan/lesson-plan-input-section";
import { LessonPlanSidebar } from "@/components/lesson-plan/lesson-plan-sidebar";
import { useLessonPlan } from "../hooks/use-lesson-plan";

type LessonPlanViewProps = ReturnType<typeof useLessonPlan>;

export function LessonPlanView({
    form,
    onSubmit,
    lessonPlan,
    isLoading,
    selectedChapter,
    setSelectedChapter,
    resourceLevel,
    setResourceLevel,
    difficultyLevel,
    setDifficultyLevel,
    currentGrade,
    selectedLanguage,
    topicPlaceholder,
    handleTranscript,
    handlePromptClick,
    handleTemplateSelect,
    loadingMessage,
}: LessonPlanViewProps) {
    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12">

            <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                {/* Clean Top Bar */}
                <div className="h-1.5 w-full bg-[#FF9933]" />

                <LessonPlanHeader />
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* LEFT COLUMN: Primary Task (7 cols) */}
                                <div className="lg:col-span-7 space-y-4 min-w-0">
                                    <LessonPlanInputSection
                                        topicPlaceholder={topicPlaceholder}
                                        selectedLanguage={selectedLanguage}
                                        onTranscriptChange={handleTranscript}
                                        onPromptClick={handlePromptClick}
                                        onTemplateSelect={handleTemplateSelect}
                                        generateButton={
                                            <Button type="submit" disabled={isLoading} className="w-full text-lg py-6 shadow-md transition-all flex items-center justify-center gap-2">
                                                {isLoading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                                        Generating Lesson Plan...
                                                    </>
                                                ) : (
                                                    "Generate Lesson Plan"
                                                )}
                                            </Button>
                                        }
                                    />
                                </div>

                                {/* RIGHT COLUMN: Secondary Context (5 cols) */}
                                <div className="lg:col-span-5 shrink-0 pt-4 lg:pt-0">
                                    <LessonPlanSidebar
                                        selectedLanguage={selectedLanguage}
                                        resourceLevel={resourceLevel}
                                        setResourceLevel={setResourceLevel}
                                        difficultyLevel={difficultyLevel}
                                        setDifficultyLevel={setDifficultyLevel}
                                        currentGrade={currentGrade}
                                        setSelectedChapter={setSelectedChapter}
                                        setTopic={(topic) => {
                                            form.setValue("topic", topic);
                                            form.trigger("topic");
                                        }}
                                    />
                                </div>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </div>

            {lessonPlan && (
                <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <LessonPlanDisplay lessonPlan={lessonPlan} />
                </div>
            )}
        </div>
    );
}
