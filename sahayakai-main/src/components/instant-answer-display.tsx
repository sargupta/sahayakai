
"use client";

import type { FC } from 'react';
import type { InstantAnswerOutput } from "@/ai/flows/instant-answer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Copy, Save, MessageSquareQuote, Youtube, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type InstantAnswerDisplayProps = {
    answer: InstantAnswerOutput & { videoSuggestionUrl?: string | null };
    title?: string;
};

export const InstantAnswerDisplay: FC<InstantAnswerDisplayProps> = ({ answer, title }) => {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(answer.answer);
        toast({
            title: "Copied to Clipboard",
            description: "The answer has been copied to your clipboard.",
        });
    };

    const handleDownload = async () => {
        const element = document.getElementById('instant-answer-card');
        if (!element) return;

        // Hide buttons for cleaner PDF
        const actionButtons = element.querySelector('.no-print');
        if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

        try {
            toast({ title: "Generating PDF...", description: "Preparing your download." });
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Sahayak_InstantAnswer_${(title || 'Answer').replace(/[^a-z0-9]/gi, '_')}.pdf`);

            toast({ title: "PDF Downloaded", description: "Your file is ready." });
        } catch (error) {
            console.error("PDF Error:", error);
            toast({ title: "Download Failed", variant: "destructive", description: "Could not generate PDF." });
        } finally {
            if (actionButtons) (actionButtons as HTMLElement).style.display = '';
        }
    };

    const handleSave = async () => {
        try {
            const { auth } = await import('@/lib/firebase');
            let user = auth.currentUser;
            if (!user) {
                toast({ title: "Login Required", description: "Please login to save.", variant: "destructive" });
                return;
            }

            const token = await user.getIdToken();
            const saveTitle = title || "Instant Answer";

            const payload = {
                id: crypto.randomUUID(),
                type: 'instant-answer',
                title: saveTitle,
                gradeLevel: answer.gradeLevel || 'Class 5',
                subject: answer.subject || 'General',
                topic: saveTitle,
                language: 'English', // TODO: Pass language prop
                isPublic: false,
                isDraft: false,
                data: answer
            };

            const response = await fetch('/api/content/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Server rejected save');

            toast({
                title: "Saved to Library",
                description: "Saved to your personal library.",
            });
        } catch (error) {
            console.error("Save Error:", error);
            toast({
                title: "Save Failed",
                variant: "destructive",
                description: "Could not save to library."
            });
        }
    };

    if (!answer || !answer.answer) {
        return null;
    }

    return (
        <Card id="instant-answer-card" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/20 pb-4 bg-gradient-to-r from-primary/10 to-transparent">
                <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
                    <MessageSquareQuote className="h-7 w-7 text-primary" />
                    {title || "Instant Answer"}
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
            <CardContent className="p-8 prose prose-slate max-w-none">
                <div className="bg-white/50 rounded-xl p-6 border border-white/60 shadow-inner min-h-[100px]">
                    <ReactMarkdown>{answer.answer}</ReactMarkdown>
                </div>

                {answer.videoSuggestionUrl && (
                    <div className="mt-8 p-6 bg-red-50/50 rounded-xl border border-red-100 flex flex-col md:flex-row items-center gap-6">
                        <div className="bg-red-600 p-3 rounded-full flex-shrink-0">
                            <Youtube className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h4 className="font-headline text-xl text-red-900 mb-1">Recommended Video</h4>
                            <p className="text-red-800/70 mb-4 text-sm">Watch a visual explanation of this topic on YouTube.</p>
                            <Button
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => answer.videoSuggestionUrl && window.open(answer.videoSuggestionUrl, '_blank')}
                            >
                                Watch on YouTube
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
