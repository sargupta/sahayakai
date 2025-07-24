
"use client";

import { getTeacherTrainingAdvice } from "@/ai/flows/teacher-training";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, GraduationCap } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import ReactMarkdown from 'react-markdown';


const formSchema = z.object({
  question: z.string().min(10, { message: "Question must be at least 10 characters." }),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Advice = { answer: string };

export default function TeacherTrainingPage() {
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: "en",
    },
  });
  
  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setAdvice(null);
    try {
      const result = await getTeacherTrainingAdvice({
        question: values.question,
        language: values.language,
      });
      setAdvice(result);
    } catch (error) {
      console.error("Failed to get advice:", error);
      toast({
        title: "Failed to Get Advice",
        description: "There was an error getting advice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePromptClick = (prompt: string) => {
    form.setValue("question", prompt);
    form.trigger("question");
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <GraduationCap className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="font-headline text-3xl">Teacher Training</CardTitle>
          <CardDescription>
            Your personal professional development coach. Ask for advice, techniques, or motivation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Your Question or Challenge</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'How can I get my students to be quiet without shouting?'"
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="teacher-training" />

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
              
              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Getting Advice...
                  </>
                ) : (
                  "Get Advice"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
         <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Thinking of some helpful advice...</p>
            </CardContent>
         </Card>
      )}

      {advice && (
        <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <GraduationCap />
                Your Personalized Advice
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-lg max-w-none text-foreground p-6 border-t border-primary/20 prose-p:my-4">
            <ReactMarkdown>{advice.answer}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
