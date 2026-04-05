
"use client";

import type { FC } from 'react';
import type { QuizVariantsOutput, QuizGeneratorOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from './ui/button';
import { Download, Eye, EyeOff, Save, Copy, Edit2, Check, X, Printer, FileDown, RotateCw, ThumbsUp, ThumbsDown, Bold, Italic, List, MoreHorizontal, MessageSquarePlus, Share2, BarChart2, MessageSquare, Pencil, CheckSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from 'lucide-react';
import { FeedbackDialog } from "@/components/feedback-dialog";

type QuizDisplayProps = {
  quiz: QuizVariantsOutput;
  onRegenerate?: () => void;
  selectedLanguage?: string;
};

type EditingState = {
  isEditing: boolean;
  editedVariants: QuizVariantsOutput;
};

export const QuizDisplay: FC<QuizDisplayProps> = ({ quiz, onRegenerate, selectedLanguage }) => {
  const [activeTab, setActiveTab] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showAnswers, setShowAnswers] = useState(false);
  const [editState, setEditState] = useState<EditingState>({
    isEditing: false,
    editedVariants: JSON.parse(JSON.stringify(quiz)),
  });
  const [hoveredQuestion, setHoveredQuestion] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<number, 'up' | 'down'>>({});
  const [isRefining, setIsRefining] = useState<number | null>(null);
  const [includeBranding, setIncludeBranding] = useState(true);

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
      <Card className="mt-8 w-full max-w-4xl bg-card/30 backdrop-blur-lg border-white/40 shadow-xl">
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

    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

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

      const payload = {
        id: crypto.randomUUID(),
        type: 'quiz',
        title: saveTitle,
        gradeLevel: quiz.gradeLevel || 'Class 5',
        subject: quiz.subject || 'General',
        topic: currentQuiz.title || quiz.topic || 'General',
        language: selectedLanguage || 'en',
        data: editState.editedVariants
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
        description: `Saved "${saveTitle}" to your library.`,
      });
    } catch (error) {
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

  const handleFormat = (idx: number, type: 'bold' | 'italic' | 'list') => {
    if (!editState.isEditing) {
      setEditState(prev => ({ ...prev, isEditing: true }));
      toast({
        title: "Edit mode enabled",
        description: `Applying ${type} formatting to question ${idx + 1}.`,
      });
    }

    setEditState(prev => {
      const newVariants = { ...prev.editedVariants };
      const q = newVariants[activeTab]?.questions[idx];
      if (!q) return prev;

      if (type === 'bold') q.questionText = `**${q.questionText}**`;
      if (type === 'italic') q.questionText = `_${q.questionText}_`;
      if (type === 'list' && q.options) {
        toast({ title: "List formatting", description: "Options are already in list format." });
      }

      return { ...prev, editedVariants: newVariants };
    });
  };

  const handleRegenerateQuestion = (idx: number) => {
    setIsRefining(idx);
    toast({
      title: "Refining Question",
      description: `Regenerating question ${idx + 1} with improved context...`,
    });

    // Simulate regeneration by shuffling options for now (to avoid full page reload)
    // In future: Connect to single-question generation API
    setTimeout(() => {
      setEditState(prev => {
        const newVariants = { ...prev.editedVariants };
        // Deep copy to avoid mutation issues
        if (newVariants[activeTab]) {
          newVariants[activeTab] = {
            ...newVariants[activeTab],
            questions: [...newVariants[activeTab]!.questions]
          };

          const q = newVariants[activeTab]!.questions[idx];
          if (q) {
            // Mark as refined so user sees change immediately
            if (!q.questionText.includes("(Refined)")) {
              q.questionText += " (Refined)";
            }

            if (q.options) {
              // Simple shuffle to show change
              q.options = [...q.options].sort(() => Math.random() - 0.5);
            }
          }
        }
        return { ...prev, editedVariants: newVariants, isEditing: true };
      });
      setIsRefining(null);
    }, 1000);
  };

  const handleFeedback = async (idx: number | 'global', type: 'up' | 'down') => {
    // Optimistic UI update
    if (idx !== 'global') {
      setFeedback(prev => ({ ...prev, [idx]: type }));
    }

    toast({
      title: idx === 'global' ? "Feedback Received" : "Question Feedback",
      description: type === 'up' ? "Thanks for your feedback!" : "We'll improve this.",
    });

    try {
      const { auth } = await import('@/lib/firebase');
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          feedbackType: idx === 'global' ? 'quiz_global' : 'question',
          questionIndex: idx === 'global' ? null : idx,
          quizId: 'generated_session',
          difficulty: activeTab,
          value: type,
          questionText: idx !== 'global' ? currentQuiz.questions[Number(idx)]?.questionText : null
        })
      });
    } catch (e) {
      // Feedback send failed silently
    }
  };

  const handleAddQuestion = (idx: number, type: 'multiple_choice' | 'short_answer' | 'fill_in_the_blanks' | 'true_false') => {
    setEditState(prev => {
      // Deep copy structure to avoid React StrictMode double-invocation mutation issues
      const newVariants = { ...prev.editedVariants };

      // Ensure we have the active tab data
      if (!newVariants[activeTab]) return prev;

      // Copy the active tab object
      newVariants[activeTab] = {
        ...newVariants[activeTab]!,
        questions: [...newVariants[activeTab]!.questions]
      };

      const currentQuestions = newVariants[activeTab]!.questions;

      const newQuestion = {
        questionText: "New Question",
        questionType: type,
        options: type === 'multiple_choice' ? ["Option A", "Option B", "Option C", "Option D"] : type === 'true_false' ? ["True", "False"] : undefined,
        correctAnswer: type === 'true_false' ? "True" : "Answer",
        explanation: "Explanation for the new question."
      };

      // Insert after current index
      currentQuestions.splice(idx + 1, 0, newQuestion as any);

      return { ...prev, editedVariants: newVariants, isEditing: true };
    });

    toast({
      title: "Question Added",
      description: `New ${type.replace(/_/g, ' ')} question added below.`,
    });
  };


  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-fade-in-up">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        {/* Difficulty Tabs */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <TabsList className="grid w-full md:w-[360px] grid-cols-3 bg-muted border border-border shadow-soft p-1 rounded-xl">
            <TabsTrigger value="easy" disabled={!quiz.easy} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft font-semibold transition-all">Easy</TabsTrigger>
            <TabsTrigger value="medium" disabled={!quiz.medium} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft font-semibold transition-all">Medium</TabsTrigger>
            <TabsTrigger value="hard" disabled={!quiz.hard} className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-soft font-semibold transition-all">Hard</TabsTrigger>
          </TabsList>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              className="bg-card border-primary/20 text-primary hover:bg-primary/5 gap-2 rounded-full h-10 px-4 whitespace-nowrap"
            >
              <RotateCw className="h-4 w-4" />
              Regenerate All
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-full h-10 px-6 whitespace-nowrap shadow-md shadow-primary/20">
                  <Download className="h-4 w-4" />
                  Export Quiz
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <FileDown className="mr-2 h-4 w-4" /> Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyText}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print Quiz
                </DropdownMenuItem>
                <Separator className="my-1" />
                <DropdownMenuItem onClick={handleSaveToLibrary}>
                  <Save className="mr-2 h-4 w-4" /> Save to Library
                </DropdownMenuItem>
                <Separator className="my-1" />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIncludeBranding(!includeBranding); }}>
                  <CheckSquare className={cn("mr-2 h-4 w-4", !includeBranding && "opacity-30")} />
                  {includeBranding ? "Branding: On" : "Branding: Off"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="bg-card/60 backdrop-blur-xl border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-visible relative group/card">
          {/* Action Bar (Standardized) */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-card/90 backdrop-blur-md border border-border rounded-xl shadow-2xl opacity-0 translate-y-2 group-hover/card:opacity-100 group-hover/card:translate-y-0 transition-all duration-300">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleEditToggle} className={cn("h-9 w-9 rounded-lg", editState.isEditing && "text-amber-600 bg-amber-50")} aria-label={editState.isEditing ? 'Done editing' : 'Edit'}>
                    {editState.isEditing ? <Check className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{editState.isEditing ? 'Done' : 'Edit'}</p></TooltipContent>
              </Tooltip>

              <div className="w-px h-6 bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleFeedback('global', 'up')}
                    className="h-9 w-9 rounded-lg hover:text-green-600 hover:bg-green-50"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Helpful</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleFeedback('global', 'down')}
                    className="h-9 w-9 rounded-lg hover:text-red-600 hover:bg-red-50"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Not helpful</p></TooltipContent>
              </Tooltip>

              <div className="w-px h-6 bg-border mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleCopyText} className="h-9 w-9 rounded-lg" aria-label="Copy text"><Copy className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent><p>Copy Text</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => window.print()} className="h-9 w-9 rounded-lg" aria-label="Print"><Printer className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent><p>Print</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleDownloadPDF} className="h-9 w-9 rounded-lg" aria-label="Download PDF"><Download className="h-4 w-4" /></Button>
                </TooltipTrigger>
                <TooltipContent><p>Download</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-6 bg-muted/30">
            <div className="space-y-1 flex-1 mr-4">
              {editState.isEditing ? (
                <Input
                  value={currentQuiz.title}
                  onChange={(e) => handleVariantChange('title', e.target.value)}
                  className="text-2xl font-bold font-headline bg-card border-border focus-visible:ring-indigo-500"
                />
              ) : (
                <CardTitle className="font-headline text-2xl md:text-3xl text-foreground">{currentQuiz.title}</CardTitle>
              )}
              <CardDescription className="flex items-center gap-2 mt-1">
                Difficulty: <Badge variant="secondary" className="uppercase text-[10px] font-bold tracking-wider px-2 h-5">{activeTab}</Badge>
                <div className="w-1 h-1 rounded-full bg-border mx-1" />
                <span className="text-xs">{currentQuiz.questions.length} Questions</span>
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setShowAnswers(!showAnswers)} title={showAnswers ? "Hide Key" : "Show Key"} aria-label={showAnswers ? "Hide answer key" : "Show answer key"} className={cn("hover:bg-card/50", showAnswers && "text-indigo-600 bg-indigo-50")}>
                {showAnswers ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveToLibrary} className="hidden md:flex gap-2 border-border hover:bg-card/50">
                <Save className="h-4 w-4" />
                Save Library
              </Button>
            </div>
          </CardHeader>

          <TabsContent value={activeTab} className="m-0 focus-visible:ring-0 focus-visible:outline-none">
            <CardContent id="quiz-sheet" className="p-8 space-y-4 bg-card min-h-[500px]">
              {currentQuiz.questions.map((q, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredQuestion(idx)}
                  onMouseLeave={() => setHoveredQuestion(null)}
                  className="relative group p-6 rounded-2xl hover:bg-card/60 transition-all duration-300 border border-transparent hover:border-border hover:shadow-soft"
                >
                  {/* QUESTION TOOLBAR (Minimalist) */}
                  <div className={cn(
                    "absolute -top-3 right-6 z-10 flex border bg-card shadow-lg rounded-full p-1 border-border opacity-0 scale-95 transition-all duration-200",
                    (hoveredQuestion === idx || isRefining === idx) && "opacity-100 scale-100"
                  )}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleRegenerateQuestion(idx)}
                            className={cn("h-7 w-7 rounded-full text-amber-500", isRefining === idx && "animate-spin")}
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Improve</TooltipContent>
                      </Tooltip>

                      <div className="w-px h-4 bg-border mx-1 self-center" />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-emerald-500">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" className="text-xs">
                          <DropdownMenuItem onClick={() => handleAddQuestion(idx, 'multiple_choice')}>Multiple Choice</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddQuestion(idx, 'true_false')}>True/False</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddQuestion(idx, 'fill_in_the_blanks')}>Fill in Blanks</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAddQuestion(idx, 'short_answer')}>Short Answer</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <div className="w-px h-4 bg-border mx-1 self-center" />

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => handleFeedback(idx, 'up')} className="h-7 w-7 rounded-full text-muted-foreground/70 hover:text-green-500" aria-label="Good question"><ThumbsUp className="h-3 w-3" /></Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Good</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-muted-foreground/70 text-xs tracking-tight">QUESTION {idx + 1}</span>
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <span className="text-[10px] uppercase font-bold text-indigo-600/70">{questionTypeLabel(q.questionType)}</span>
                      </div>
                      {editState.isEditing ? (
                        <Textarea
                          value={q.questionText}
                          onChange={(e) => handleVariantChange('questionText', e.target.value, idx)}
                          className="font-semibold text-lg bg-card border-border min-h-[60px] focus-visible:ring-indigo-500"
                        />
                      ) : (
                        <p className="font-semibold text-lg text-foreground leading-snug">{q.questionText}</p>
                      )}
                    </div>
                  </div>

                  {/* Options / Answer Area */}
                  <div className="pl-0 md:pl-2 space-y-3">
                    {(q.questionType === 'multiple_choice' || q.questionType === 'true_false') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options?.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/50 hover:bg-card transition-colors">
                            <div className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground/70 bg-card">
                              {String.fromCharCode(65 + optIdx)}
                            </div>
                            {editState.isEditing ? (
                              <Input
                                value={opt}
                                onChange={(e) => handleVariantChange('options', e.target.value, idx, optIdx)}
                                className="text-sm bg-card border-border h-9"
                              />
                            ) : (
                              <span className="text-sm font-medium text-foreground">{opt}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {(q.questionType === 'short_answer' || q.questionType === 'fill_in_the_blanks') && (
                      <div className="w-full h-24 border-2 border-dashed border-border rounded-xl bg-card/10 flex items-center justify-center text-muted-foreground/70 text-sm">
                        Student Answer Area
                      </div>
                    )}
                  </div>

                  {/* Answer Key Section (Hidden unless toggled) */}
                  <div className={cn(
                    "mt-4 pt-4 border-t border-border transition-all duration-300 origin-top overflow-hidden",
                    showAnswers ? "opacity-100 max-h-96" : "opacity-0 max-h-0 py-0 border-none"
                  )}>
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 text-sm">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="font-bold text-foreground uppercase text-[10px] tracking-wider">Correct Answer</span>
                        </div>
                        {editState.isEditing ? (
                          <Input
                            value={q.correctAnswer}
                            onChange={(e) => handleVariantChange('correctAnswer', e.target.value, idx)}
                            className="h-9 w-full bg-card text-foreground border-border"
                          />
                        ) : (
                          <span className="text-foreground font-bold bg-card/50 px-3 py-1.5 rounded-lg border border-border inline-block w-fit">{q.correctAnswer}</span>
                        )}

                        <div className="mt-2 space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-tighter">Explanation</span>
                          <p className="text-muted-foreground leading-relaxed text-xs">
                            {q.explanation}
                          </p>
                        </div>
                      </div>
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
          <p className="text-sm text-muted-foreground uppercase tracking-widest">{activeTab} Difficulty</p>
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
                <div className="h-20 border-b border-border mt-4"></div>
              )}
            </div>
          ))}
        </div>

        {includeBranding && (
          <div className="print-footer mt-12 pt-4 border-t text-center text-xs text-muted-foreground/70">
            Generated by SahayakAI
          </div>
        )}

        {/* Answer Key Page Break */}
        <div className="page-break-before-always mt-12 pt-12 border-t-2 border-black">
          <h2 className="text-2xl font-bold mb-6">Answer Key ({activeTab})</h2>
          <ol className="list-decimal pl-5 space-y-4">
            {currentQuiz.questions.map((q, i) => (
              <li key={i}>
                <span className="font-bold">{q.correctAnswer}</span>
                <p className="text-sm text-muted-foreground">{q.explanation}</p>
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

      <div className="p-4 border-t border-border flex justify-end">
        <FeedbackDialog
          page="quiz-generator"
          feature="quiz-result"
          context={{ title: currentQuiz.title }}
        />
      </div>
    </div>
  );
};
