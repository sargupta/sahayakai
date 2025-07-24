"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookText, Download, CheckCircle2, ListTree, TestTube2, ClipboardList } from 'lucide-react';
import type { FC } from 'react';
import type { LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";


type LessonPlanDisplayProps = {
  lessonPlan: LessonPlanOutput;
};

export const LessonPlanDisplay: FC<LessonPlanDisplayProps> = ({ lessonPlan }) => {
  const handleDownload = () => {
    const jsonString = JSON.stringify(lessonPlan, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lesson-plan.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!lessonPlan) {
    return null;
  }

  return (
    <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
          <BookText />
          {lessonPlan.title || 'Your Generated Lesson Plan'}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download JSON
        </Button>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" collapsible className="w-full" defaultValue={['Objectives', 'Activities']}>
          
          <AccordionItem value="Objectives">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary"/>
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
                  <ListTree className="h-5 w-5 text-primary"/>
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
                    <TestTube2 className="h-5 w-5 text-primary"/>
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
                    <ClipboardList className="h-5 w-5 text-primary"/>
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
