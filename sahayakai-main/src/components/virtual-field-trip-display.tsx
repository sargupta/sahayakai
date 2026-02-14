
"use client";

import type { FC } from 'react';
import type { VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Save, Download, Globe2, MapPin, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Link from "next/link";

type VirtualFieldTripDisplayProps = {
    trip: VirtualFieldTripOutput;
    topic: string; // The original prompt/topic
    gradeLevel?: string;
    language?: string;
};

export const VirtualFieldTripDisplay: FC<VirtualFieldTripDisplayProps> = ({ trip, topic, gradeLevel, language }) => {
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
                type: 'virtual-field-trip',
                title: trip.title,
                gradeLevel: trip.gradeLevel || gradeLevel || 'Class 5',
                subject: trip.subject || 'Geography',
                topic: topic,
                language: language || 'English',
                isPublic: false,
                isDraft: false,
                data: trip
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
        const element = document.getElementById('field-trip-card');
        if (!element) return;

        const actionButtons = element.querySelector('.no-print');
        if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

        // Hide the "Visit on Google Earth" buttons for PDF as they might look weird or not be actionable in this specific scraped way
        // actually, let's keep them but maybe just styled differently? 
        // html2canvas usually handles text fine.

        try {
            toast({ title: "Generating PDF...", description: "Preparing itinerary." });

            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            const cleanTitle = (trip.title || topic).substring(0, 20).replace(/[^a-z0-9]/gi, '_');
            pdf.save(`Sahayak_FieldTrip_${cleanTitle}.pdf`);

            toast({ title: "PDF Downloaded", description: "Your file is ready." });
        } catch (error) {
            console.error("PDF Error:", error);
            toast({ title: "Download Failed", variant: "destructive", description: "Could not generate PDF." });
        } finally {
            if (actionButtons) (actionButtons as HTMLElement).style.display = '';
        }
    };

    return (
        <Card id="field-trip-card" className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
            <CardHeader>
                <div className="flex justify-between items-start no-print">
                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                        <Globe2 className="h-6 w-6" />
                        {trip.title}
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
                {/* For PDF only - visible title if headers are hidden? actually the header is inside the card so it will print. */}
            </CardHeader>
            <CardContent className="space-y-4">
                {trip.stops.map((stop, index) => (
                    <div key={index} className="flex gap-4 items-start p-4 rounded-lg bg-accent/20 border border-primary/10">
                        <div className="flex-shrink-0">
                            <MapPin className="h-8 w-8 text-primary" />
                        </div>
                        <div className="flex-grow space-y-2">
                            <h3 className="font-bold text-lg">{stop.name}</h3>
                            <p className="text-sm text-foreground/80">{stop.description}</p>

                            <div className="bg-white/50 p-2 rounded text-xs">
                                <strong>Fact:</strong> {stop.educationalFact}
                            </div>
                            <div className="bg-white/50 p-2 rounded text-xs italic">
                                <strong>Ask:</strong> {stop.reflectionPrompt}
                            </div>

                            <div className="pt-2">
                                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                                    <Link href={stop.googleEarthUrl} target="_blank" rel="noopener noreferrer">
                                        <Send className="mr-2 h-4 w-4" />
                                        Visit on Google Earth
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
