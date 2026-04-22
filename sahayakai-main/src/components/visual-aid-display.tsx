"use client";

import type { FC } from "react";
import type { VisualAidOutput } from "@/ai/flows/visual-aid-designer";
import { Save, Download, Images } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

type VisualAidDisplayProps = {
    visualAid: VisualAidOutput;
    title: string;
    gradeLevel?: string;
    language?: string;
};

const PDF_ID = "visual-aid-card";

export const VisualAidDisplay: FC<VisualAidDisplayProps> = ({
    visualAid,
    title,
    gradeLevel,
    language,
}) => {
    const { toast } = useToast();
    const t = getResultShellDict(language);

    const handleSave = async () => {
        try {
            if (visualAid.storagePath) {
                toast({
                    title: "Already in Library",
                    description:
                        "This visual aid was saved automatically when generated.",
                });
                return;
            }
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
                type: "visual-aid",
                title,
                gradeLevel: gradeLevel || "Class 5",
                subject: visualAid.subject || "Science",
                topic: title,
                language: language || "English",
                isPublic: false,
                isDraft: false,
                data: visualAid,
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
            filename: `Sahayak_VisualAid_${title.substring(0, 20)}.pdf`,
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
            title={title || t.visualAidTitle}
            icon={<Images />}
            size="compact"
            variant="glass"
            actions={[
                { label: t.save, icon: <Save />, onClick: handleSave },
                { label: t.pdf, icon: <Download />, onClick: handleDownload },
            ]}
            footer={
                <FeedbackDialog
                    page="visual-aid"
                    feature="visual-aid-result"
                    context={{ title }}
                />
            }
        >
            <div className="flex flex-col items-center space-y-6">
                <div className="w-full relative aspect-square max-w-[512px] border border-black/10 rounded-lg overflow-hidden bg-black/5">
                    {visualAid.imageDataUri ? (
                        <Image
                            src={visualAid.imageDataUri}
                            alt={title || "Generated visual aid"}
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
                            <Images className="h-10 w-10" />
                            <p className="text-sm text-center px-4">
                                Image not stored. Edit the prompt and click
                                Generate to recreate.
                            </p>
                        </div>
                    )}
                </div>

                <div className="w-full space-y-4 text-left">
                    <div className="p-4 bg-accent/10 rounded-lg border border-primary/20">
                        <h4 className="font-bold text-primary mb-1">
                            {t.pedagogicalContext}
                        </h4>
                        <p className="text-sm text-foreground/80">
                            {visualAid.pedagogicalContext}
                        </p>
                    </div>
                    <div className="p-4 bg-accent/10 rounded-lg border border-primary/20">
                        <h4 className="font-bold text-primary mb-1">
                            {t.discussionSpark}
                        </h4>
                        <p className="text-sm text-foreground/80">
                            {visualAid.discussionSpark}
                        </p>
                    </div>
                </div>
            </div>
        </ResultShell>
    );
};
