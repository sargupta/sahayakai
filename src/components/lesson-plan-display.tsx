"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookText } from 'lucide-react';
import type { FC, ReactNode } from 'react';

type LessonPlanDisplayProps = {
  lessonPlan: string;
};

// Helper to parse markdown-like content into sections
const parseLessonPlan = (text: string): { title: string; content: ReactNode[] }[] => {
  if (!text) return [];
  const sections = text.split(/\n(?=##\s)/).map(s => s.trim());
  
  return sections.map((section, index) => {
    const lines = section.split('\n');
    const title = lines[0].replace('##', '').trim();
    const content = lines.slice(1).map((line, i) => {
      line = line.trim();
      if (line.startsWith('* ')) {
        return <li key={i} className="ml-4 list-disc">{line.substring(2)}</li>;
      }
      if (line === '') return null;
      return <p key={i} className="mb-2">{line}</p>;
    });
    
    return { title: title || `Section ${index + 1}`, content: content.filter(c => c !== null) };
  }).filter(s => s.title && s.content.length > 0);
};

export const LessonPlanDisplay: FC<LessonPlanDisplayProps> = ({ lessonPlan }) => {
  const sections = parseLessonPlan(lessonPlan);

  if (sections.length === 0) {
    return (
      <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center gap-2">
            <BookText />
            Your Lesson Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">The generated lesson plan is in an unstructured format. Here is the raw output:</p>
          <pre className="mt-4 whitespace-pre-wrap text-sm font-code bg-black/10 p-4 rounded-md">{lessonPlan}</pre>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
          <BookText />
          Your Generated Lesson Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full" defaultValue={sections[0]?.title}>
          {sections.map(({ title, content }) => (
            <AccordionItem value={title} key={title} className="border-b border-primary/20">
              <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
                {title}
              </AccordionTrigger>
              <AccordionContent className="text-foreground/80 space-y-2">
                {content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};
