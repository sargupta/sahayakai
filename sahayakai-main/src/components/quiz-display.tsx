
"use client";

import type { FC } from 'react';
import type { QuizVariantsOutput, QuizGeneratorOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from './ui/button';
import { Download, Eye, EyeOff, Save, Copy, Edit2, Check, X, Printer, FileDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type QuizDisplayProps = {
  quiz: QuizVariantsOutput;
};

type EditingState = {
  isEditing: boolean;
  editedVariants: QuizVariantsOutput;
};

export const QuizDisplay: FC<QuizDisplayProps> = ({ quiz }) => {
  const [activeTab, setActiveTab] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAnswers, setShowAnswers] = useState(false);
  const [editState, setEditState] = useState<EditingState>({
    isEditing: false,
    editedVariants: JSON.parse(JSON.stringify(quiz)), // Deep copy for editing
  });

  const { toast } = useToast();

  // Reset local state when prop changes
  useEffect(() => {
    setEditState({
      isEditing: false,
      editedVariants: JSON.parse(JSON.stringify(quiz))
    });
    // Default to medium if available, else first available
    if (quiz.medium) setActiveTab('medium');
    else if (quiz.easy) setActiveTab('easy');
    else if (quiz.hard) setActiveTab('hard');
  }, [quiz]);

  const currentQuiz = editState.editedVariants[activeTab];

  if (!currentQuiz) {
    return (
      <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardContent className="p-8 text-center text-muted-foreground">
          No quiz generated for this difficulty level.
        </CardContent>
      </Card>
    );
  }

  const handleEditToggle = () => {
    if (editState.isEditing) {
      // Saving - currently just keeps local state active. 
      // In a real app we might patch back to prop or persist immediately.
      toast({
        title: "Edits Enabled",
        description: "You are in edit mode. Changes will be reflected in downloads.",
      });
    }
    setEditState(prev => ({ ...prev, isEditing: !prev.isEditing }));
  };

  const handleVariantChange = (field: string, value: any, questionIndex?: number, optionIndex?: number) => {
    setEditState(prev => {
      const newVariants = { ...prev.editedVariants };
      const currentVariant = newVariants[activeTab];
      if (!currentVariant) return prev;

      if (questionIndex !== undefined) {
        // Editing a specific question
        const question = currentVariant.questions[questionIndex];
        if (optionIndex !== undefined && question.options) {
          // Editing an option
          question.options[optionIndex] = value;
        } else {
          // Editing question text or answer
          (question as any)[field] = value;
        }
      } else {
        // Editing top-level fields like title
        (currentVariant as any)[field] = value;
      }

      return { ...prev, editedVariants: newVariants };
    });
  };


  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-area');
    if (!element) return;

    // Temporarily make it visible for capture
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    element.classList.remove('hidden'); // Ensure tailwind hidden class doesn't block it

    try {
      toast({
        title: "Generating PDF...",
        description: "Please wait while we prepare your quiz.",
      });

      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const variantTitle = currentQuiz.title || 'Quiz';
      const cleanTitle = `${variantTitle}_${activeTab}`.replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Sahayak_Quiz_${cleanTitle}.pdf`);

      toast({
        title: "Download Complete",
        description: "Your quiz PDF has been downloaded.",
      });

    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      // Restore hidden state
      element.style.display = originalDisplay;
      element.classList.add('hidden');
    }
  };

  const handleSaveToLibrary = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      let user = auth.currentUser;

      if (!user) {
        toast({ title: "Login Required", description: "Please login to save quizzes.", variant: "destructive" });
        return;
      }

      const saveTitle = currentQuiz.title || 'General Quiz';

      // We save the ENTIRE multi-variant object, not just the active one, 
      // so the user retains all difficulty levels.
      const payload = {
        id: crypto.randomUUID(),
        type: 'quiz',
        title: saveTitle,
        gradeLevel: quiz.gradeLevel || 'Class 5',
        subject: quiz.subject || 'General',
        topic: currentQuiz.title || quiz.topic || 'General',
        language: 'English',
        isPublic: false,
        isDraft: false,
        data: editState.editedVariants // Save the EDITED version
      };

      const token = await user.getIdToken();
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
        description: `Saved "${saveTitle}" (All Variants) to your library.`,
      });
    } catch (error) {
      console.error("Save Error:", error);
      toast({ title: "Save Failed", variant: "destructive", description: "Could not save quiz." });
    }
  };

  const handleCopyText = () => {
    const text = `
${currentQuiz.title} (${activeTab.toUpperCase()})

${currentQuiz.questions.map((q, i) => `
Q${i + 1}. ${q.questionText}
${q.options ? q.options.map((o, j) => `   ${String.fromCharCode(97 + j)}) ${o}`).join('\n') : ''}
${showAnswers ? `\nAnswer: ${q.correctAnswer}\nExplanation: ${q.explanation}` : ''}
`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Quiz copied to clipboard." });
  };


  const questionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'Multiple Choice';
      case 'fill_in_the_blanks': return 'Fill in the Blanks';
      case 'short_answer': return 'Short Answer';
      case 'true_false': return 'True/False';
      default: return (type || 'Question').replace(/_/g, ' ');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-fade-in-up">
      {/* Difficulty Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="grid w-[400px] grid-cols-3 bg-white/50 backdrop-blur-sm shadow-sm">
            <TabsTrigger value="easy" disabled={!quiz.easy} className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">Easy</TabsTrigger>
            <TabsTrigger value="medium" disabled={!quiz.medium} className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">Medium</TabsTrigger>
            <TabsTrigger value="hard" disabled={!quiz.hard} className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-800">Hard</TabsTrigger>
          </TabsList>

          {/* Global Actions */}
          <div className="flex gap-2">
            <Button
              variant={editState.isEditing ? "default" : "outline"}
              size="sm"
              onClick={handleEditToggle}
              className={editState.isEditing ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600" : ""}
            >
              {editState.isEditing ? <Check className="mr-2 h-4 w-4" /> : <Edit2 className="mr-2 h-4 w-4" />}
              {editState.isEditing ? "Done Editing" : "Edit Quiz"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAnswers(!showAnswers)}>
              {showAnswers ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showAnswers ? 'Hide Key' : 'Show Key'}
            </Button>
          </div>
        </div>

        <Card className="bg-white/40 backdrop-blur-md border-white/50 shadow-xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/20 pb-6 bg-white/20">
            <div className="space-y-1 flex-1 mr-4">
              {editState.isEditing ? (
                <Input
                  value={currentQuiz.title}
                  onChange={(e) => handleVariantChange('title', e.target.value)}
                  className="text-2xl font-bold font-headline bg-white/80 border-amber-300 focus-visible:ring-amber-400"
                />
              ) : (
                <CardTitle className="font-headline text-2xl md:text-3xl text-gray-800">{currentQuiz.title}</CardTitle>
              )}
              <CardDescription>
                Difficulty: <Badge variant="outline" className="ml-2 uppercase text-xs">{activeTab}</Badge>
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleCopyText} title="Copy Text">
                <Copy className="h-5 w-5 text-gray-600" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSaveToLibrary} title="Save to Library">
                <Save className="h-5 w-5 text-gray-600" />
              </Button>
              <Button variant="default" size="sm" onClick={handleDownloadPDF} className="bg-slate-800 text-white hover:bg-slate-700">
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardHeader>

          <TabsContent value={activeTab} className="m-0 focus-visible:ring-0 focus-visible:outline-none">
            <CardContent id="quiz-sheet" className="p-8 space-y-8 bg-white/40 min-h-[500px]">
              {currentQuiz.questions.map((q, idx) => (
                <div key={idx} className="relative group p-4 rounded-xl hover:bg-white/40 transition-colors border border-transparent hover:border-white/40">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-500 text-sm">Q{idx + 1}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">{questionTypeLabel(q.questionType)}</Badge>
                      </div>
                      {editState.isEditing ? (
                        <Textarea
                          value={q.questionText}
                          onChange={(e) => handleVariantChange('questionText', e.target.value, idx)}
                          className="font-semibold text-lg bg-white/80 border-amber-300 min-h-[60px]"
                        />
                      ) : (
                        <p className="font-semibold text-lg text-gray-800">{q.questionText}</p>
                      )}
                    </div>
                  </div>

                  {/* Options / Answer Area */}
                  <div className="pl-0 md:pl-8 space-y-3">
                    {(q.questionType === 'multiple_choice' || q.questionType === 'true_false') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200/60 bg-white/30">
                            <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400">
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            {editState.isEditing ? (
                              <Input
                                value={opt}
                                onChange={(e) => handleVariantChange('options', e.target.value, idx, optIdx)}
                                className="text-sm bg-white/80 border-amber-300 h-8"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-700">{opt}</span>
                            )}
                          </div>
                        ))}
                        {/* True/False manual handling if opt array is missing, though schema usually has them */}
                      </div>
                    )}

                    {(q.questionType === 'short_answer' || q.questionType === 'fill_in_the_blanks') && (
                      <div className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 text-sm">
                        Student Answer Area
                      </div>
                    )}
                  </div>

                  {/* Answer Key Section (Hidden unless toggled) */}
                  <div className={cn(
                    "mt-4 pt-4 border-t border-gray-200/50 transition-all duration-300 origin-top",
                    showAnswers ? "opacity-100 max-h-40" : "opacity-0 max-h-0 overflow-hidden py-0 border-none"
                  )}>
                    <div className="bg-green-50/80 p-3 rounded-lg border border-green-100 text-sm">
                      <div className="flex gap-2 mb-1">
                        <span className="font-bold text-green-700">Correct Answer:</span>
                        {editState.isEditing ? (
                          <Input
                            value={q.correctAnswer}
                            onChange={(e) => handleVariantChange('correctAnswer', e.target.value, idx)}
                            className="h-6 w-full max-w-xs bg-white text-green-800 border-green-200"
                          />
                        ) : (
                          <span className="text-green-800 font-medium">{q.correctAnswer}</span>
                        )}
                      </div>
                      <p className="text-green-600/80 italic text-xs">
                        Explanation: {q.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </TabsContent>
        </Card>
      </Tabs>

      {/* Hidden Print Structure */}
      <div id="print-area" className="hidden print:block">
        <div className="print-header mb-8 text-center border-b pb-4">
          <h1 className="text-3xl font-bold">{currentQuiz.title}</h1>
          <p className="text-sm text-gray-500 uppercase tracking-widest">{activeTab} Difficulty</p>
        </div>

        <div className="print-questions space-y-8">
          {currentQuiz.questions.map((q, i) => (
            <div key={i} className="break-inside-avoid">
              <p className="font-bold text-lg mb-2">{i + 1}. {q.questionText}</p>
              {q.options && (
                <ul className="grid grid-cols-2 gap-4 pl-4">
                  {q.options.map((o, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <span className="w-6 h-6 border rounded-full inline-block"></span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              )}
              {(!q.options) && (
                <div className="h-20 border-b border-gray-300 mt-4"></div>
              )}
            </div>
          ))}
        </div>

        <div className="print-footer mt-12 pt-4 border-t text-center text-xs text-gray-400">
          Generated by SahayakAI
        </div>

        {/* Answer Key Page Break */}
        <div className="page-break-before-always mt-12 pt-12 border-t-2 border-black">
          <h2 className="text-2xl font-bold mb-6">Answer Key ({activeTab})</h2>
          <ol className="list-decimal pl-5 space-y-4">
            {currentQuiz.questions.map((q, i) => (
              <li key={i}>
                <span className="font-bold">{q.correctAnswer}</span>
                <p className="text-sm text-gray-600">{q.explanation}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <style jsx global>{`
          @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 100%; 
                padding: 2rem;
            }
            .page-break-before-always { page-break-before: always; }
          }
        `}</style>
    </div>
  );
};
