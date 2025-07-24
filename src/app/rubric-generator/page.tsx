"use client";

import { generateRubric, RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ClipboardCheck, Info } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { RubricDisplay } from "@/components/rubric-display";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formSchema = z.object({
  assignmentDescription: z.string().min(10, { message: "Description must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function RubricGeneratorPage() {
  const [rubric, setRubric] = useState<RubricGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assignmentDescription: "",
      language: "en",
      gradeLevel: "7th Grade",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setRubric(null);
    try {
      const result = await generateRubric(values);
      setRubric(result);
    } catch (error) {
      console.error("Failed to generate rubric:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the rubric. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("assignmentDescription", prompt);
    form.trigger("assignmentDescription");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <ClipboardCheck className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Rubric Generator</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <span>Create clear and fair grading rubrics for any assignment.</span>
             <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5">
                  <Info className="h-5 w-5 text-accent-foreground/50" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-headline">What is a Rubric?</DialogTitle>
                  <DialogDescription>
                   A rubric is a scoring tool that explicitly represents the performance expectations for an assignment or piece of work.
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-muted-foreground space-y-2">
                    <p><strong className="text-foreground">Why are they important?</strong></p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong className="text-foreground/80">Clarity:</strong> They demystify assignments by making expectations clear to students before they start.</li>
                        <li><strong className="text-foreground/80">Consistency:</strong> They ensure all students are graded with the same criteria, making assessment fair and objective.</li>
                        <li><strong className="text-foreground/80">Feedback:</strong> They provide specific, detailed feedback that helps students understand their strengths and areas for improvement.</li>
                         <li><strong className="text-foreground/80">Efficiency:</strong> They can make the grading process faster and more straightforward for teachers.</li>
                    </ul>
                </div>
              </DialogContent>
            </Dialog>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="assignmentDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Assignment Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., A project to build a model of the solar system for 6th graders."
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="rubric" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Grade Level</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          value={[field.value || "7th Grade"]}
                          onValueChange={(values) => field.onChange(values?.[0])}
                          language={selectedLanguage}
                          isMulti={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Language</FormLabel>
                      <FormControl>
                        <LanguageSelector
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Generating Rubric...
                  </>
                ) : (
                  "Generate Rubric"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Building your rubric...</p>
          </CardContent>
        </Card>
      )}

      {rubric && <RubricDisplay rubric={rubric} />}
    </div>
  );
}
