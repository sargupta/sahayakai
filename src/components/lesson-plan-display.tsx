"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookText, Download, CheckCircle2, ListTree, TestTube2, ClipboardList, Save, Share2 } from 'lucide-react';
import { FC, useState } from 'react';
import type { LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type LessonPlanDisplayProps = {
  lessonPlan: LessonPlanOutput;
};

export const LessonPlanDisplay: FC<LessonPlanDisplayProps> = ({ lessonPlan }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isShared, setIsShared] = useState(false);

  const {
    title = 'Your Generated Lesson Plan',
    objectives = [],
    materials = [],
    activities = [],
    assessment = '',
  } = lessonPlan || {};

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
            
            const pageHeight = Math.min(remainingHeight, canvasHeight * (pdfHeight / height));
            pageCanvas.height = pageHeight;

            const pageCtx = pageCanvas.getContext('2d');
            pageCtx?.drawImage(canvas, 0, position, canvasWidth, pageHeight, 0, 0, canvasWidth, pageHeight);

            const pageImgData = pageCanvas.toDataURL('image/png');
            
            if (position > 0) {
                pdf.addPage();
            }

            pdf.addImage(pageImgData, 'PNG', 0, 0, width, height * (pageHeight/canvasHeight));
            position += pageHeight;
            remainingHeight -= pageHeight;
        }

        pdf.save('lesson-plan.pdf');
      });
    }
  };

  const handleShare = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to share content.",
        variant: "destructive",
      });
      return;
    }

    try {
      await addDoc(collection(db, 'community'), {
        originalContentId: '', // This would be the ID of the content document
        contentType: 'lesson-plan',
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhotoURL: user.photoURL,
        topic: title,
        gradeLevels: [], // This should be populated from the lesson plan input
        language: '', // This should be populated from the lesson plan input
        likes: 0,
        shares: 0,
        createdAt: serverTimestamp(),
        content: lessonPlan,
      });
      toast({
        title: "Shared Successfully",
        description: "Your lesson plan is now available in the community library.",
      });
      setIsShared(true);
    } catch (error) {
      console.error("Error sharing content:", error);
      toast({
        title: "Sharing Failed",
        description: "There was an error sharing your lesson plan. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!lessonPlan) {
    return null;
  }

  return (
    <Card id="lesson-plan-pdf" className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
          <BookText />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
            
            <Button variant="outline" size="sm" onClick={handleShare} className="no-print" disabled={isShared}>
                <Share2 className="mr-2 h-4 w-4" />
                {isShared ? 'Shared' : 'Share'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="no-print">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full" defaultValue={['Objectives', 'Activities']}>
          
          <AccordionItem value="Objectives">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary"/>
                Objectives
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              <ul className="list-disc space-y-2">
                {objectives.map((objective, index) => (
                  <li key={index}>{objective}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="Materials">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                  <ListTree className="h-5 w-5 text-primary"/>
                  Materials
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              <ul className="list-disc space-y-2">
                {materials.map((material, index) => (
                  <li key={index}>{material}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Activities">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                <div className="flex items-center gap-2">
                    <TestTube2 className="h-5 w-5 text-primary"/>
                    Activities
                </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-4 pt-4">
              {activities.map((activity, index) => (
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
                    <ClipboardList className="h-5 w-5 text-primary"/>
                    Assessment
                </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pt-2 pl-4">
              <p>{assessment}</p>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </CardContent>
    </Card>
  );
};