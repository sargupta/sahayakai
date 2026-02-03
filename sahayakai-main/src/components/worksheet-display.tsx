
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Download, Copy, FileText, Printer, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type WorksheetDisplayProps = {
    worksheet: { worksheetContent: string };
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
        const input = document.getElementById('worksheet-pdf');
        if (input) {
            try {
                const canvas = await html2canvas(input, {
                    scale: 1.5,
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                let width = pdfWidth;
                let height = width / ratio;
                if (height > pdfHeight) {
                    height = pdfHeight;
                    width = height * ratio;
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
                const now = new Date();
                const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const cleanTitle = (title || 'Worksheet').replace(/[^a-z0-9]/gi, '_');
                const filename = `${timestamp}_${cleanTitle}.pdf`;

                // Save locally
                pdf.save(filename);

                // Record to storage
                const { recordPdfDownload } = await import('@/app/actions/content');
                const userId = 'user-123'; // TO DO: Get from Auth
                const pdfBase64 = pdf.output('datauristring');
                const result = await recordPdfDownload(userId, title || 'Worksheet', pdfBase64, 'worksheet');

                if (result.success) {
                    toast({
                        title: "PDF Saved to Library",
                        description: "A copy of this worksheet has been saved to your Cloud Storage.",
                    });
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error("PDF Error:", error);
                toast({
                    title: "Download Recorded Locally",
                    description: "PDF downloaded, but could not sync to Cloud Storage.",
                    variant: "destructive"
                });
            }
        }
    };

    const handleSave = async () => {
        try {
            const { saveToLibrary } = await import('@/app/actions/content');
            const userId = 'user-123'; // TO DO: Get from real Auth
            const saveTitle = title || "Worksheet";

            const result = await saveToLibrary(userId, 'worksheet', saveTitle, worksheet);

            if (result.success) {
                toast({
                    title: "Saved to Library",
                    description: "Your worksheet has been saved to your personal library.",
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error("Save Error:", error);
            toast({
                title: "Save Failed",
                description: "Could not save to library. Please try again.",
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
                <ReactMarkdown>{worksheet.worksheetContent}</ReactMarkdown>
            </CardContent>
        </Card>
    );
};
