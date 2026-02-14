
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Download, Copy, FileText, Printer, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useToast } from '@/hooks/use-toast';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type WorksheetDisplayProps = {
    worksheet: { worksheetContent: string; gradeLevel?: string | null; subject?: string | null };
    title?: string;
};

export const WorksheetDisplay: FC<WorksheetDisplayProps> = ({ worksheet, title }) => {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(worksheet.worksheetContent);
        toast({
            title: "Copied to Clipboard",
            description: "Worksheet content has been copied to your clipboard.",
        });
    };

    const handleDownload = async () => {
        const element = document.getElementById('worksheet-pdf');
        if (!element) return;

        // Hide buttons for cleaner PDF
        const actionButtons = element.querySelector('.no-print');
        if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

        try {
            toast({ title: "Generating PDF...", description: "Preparing high-quality worksheet PDF." });

            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const cleanTitle = (title || 'Worksheet').replace(/[^a-z0-9]/gi, '_');
            pdf.save(`Sahayak_Worksheet_${cleanTitle}.pdf`);

            toast({ title: "PDF Downloaded", description: "Your worksheet is ready." });
        } catch (error) {
            console.error("PDF Error:", error);
            toast({ title: "Download Failed", variant: "destructive", description: "Could not generate PDF." });
        } finally {
            // Restore buttons
            if (actionButtons) (actionButtons as HTMLElement).style.display = '';
        }
    };

    const handleSave = async () => {
        try {
            const { auth } = await import('@/lib/firebase');
            let user = auth.currentUser;

            if (!user) {
                const { signInAnonymously } = await import('firebase/auth');
                const userCred = await signInAnonymously(auth);
                user = userCred.user;
            }

            const saveTitle = title || "Worksheet";

            // Construct payload matching WorksheetDataSchema
            const payload = {
                id: crypto.randomUUID(),
                type: 'worksheet',
                title: saveTitle,
                gradeLevel: worksheet.gradeLevel || 'Class 5',
                subject: worksheet.subject || 'General',
                topic: saveTitle,
                language: 'English', // TODO: Pass language prop
                isPublic: false,
                isDraft: false,
                data: {
                    layout: 'portrait',
                    sections: [{
                        title: 'Generated Content',
                        instructions: worksheet.worksheetContent,
                        items: []
                    }],
                    // Preserving raw content for display re-hydration if needed
                    ...worksheet
                }
            };

            const token = await user.getIdToken();

            const response = await fetch('/api/content/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server rejected save');
            }

            toast({
                title: "Saved to Library",
                description: "Your worksheet has been saved to your personal library.",
            });

        } catch (error) {
            console.error("Save Error:", error);
            toast({
                title: "Save Failed",
                description: error instanceof Error ? error.message : "Could not save to library.",
                variant: "destructive"
            });
        }
    };

    if (!worksheet || !worksheet.worksheetContent) {
        return null;
    }

    return (
        <Card id="worksheet-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/20 pb-4">
                <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
                    <FileText className="h-7 w-7 text-primary" />
                    {title || "Worksheet"}
                </CardTitle>
                <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-8 prose prose-slate max-w-none prose-headings:font-headline prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl">
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                >
                    {worksheet.worksheetContent}
                </ReactMarkdown>
            </CardContent>
        </Card>
    );
};
