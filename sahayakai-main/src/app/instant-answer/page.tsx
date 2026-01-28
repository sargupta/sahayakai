
"use client";

import { instantAnswer } from "@/ai/flows/instant-answer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wand2, Youtube, Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { MicrophoneInput } from "@/components/microphone-input";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';


const formSchema = z.object({
  question: z.string().min(5, { message: "Question must be at least 5 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Answer = z.infer<typeof formSchema> & { answer: string; videoSuggestionUrl?: string };

export default function InstantAnswerPage() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: "",
      language: "en",
      gradeLevel: "6th Grade",
    },
  });

  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setAnswer(null);
    try {
      const result = await instantAnswer({
        question: values.question,
        language: values.language,
        gradeLevel: values.gradeLevel,
      });
      setAnswer({ ...values, ...result });
    } catch (error) {
      console.error("Failed to get answer:", error);
      toast({
        title: "Answer Generation Failed",
        description: "There was an error getting an answer. Please try again.",
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

  const handleSave = () => {
    toast({
      title: "Saved to Library",
      description: "Your answer has been saved to your personal library.",
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Wand2 className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Instant Answer</CardTitle>
          <CardDescription>
            Get quick, expert answers to your questions, powered by Google Search.
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
                    <FormLabel className="font-headline">Your Question</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-4">
                        <MicrophoneInput
                          onTranscriptChange={(transcript) => {
                            field.onChange(transcript);
                          }}
                          iconSize="lg"
                          label="Speak your question..."
                          className="bg-white/50 backdrop-blur-sm"
                        />
                        <Textarea
                          placeholder="e.g., 'Explain photosynthesis to a 10-year-old...'"
                          {...field}
                          className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="instant-answer" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Grade Level</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          value={field.value ? [field.value] : []}
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
                    Getting Answer...
                  </>
                ) : (
                  "Get Instant Answer"
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
            <p className="text-muted-foreground">Searching for the best answer...</p>
          </CardContent>
        </Card>
      )}

      {answer && (
        <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="font-headline text-2xl">Your Answer</CardTitle>
                <CardDescription className="italic">For the question: "{answer.question}"</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save to Library
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-lg max-w-none text-foreground">
              <ReactMarkdown>{answer.answer}</ReactMarkdown>
            </div>

            {answer.videoSuggestionUrl && (
              <div className="border-t border-primary/20 pt-4">
                <h3 className="font-headline text-lg mb-2">Recommended Video</h3>
                <Link href={answer.videoSuggestionUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <Youtube className="h-10 w-10 text-red-600" />
                  <div className="flex-1">
                    <p className="font-semibold">Watch on YouTube</p>
                    <p className="text-xs text-muted-foreground truncate">{answer.videoSuggestionUrl}</p>
                  </div>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
