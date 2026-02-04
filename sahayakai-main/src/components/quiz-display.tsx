
"use client";

import type { FC } from 'react';
import type { QuizGeneratorOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Download, Eye, EyeOff, Save, Copy } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useState } from 'react';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';

type QuizDisplayProps = {
  quiz: QuizGeneratorOutput;
};

export const QuizDisplay: FC<QuizDisplayProps> = ({ quiz }) => {
  const [showAnswers, setShowAnswers] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    // Better Naming for PDF
    const originalTitle = document.title;
    const cleanTitle = (quiz.title || 'Quiz').replace(/[^a-z0-9]/gi, '_');
    const filename = `Sahayak_Quiz_${cleanTitle}`;

    document.title = filename; // Sets the default filename in Print Dialog
    window.print();

    // Restore title after a small delay
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);

    toast({
      title: "Print to PDF",
      description: "Select 'Save as PDF'. Both the quiz and answer key are included.",
    });
  };

  const handleSave = () => {
    toast({
      title: "Saved to Library",
      description: "Your quiz has been saved to your personal library.",
    });
  };

  const handleCopy = () => {
    const quizText = `
${quiz.title}

${quiz.questions.map((q, idx) => `
Question ${idx + 1}: ${q.questionText}
Type: ${questionTypeLabel(q.questionType)}
${q.options ? `Options:\n${q.options.map((opt, i) => `  ${String.fromCharCode(97 + i)}) ${opt}`).join('\n')}` : ''}
Answer: ${q.correctAnswer}
`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(quizText);
    toast({
      title: "Copied to Clipboard",
      description: "Quiz has been copied to your clipboard.",
    });
  };


  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return null;
  }

  const questionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'Multiple Choice';
      case 'fill_in_the_blanks': return 'Fill in the Blanks';
      case 'short_answer': return 'Short Answer';
      default: return '';
    }
  }

  return (
    <>
      <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-headline text-2xl md:text-3xl">{quiz.title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAnswers(!showAnswers)}>
              {showAnswers ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showAnswers ? 'Hide' : 'Show'}
            </Button>
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
        <CardContent id="quiz-sheet" className="p-6 text-foreground">
          <div className="space-y-6">
            {quiz.questions.map((q, index) => (
              <div key={index}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold">{index + 1}. {q.questionText}</p>
                  <Badge variant="secondary">{questionTypeLabel(q.questionType)}</Badge>
                </div>
                {q.questionType === 'multiple_choice' && (
                  <ul className="pl-6 space-y-2 list-alpha">
                    {q.options?.map((opt, i) => <li key={i}>{opt}</li>)}
                  </ul>
                )}
                {q.questionType === 'true_false' && (
                  <ul className="pl-6 space-y-2 list-alpha">
                    <li>True</li>
                    <li>False</li>
                  </ul>
                )}
                {(q.questionType === 'short_answer' || q.questionType === 'fill_in_the_blanks') && (
                  <div className="mt-2 pl-6">
                    <div className="border-b border-dashed border-gray-400 h-8 w-full"></div>
                  </div>
                )}
                <div className={cn("mt-2 pl-6 transition-opacity", showAnswers ? "opacity-100" : "opacity-0 h-0 overflow-hidden")}>
                  <p className="text-sm text-green-700 font-bold">Answer: <span className="font-medium">{q.correctAnswer}</span></p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Hidden div for PDF generation of answer key */}
      <div id="answer-key-sheet" className="absolute -left-[9999px] top-auto p-4 bg-white" style={{ width: '800px' }}>
        <h2 className="text-xl font-bold mb-4">{quiz.title} - Answer Key</h2>
        <ol className="list-decimal list-inside space-y-2">
          {quiz.questions.map((q, index) => (
            <li key={index}>
              <span className="font-semibold">{q.questionText}</span>
              <br />
              <span className="text-green-700">Correct Answer: {q.correctAnswer}</span>
            </li>
          ))}
        </ol>
      </div>
      <style jsx global>{`
          .list-alpha {
            list-style-type: lower-alpha;
          }
        `}</style>
    </>
  );
};
