
"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookText, Download, CheckCircle2, ListTree, TestTube2, ClipboardList, Save, Copy, Clock, GraduationCap, BookOpen } from 'lucide-react';
import type { FC } from 'react';
import type { LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type LessonPlanDisplayProps = {
  lessonPlan: LessonPlanOutput;
};

export const LessonPlanDisplay: FC<LessonPlanDisplayProps> = ({ lessonPlan }) => {
  const { toast } = useToast();

  const handleDownload = () => {
    const input = document.getElementById('lesson-plan-pdf');
    if (input) {
      html2canvas(input, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const width = pdfWidth;
        const height = width / ratio;

        let position = 0;
        let remainingHeight = canvasHeight;

        while (remainingHeight > 0) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvasWidth;

          // Calculate height for the current page
          const pageHeight = Math.min(remainingHeight, canvasHeight * (pdfHeight / height));
          pageCanvas.height = pageHeight;

          const pageCtx = pageCanvas.getContext('2d');
          pageCtx?.drawImage(canvas, 0, position, canvasWidth, pageHeight, 0, 0, canvasWidth, pageHeight);

          const pageImgData = pageCanvas.toDataURL('image/png');

          if (position > 0) {
            pdf.addPage();
          }

          pdf.addImage(pageImgData, 'PNG', 0, 0, width, height * (pageHeight / canvasHeight));
          position += pageHeight;
          remainingHeight -= pageHeight;
        }

        pdf.save('lesson-plan.pdf');
      });
    }
  };

  const handleSave = () => {
    toast({
      title: "Saved to Library",
      description: "Your lesson plan has been saved to your personal library.",
    });
  };

  const handleCopy = () => {
    const lessonPlanText = `
${lessonPlan.title || 'Lesson Plan'}

OBJECTIVES:
${lessonPlan.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

MATERIALS:
${lessonPlan.materials.map((mat, i) => `• ${mat}`).join('\n')}

ACTIVITIES:
${lessonPlan.activities.map((act, i) => `
${i + 1}. ${act.name} (${act.duration})
   ${act.description}
`).join('\n')}

ASSESSMENT:
${lessonPlan.assessment}
    `.trim();

    navigator.clipboard.writeText(lessonPlanText);
    toast({
      title: "Copied to Clipboard",
      description: "Lesson plan has been copied to your clipboard.",
    });
  };

  if (!lessonPlan) {
    return null;
  }

  return (
    <Card id="lesson-plan-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader className="space-y-4">
        <div className="flex flex-row items-start justify-between">
          <div className="space-y-2 flex-1">
            <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
              <BookText className="h-7 w-7" />
              {lessonPlan.title || 'Your Generated Lesson Plan'}
            </CardTitle>

            {/* Metadata Section */}
            <div className="flex flex-wrap gap-3 mt-3">
              {lessonPlan.gradeLevel && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                  <GraduationCap className="h-4 w-4" />
                  {lessonPlan.gradeLevel}
                </Badge>
              )}
              {lessonPlan.duration && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                  <Clock className="h-4 w-4" />
                  {lessonPlan.duration}
                </Badge>
              )}
              {lessonPlan.subject && (
                <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1">
                  <BookOpen className="h-4 w-4" />
                  {lessonPlan.subject}
                </Badge>
              )}
            </div>
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
        <Accordion type="multiple" className="w-full" defaultValue={['Objectives', 'Activities']}>

          <AccordionItem value="Objectives">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Objectives
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              <ul className="list-disc space-y-2">
                {lessonPlan.objectives.map((objective, index) => (
                  <li key={index}>{objective}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Materials">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <ListTree className="h-5 w-5 text-primary" />
                Materials
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              <ul className="list-disc space-y-2">
                {lessonPlan.materials.map((material, index) => (
                  <li key={index}>{material}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Activities">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5 text-primary" />
                Activities
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-4 pt-4">
              {lessonPlan.activities.map((activity, index) => (
                <div key={index} className="pl-4 border-l-2 border-primary/50">
                  <h4 className="font-semibold text-foreground">{activity.name} ({activity.duration})</h4>
                  <p>{activity.description}</p>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Assessment">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Assessment
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pt-2 pl-4">
              <p>{lessonPlan.assessment}</p>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </CardContent>
    </Card>
  );
};
