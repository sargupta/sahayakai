
"use client";

import type { FC } from 'react';
import type { TeacherTrainingOutput } from "@/ai/flows/teacher-training";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Lightbulb, Save, Download } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type TeacherTrainingDisplayProps = {
  advice: TeacherTrainingOutput;
  title?: string;
};

export const TeacherTrainingDisplay: FC<TeacherTrainingDisplayProps> = ({ advice, title }) => {
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
      const saveTitle = title || "Teacher Training Advice";

      const payload = {
        id: crypto.randomUUID(),
        type: 'teacher-training',
        title: saveTitle,
        gradeLevel: advice.gradeLevel || 'Class 5',
        subject: advice.subject || 'General',
        topic: saveTitle,
        language: 'English', // TODO: Pass language prop
        isPublic: false,
        isDraft: false,
        data: advice
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
    const element = document.getElementById('teacher-training-card');
    if (!element) return;

    const actionButtons = element.querySelector('.no-print');
    if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

    try {
      toast({ title: "Generating PDF...", description: "Preparing your advice document." });
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      // Save the PDF
      const cleanTitle = (title || "TeacherTraining").substring(0, 20).replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Sahayak_TeacherTraining_${cleanTitle}.pdf`);

      toast({ title: "PDF Downloaded", description: "Your file is ready." });
    } catch (error) {
      console.error("PDF Error:", error);
      toast({ title: "Download Failed", variant: "destructive", description: "Could not generate PDF." });
    } finally {
      if (actionButtons) (actionButtons as HTMLElement).style.display = '';
    }
  };

  return (
    <Card id="teacher-training-card" className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader>
        <div className="flex justify-between items-start no-print">
          <CardTitle className="font-headline text-2xl flex items-center gap-2">
            <GraduationCap />
            Your Personalized Advice
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save to Library
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="ml-2">
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-lg text-foreground/90">{advice.introduction}</p>

        <div className="space-y-4">
          {advice.advice.map((item, index) => (
            <div key={index} className="p-4 rounded-lg bg-accent/20 border border-primary/20">
              <h3 className="font-bold font-headline text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                {item.strategy}
              </h3>
              <div className="mt-2 pl-7 space-y-2 text-sm">
                <p className="font-semibold text-foreground/80 flex items-start gap-2">
                  <BookOpen className="h-4 w-4 mt-1 flex-shrink-0" />
                  <span><strong className="text-primary font-semibold">{item.pedagogy}:</strong> {item.explanation}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center font-semibold text-foreground/90 pt-4 border-t border-primary/10">
          {advice.conclusion}
        </p>
      </CardContent>
    </Card >
  );
};
