
"use client";

import type { FC } from 'react';
import type { QuizGeneratorOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Download, Eye, EyeOff, Save } from 'lucide-react';
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

  const handleDownload = async () => {
    const quizElement = document.getElementById('quiz-sheet');
    const answersElement = document.getElementById('answer-key-sheet');

    if (quizElement && answersElement) {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // --- Process Quiz Sheet ---
        const quizCanvas = await html2canvas(quizElement, { scale: 2 });
        const quizImgData = quizCanvas.toDataURL('image/png');
        const quizCanvasRatio = quizCanvas.width / quizCanvas.height;
        let quizPdfWidth = pdfWidth - 20;
        let quizPdfHeight = quizPdfWidth / quizCanvasRatio;
        if (quizPdfHeight > pdfHeight - 20) {
            quizPdfHeight = pdfHeight - 20;
            quizPdfWidth = quizPdfHeight * quizCanvasRatio;
        }
        pdf.text(quiz.title, 10, 10);
        pdf.addImage(quizImgData, 'PNG', 10, 20, quizPdfWidth, quizPdfHeight);

        // --- Process Answer Key Sheet ---
        pdf.addPage();
        const answersCanvas = await html2canvas(answersElement, { scale: 2 });
        const answersImgData = answersCanvas.toDataURL('image/png');
        const answersCanvasRatio = answersCanvas.width / answersCanvas.height;
        let answersPdfWidth = pdfWidth - 20;
        let answersPdfHeight = answersPdfWidth / answersCanvasRatio;
        if (answersPdfHeight > pdfHeight - 20) {
            answersPdfHeight = pdfHeight - 20;
            answersPdfWidth = answersPdfHeight * answersCanvasRatio;
        }
        pdf.text("Answer Key", 10, 10);
        pdf.addImage(answersImgData, 'PNG', 10, 20, answersPdfWidth, answersPdfHeight);

        pdf.save(`${quiz.title.replace(/\s/g, '_')}_quiz.pdf`);
    }
  };
  
  const handleSave = () => {
    toast({
        title: "Saved to Library",
        description: "Your quiz has been saved to your personal library.",
    });
  };


  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return null;
  }

  const questionTypeLabel = (type: string) => {
    switch(type) {
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
          <CardTitle className="font-headline text-2xl">{quiz.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAnswers(!showAnswers)}>
              {showAnswers ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showAnswers ? 'Hide Answers' : 'Show Answers'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
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
       <div id="answer-key-sheet" className="absolute -left-[9999px] top-auto p-4 bg-white" style={{ width: '800px'}}>
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
