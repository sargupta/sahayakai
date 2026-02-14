
"use client";

import type { FC } from 'react';
import type { VisualAidOutput } from "@/ai/flows/visual-aid-designer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Save, Download, Images } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type VisualAidDisplayProps = {
    visualAid: VisualAidOutput;
    title: string;
    gradeLevel?: string;
    language?: string;
};

export const VisualAidDisplay: FC<VisualAidDisplayProps> = ({ visualAid, title, gradeLevel, language }) => {
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            const { auth } = await import('@/lib/firebase');
            let user = auth.currentUser;
            if (!user) {
                toast({ title: "Login Required", description: "Please login to save.", variant: "destructive" });
                return;
            }

            const token = await user.getIdToken();

            const payload = {
                id: crypto.randomUUID(),
                type: 'visual-aid',
                title: title,
                gradeLevel: gradeLevel || 'Class 5',
                subject: visualAid.subject || 'Science',
                topic: title,
                language: language || 'English',
                isPublic: false,
                isDraft: false,
                data: visualAid
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

    const handleDownloadPDF = async () => {
        const element = document.getElementById('visual-aid-card');
        if (!element) return;

        const actionButtons = element.querySelector('.no-print');
        if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

        try {
            toast({ title: "Generating PDF...", description: "Preparing visual aid document." });

            // Use html2canvas to capture the card
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Sahayak_VisualAid_${title.substring(0, 20).replace(/[^a-z0-9]/gi, '_')}.pdf`);

            toast({ title: "PDF Downloaded", description: "Your file is ready." });
        } catch (error) {
            console.error("PDF Error:", error);
            toast({ title: "Download Failed", variant: "destructive", description: "Could not generate PDF." });
        } finally {
            if (actionButtons) (actionButtons as HTMLElement).style.display = '';
        }
    };

    return (
        <Card id="visual-aid-card" className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
            <CardHeader>
                <div className="flex justify-between items-start no-print">
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                        <Images className="h-6 w-6" />
                        Generated Visual Aid
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" />
                            Save
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center p-6 space-y-6">
                <div className="w-full relative aspect-square max-w-[512px] border border-black/10 rounded-lg overflow-hidden bg-black/5">
                    <Image
                        src={visualAid.imageDataUri}
                        alt={title || "Generated visual aid"}
                        fill
                        className="object-contain"
                        unoptimized // Allow data URIs
                    />
                </div>

                <div className="w-full space-y-4 text-left">
                    <div className="p-4 bg-accent/10 rounded-lg border border-primary/20">
                        <h4 className="font-bold text-primary mb-1">Pedagogical Context</h4>
                        <p className="text-sm text-foreground/80">{visualAid.pedagogicalContext}</p>
                    </div>
                    <div className="p-4 bg-accent/10 rounded-lg border border-primary/20">
                        <h4 className="font-bold text-primary mb-1">Discussion Spark</h4>
                        <p className="text-sm text-foreground/80">{visualAid.discussionSpark}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
