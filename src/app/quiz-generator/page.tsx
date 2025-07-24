
"use client";

import { generateQuiz, QuizGeneratorOutput } from "@/ai/flows/quiz-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, FileSignature, Checkbox } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { ImageUploader } from "@/components/image-uploader";
import { QuizDisplay } from "@/components/quiz-display";
import { MicrophoneInput } from "@/components/microphone-input";
import { Input } from "@/components/ui/input";
import { Checkbox as CheckboxUI } from "@/components/ui/checkbox";

const questionTypes = [
  { id: 'multiple_choice', label: 'Multiple Choice' },
  { id: 'true_false', label: 'True/False' },
  { id: 'short_answer', label: 'Short Answer' },
];

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  imageDataUri: z.string().optional(),
  numQuestions: z.coerce.number().min(1).max(20).default(5),
  questionTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one question type.",
  }),
  gradeLevel: z.string().optional(),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function QuizGeneratorPage() {
  const [quiz, setQuiz] = useState<QuizGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevel: "5th Grade",
      numQuestions: 5,
      questionTypes: ["multiple_choice", "true_false"],
    },
  });

  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setQuiz(null);
    try {
      const result = await generateQuiz({ ...values });
      setQuiz(result);
    } catch (error) {
      console.error("Failed to generate quiz:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the quiz. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    form.setValue("topic", prompt);
    form.trigger("topic");
  };

  const handleTranscript = (transcript: string) => {
    form.setValue("topic", transcript);
    form.trigger("topic");
  };


  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <FileSignature className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Quiz Generator</CardTitle>
          <CardDescription>
            Create a quiz on any topic, with various question types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="imageDataUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Add Context (Optional Image)</FormLabel>
                    <FormControl>
                      <ImageUploader
                        onImageUpload={(dataUri) => field.onChange(dataUri)}
                        language={selectedLanguage}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Topic</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., The life cycle of a butterfly, using the uploaded image."
                        {...field}
                        className="bg-white/50 backdrop-blur-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <MicrophoneInput onTranscriptChange={handleTranscript} />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="quiz" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Grade Level</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          value={[field.value || "5th Grade"]}
                          onValueChange={(values) => field.onChange(values?.[0])}
                          language={selectedLanguage}
                          isMulti={false}
                        />
                      </FormControl>
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
                    </FormItem>
                  )}
                />
              </div>

               <FormField
                  control={form.control}
                  name="numQuestions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Number of Questions</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="20" {...field} className="bg-white/50 backdrop-blur-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              
              <FormField
                control={form.control}
                name="questionTypes"
                render={() => (
                  <FormItem>
                    <FormLabel className="font-headline">Question Types</FormLabel>
                    <div className="flex flex-wrap gap-4">
                      {questionTypes.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="questionTypes"
                          render={({ field }) => {
                            return (
                              <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <CheckboxUI
                                    checked={field.value?.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, item.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== item.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {item.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Generating Quiz...
                  </>
                ) : (
                  "Generate Quiz"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Preparing your quiz questions...</p>
          </CardContent>
        </Card>
      )}

      {quiz && <QuizDisplay quiz={quiz} />}
    </div>
  );
}
