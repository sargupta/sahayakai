
"use client";
import type { FC } from 'react';
import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from './ui/button';
import { Download, Save, Copy, ClipboardCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type RubricDisplayProps = {
  rubric: RubricGeneratorOutput;
};

export const RubricDisplay: FC<RubricDisplayProps> = ({ rubric }) => {
  const { toast } = useToast();

  if (!rubric || !rubric.criteria || rubric.criteria.length === 0) {
    return null;
  }

  const handleDownload = async () => {
    const element = document.getElementById('rubric-pdf');
    if (!element) return;

    // Hide action buttons for capture
    const actionButtons = element.querySelector('.no-print');
    if (actionButtons) (actionButtons as HTMLElement).style.display = 'none';

    try {
      toast({ title: "Generating PDF...", description: "Preparing rubric document." });

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Handle multi-page if needed, but for now single page scale down or split
      // Simple strategy: fit width, allow height to spill (or add page)
      if (imgHeight > 297) {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= 297;
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      const cleanTitle = (rubric.title || 'Rubric').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Sahayak_Rubric_${cleanTitle}.pdf`);

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

      const payload = {
        id: crypto.randomUUID(),
        type: 'rubric',
        title: rubric.title,
        gradeLevel: rubric.gradeLevel || 'Class 5',
        subject: rubric.subject || 'General',
        topic: rubric.title, // Use title as topic fallback
        language: 'English', // Todo: Pass language prop
        isPublic: false,
        isDraft: false,
        data: rubric
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

  const handleCopy = () => {
    // Format rubric as text
    const rubricText = `
${rubric.title}
${rubric.description}

${rubric.criteria.map((criterion, idx) => `
${idx + 1}. ${criterion.name}
   ${criterion.description}
   
   Performance Levels:
${criterion.levels.map(level => `   • ${level.name} (${level.points} pts): ${level.description}`).join('\n')}
`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(rubricText);
    toast({
      title: "Copied to Clipboard",
      description: "Rubric has been copied to your clipboard.",
    });
  };


  const performanceLevels = rubric.criteria[0]?.levels.map(level => ({
    name: level.name.replace(/\s*\(\d+\s*pts\)/, ''),
    points: level.points
  })) || [];

  return (
    <Card id="rubric-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader className="space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2">
            <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7 text-primary" />
              {rubric.title}
            </CardTitle>
            {rubric.description && (
              <CardDescription className="text-base">
                {rubric.description}
              </CardDescription>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-start gap-2 no-print">
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-full border-collapse border border-primary/20">
            <TableHeader className="bg-primary/10">
              <TableRow>
                <TableHead className="w-[25%] border border-primary/20 p-2 font-headline text-primary-foreground bg-primary">Criteria</TableHead>
                {performanceLevels.map(level => (
                  <TableHead key={level.name} className="w-[18.75%] border border-primary/20 p-2 text-center font-headline text-primary-foreground bg-primary">
                    {level.name} ({level.points} pts)
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rubric.criteria.map((criterion, criterionIndex) => (
                <TableRow key={criterionIndex} className="bg-white/50">
                  <TableCell className="border border-primary/20 p-2 align-top">
                    <p className="font-bold">{criterion.name}</p>
                    <p className="text-xs text-muted-foreground">{criterion.description}</p>
                  </TableCell>
                  {criterion.levels.map((level, levelIndex) => (
                    <TableCell key={levelIndex} className="border border-primary/20 p-2 text-sm align-top">
                      {level.description}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
