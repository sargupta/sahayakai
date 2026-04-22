"use client";

import type { FC } from "react";
import type { TeacherTrainingOutput } from "@/ai/flows/teacher-training";
import {
    GraduationCap,
    BookOpen,
    Lightbulb,
    Save,
    Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

type TeacherTrainingDisplayProps = {
    advice: TeacherTrainingOutput;
    title?: string;
    selectedLanguage?: string;
};

const PDF_ID = "teacher-training-card";

export const TeacherTrainingDisplay: FC<TeacherTrainingDisplayProps> = ({
    advice,
    title,
    selectedLanguage,
}) => {
    const { toast } = useToast();
    const t = getResultShellDict(selectedLanguage);

    const saveTitle = title || t.teacherAdviceTitle;

    const handleSave = async () => {
        try {
            const { auth } = await import("@/lib/firebase");
            const user = auth.currentUser;
            if (!user) {
                toast({
                    title: t.loginRequiredTitle,
                    description: t.loginRequiredDesc,
                    variant: "destructive",
                });
                return;
            }
            const token = await user.getIdToken();
            const payload = {
                id: crypto.randomUUID(),
                type: "teacher-training",
                title: saveTitle,
                gradeLevel: advice.gradeLevel || "Class 5",
                subject: advice.subject || "General",
                topic: saveTitle,
                language: selectedLanguage || "en",
                isPublic: false,
                isDraft: false,
                data: advice,
            };
            const response = await fetch("/api/content/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error("Server rejected save");
            toast({ title: t.savedTitle, description: t.savedDesc });
        } catch {
            toast({
                title: t.saveFailedTitle,
                description: t.saveFailedDesc,
                variant: "destructive",
            });
        }
    };

    const handleDownload = async () => {
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_TeacherTraining_${saveTitle.substring(0, 20)}.pdf`,
        });
        toast(
            res.ok
                ? { title: t.pdfDoneTitle, description: t.pdfDoneDesc }
                : {
                      title: t.pdfFailedTitle,
                      description: t.pdfFailedDesc,
                      variant: "destructive",
                  },
        );
    };

    return (
        <ResultShell
            id={PDF_ID}
            title={saveTitle}
            icon={<GraduationCap />}
            size="compact"
            variant="glass"
            actions={[
                { label: t.save, icon: <Save />, onClick: handleSave },
                { label: t.pdf, icon: <Download />, onClick: handleDownload },
            ]}
            footer={
                <FeedbackDialog
                    page="teacher-training"
                    feature="teacher-training-result"
                    context={{ title: saveTitle }}
                />
            }
        >
            <div className="space-y-6">
                <p className="text-base sm:text-lg text-foreground/90">
                    {advice.introduction}
                </p>

                <div className="space-y-4">
                    {advice.advice.map((item, index) => (
                        <div
                            key={index}
                            className="p-3 sm:p-4 rounded-lg bg-accent/20 border border-primary/20"
                        >
                            <h3 className="font-bold font-headline text-base sm:text-lg flex items-center gap-2">
                                <Lightbulb className="h-5 w-5 text-primary flex-shrink-0" />
                                <span className="break-words">
                                    {item.strategy}
                                </span>
                            </h3>
                            <div className="mt-2 pl-7 space-y-2 text-sm">
                                <p className="font-medium text-foreground/80 flex items-start gap-2">
                                    <BookOpen className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        <strong className="text-primary font-semibold">
                                            {item.pedagogy}:
                                        </strong>{" "}
                                        {item.explanation}
                                    </span>
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <p className="text-center font-semibold text-foreground/90 pt-4 border-t border-primary/10">
                    {advice.conclusion}
                </p>
            </div>
        </ResultShell>
    );
};
