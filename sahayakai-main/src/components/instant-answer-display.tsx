"use client";

import type { FC } from "react";
import type { InstantAnswerOutput } from "@/ai/flows/instant-answer";
import { Button } from "./ui/button";
import {
    Copy,
    Save,
    MessageSquareQuote,
    Youtube,
    Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { ResultShell } from "@/components/ui/result-shell";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

type InstantAnswerDisplayProps = {
    answer: InstantAnswerOutput & { videoSuggestionUrl?: string | null };
    title?: string;
    selectedLanguage?: string;
};

const PDF_ID = "instant-answer-card";

export const InstantAnswerDisplay: FC<InstantAnswerDisplayProps> = ({
    answer,
    title,
    selectedLanguage,
}) => {
    const { toast } = useToast();
    const t = getResultShellDict(selectedLanguage);

    if (!answer || !answer.answer) return null;

    const displayTitle = title || t.instantAnswerTitle;

    const handleCopy = () => {
        navigator.clipboard.writeText(answer.answer);
        toast({ title: t.copiedTitle, description: t.copiedDesc });
    };

    const handleDownload = async () => {
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_InstantAnswer_${displayTitle}.pdf`,
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
                type: "instant-answer",
                title: displayTitle,
                gradeLevel: answer.gradeLevel || "Class 5",
                subject: answer.subject || "General",
                topic: displayTitle,
                language: selectedLanguage || "en",
                isPublic: false,
                isDraft: false,
                data: answer,
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

    return (
        <ResultShell
            id={PDF_ID}
            title={displayTitle}
            icon={<MessageSquareQuote />}
            variant="glass"
            actions={[
                { label: t.copy, icon: <Copy />, onClick: handleCopy },
                { label: t.save, icon: <Save />, onClick: handleSave },
                { label: t.pdf, icon: <Download />, onClick: handleDownload },
            ]}
        >
            <div className="prose prose-slate max-w-none prose-sm sm:prose-base">
                <ReactMarkdown>{answer.answer}</ReactMarkdown>
            </div>

            {answer.videoSuggestionUrl ? (
                <div className="mt-6 p-4 sm:p-6 bg-red-50 rounded-xl border border-red-100 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                    <div className="bg-red-600 p-3 rounded-full flex-shrink-0">
                        <Youtube className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        <h4 className="font-headline text-lg sm:text-xl text-red-900 mb-1">
                            {t.recommendedVideo}
                        </h4>
                        <p className="text-red-800/70 mb-3 text-sm">
                            {t.recommendedVideoBlurb}
                        </p>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() =>
                                answer.videoSuggestionUrl &&
                                window.open(
                                    answer.videoSuggestionUrl,
                                    "_blank",
                                )
                            }
                        >
                            {t.watchOnYoutube}
                        </Button>
                    </div>
                </div>
            ) : null}
        </ResultShell>
    );
};
