"use client";

import type { FC } from "react";
import { Download, Copy, FileText, Save } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";

type WorksheetDisplayProps = {
    worksheet: {
        worksheetContent: string;
        title?: string;
        gradeLevel?: string | null;
        subject?: string | null;
        activities?: any[];
        learningObjectives?: string[];
    };
    title?: string;
    selectedLanguage?: string;
};

const PDF_ID = "worksheet-pdf";

export const WorksheetDisplay: FC<WorksheetDisplayProps> = ({
    worksheet,
    title,
    selectedLanguage,
}) => {
    const { toast } = useToast();
    const t = getResultShellDict(selectedLanguage);

    if (!worksheet || !worksheet.worksheetContent) return null;

    const displayTitle = title || worksheet.title || t.worksheetTitle;

    const handleCopy = () => {
        navigator.clipboard.writeText(worksheet.worksheetContent);
        toast({ title: t.copiedTitle, description: t.copiedDesc });
    };

    const handleDownload = async () => {
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_Worksheet_${displayTitle}.pdf`,
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
            let user = auth.currentUser;
            if (!user) {
                const { signInAnonymously } = await import("firebase/auth");
                user = (await signInAnonymously(auth)).user;
            }
            const token = await user.getIdToken();
            const payload = {
                id: crypto.randomUUID(),
                type: "worksheet",
                title: displayTitle,
                gradeLevel: worksheet.gradeLevel || "Class 5",
                subject: worksheet.subject || "General",
                topic: displayTitle,
                language: selectedLanguage || "en",
                isPublic: false,
                isDraft: false,
                data: { ...worksheet, layout: "portrait" },
            };
            const response = await fetch("/api/content/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Server rejected save");
            }
            toast({ title: t.savedTitle, description: t.savedDesc });
        } catch (err) {
            toast({
                title: t.saveFailedTitle,
                description:
                    err instanceof Error ? err.message : t.saveFailedDesc,
                variant: "destructive",
            });
        }
    };

    return (
        <ResultShell
            id={PDF_ID}
            title={displayTitle}
            icon={<FileText />}
            actions={[
                { label: t.copy, icon: <Copy />, onClick: handleCopy },
                { label: t.save, icon: <Save />, onClick: handleSave },
                { label: t.pdf, icon: <Download />, onClick: handleDownload },
            ]}
            contentClassName="p-4 sm:p-6 md:p-8 prose prose-slate max-w-none prose-sm sm:prose-base prose-headings:font-headline prose-h1:text-2xl sm:prose-h1:text-3xl prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl"
            footer={
                <FeedbackDialog
                    page="worksheet"
                    feature="worksheet-result"
                    context={{ title: displayTitle }}
                />
            }
        >
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
            >
                {worksheet.worksheetContent}
            </ReactMarkdown>
        </ResultShell>
    );
};
