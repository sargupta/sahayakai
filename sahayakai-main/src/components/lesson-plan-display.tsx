
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
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, X, Save as SaveIcon } from 'lucide-react'; // Removing ThumbsUp/Down imports if they conflict or keep if reusable icons
import { FeedbackDialog } from "@/components/feedback-dialog";

type LessonPlanDisplayProps = {
  lessonPlan: LessonPlanOutput;
};

export const LessonPlanDisplay: FC<LessonPlanDisplayProps> = ({ lessonPlan }) => {
  const { toast } = useToast();
  const [editablePlan, setEditablePlan] = useState(lessonPlan);
  const [isEditing, setIsEditing] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    setEditablePlan(lessonPlan);
  }, [lessonPlan]);

  const handleSaveEdit = () => {
    setIsEditing(false);
    toast({
      title: "Changes Saved",
      description: "Your edits have been applied to the view.",
    });
  };

  const handleFeedback = async (rating: 'thumbs-up' | 'thumbs-down') => {
    await submitFeedback(lessonPlan.title, rating);
    setFeedbackSubmitted(true);
    toast({
      title: "Feedback Recorded",
      description: "Thank you for helping us improve!",
    });
  };

  const handleCancelEdit = () => {
    setEditablePlan(lessonPlan);
    setIsEditing(false);
  };

  const handleDownload = () => {
    // Better Naming for PDF
    const originalTitle = document.title;
    const cleanTitle = (lessonPlan.title || 'Lesson Plan').replace(/[^a-z0-9]/gi, '_');
    const filename = `Sahayak_Lesson_${cleanTitle}_${lessonPlan.gradeLevel || ''}`;

    document.title = filename; // Sets the default filename in Print Dialog
    window.print();

    // Restore title after a small delay (to ensure print dialog picks it up)
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);

    toast({
      title: "Print to PDF",
      description: "Select 'Save as PDF' to save.",
    });
  };

  const handleSave = async () => {
    try {
      const { auth, db } = await import('@/lib/firebase');
      const { signInAnonymously } = await import('firebase/auth');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

      let user = auth.currentUser;
      if (!user) {
        const userCred = await signInAnonymously(auth);
        user = userCred.user;
      }

      // meaningful title for the DB entry
      const saveTitle = lessonPlan.title && lessonPlan.title !== 'Lesson Plan'
        ? lessonPlan.title
        : `${lessonPlan.subject || 'General'} Lesson - ${lessonPlan.gradeLevel || 'Unspecified'}`;

      await addDoc(collection(db, 'content'), {
        userId: user.uid,
        type: 'lesson-plan',
        title: saveTitle,
        data: lessonPlan,
        createdAt: serverTimestamp(),
        gradeLevel: lessonPlan.gradeLevel,
        subject: lessonPlan.subject
      });

      toast({
        title: "Saved to Library",
        description: `Saved as "${saveTitle}"`,
      });
    } catch (error) {
      console.error("Save Error:", error);
      toast({
        title: "Save Failed",
        description: "Could not save to library. Please try again.",
        variant: "destructive"
      });
    }
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
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancelEdit} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
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
              </>
            )}
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
              {isEditing ? (
                <Textarea
                  value={editablePlan.objectives.join('\n')}
                  onChange={(e) => setEditablePlan({ ...editablePlan, objectives: e.target.value.split('\n') })}
                  className="min-h-[150px]"
                  placeholder="Enter objectives (one per line)"
                />
              ) : (
                <ul className="list-disc space-y-2">
                  {editablePlan.objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="Materials">
            <AccordionTrigger className="font-headline text-lg hover:no-underline text-left">
              <div className="flex items-center gap-2">
                <ListTree className="h-5 w-5 text-primary" />
                Materials Needed
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-foreground/80 space-y-2 pl-8">
              {isEditing ? (
                <Textarea
                  value={editablePlan.materials.join('\n')}
                  onChange={(e) => setEditablePlan({ ...editablePlan, materials: e.target.value.split('\n') })}
                  className="min-h-[100px]"
                  placeholder="Enter materials (one per line)"
                />
              ) : (
                <ul className="list-disc space-y-2">
                  {editablePlan.materials.map((material, index) => (
                    <li key={index}>{material}</li>
                  ))}
                </ul>
              )}
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
              {editablePlan.activities.map((activity, index) => (
                <div key={index} className="pl-4 border-l-2 border-primary/50 space-y-2">
                  {isEditing ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={activity.name}
                          onChange={(e) => {
                            const newActivities = [...editablePlan.activities];
                            newActivities[index] = { ...newActivities[index], name: e.target.value };
                            setEditablePlan({ ...editablePlan, activities: newActivities });
                          }}
                          placeholder="Activity Name"
                          className="font-semibold flex-1"
                        />
                        <Input
                          value={activity.duration}
                          onChange={(e) => {
                            const newActivities = [...editablePlan.activities];
                            newActivities[index] = { ...newActivities[index], duration: e.target.value };
                            setEditablePlan({ ...editablePlan, activities: newActivities });
                          }}
                          placeholder="Duration"
                          className="w-32"
                        />
                      </div>
                      <Textarea
                        value={activity.description}
                        onChange={(e) => {
                          const newActivities = [...editablePlan.activities];
                          newActivities[index] = { ...newActivities[index], description: e.target.value };
                          setEditablePlan({ ...editablePlan, activities: newActivities });
                        }}
                        placeholder="Description"
                      />
                    </>
                  ) : (
                    <>
                      <h4 className="font-semibold text-foreground">{activity.name} ({activity.duration})</h4>
                      <p>{activity.description}</p>
                    </>
                  )}
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
              {isEditing ? (
                <Textarea
                  value={editablePlan.assessment}
                  onChange={(e) => setEditablePlan({ ...editablePlan, assessment: e.target.value })}
                  className="min-h-[100px]"
                  placeholder="Assessment details"
                />
              ) : (
                <p>{editablePlan.assessment}</p>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </CardContent>
      <div className="p-6 border-t border-slate-100 flex justify-end">
        <FeedbackDialog
          page="lesson-plan"
          feature="lesson-plan-result"
          context={{
            topic: lessonPlan.title,
            grade: lessonPlan.gradeLevel,
            subject: lessonPlan.subject
          }}
        />
      </div>
    </Card>
  );
};
