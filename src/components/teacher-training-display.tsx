
"use client";

import type { FC } from 'react';
import type { TeacherTrainingOutput } from "@/ai/flows/teacher-training";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, Lightbulb, Save } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

type TeacherTrainingDisplayProps = {
  advice: TeacherTrainingOutput;
};

export const TeacherTrainingDisplay: FC<TeacherTrainingDisplayProps> = ({ advice }) => {
    const { toast } = useToast();
    
    const handleSave = () => {
        toast({
            title: "Saved to Library",
            description: "This advice has been saved to your personal library.",
        });
    };

  return (
    <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
              <GraduationCap />
              Your Personalized Advice
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save to Library
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
    </Card>
  );
};
