
"use client";

import { generateQuiz } from "@/ai/flows/quiz-generator";
import type { QuizGeneratorOutput } from "@/ai/schemas/quiz-generator-schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, FileSignature, Checkbox, BarChart2, MessageSquare, ListTodo, BrainCircuit, BotMessageSquare, Brain, Search, CircleHelp, DraftingCompass, Pencil } from "lucide-react";
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
import { SelectableCard } from "@/components/selectable-card";
import { cn } from "@/lib/utils";

const questionTypesData = [
  { id: 'multiple_choice', icon: BarChart2 },
  { id: 'fill_in_the_blanks', icon: Pencil },
  { id: 'short_answer', icon: MessageSquare },
];

const bloomsLevelsData = [
    { id: 'Remember', icon: Brain },
    { id: 'Understand', icon: Search },
    { id: 'Apply', icon: DraftingCompass },
    { id: 'Analyze', icon: BrainCircuit },
    { id: 'Evaluate', icon: CircleHelp },
    { id: 'Create', icon: BotMessageSquare },
];

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
  imageDataUri: z.string().optional(),
  numQuestions: z.coerce.number().min(1).max(20).default(5),
  questionTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one question type.",
  }),
  bloomsTaxonomyLevels: z.array(z.string()).optional(),
  gradeLevel: z.string().optional(),
  language: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const translations: Record<string, Record<string, any>> = {
  en: {
    pageTitle: "Quiz Generator",
    pageDescription: "Create a quiz on any topic, with various question types.",
    contextLabel: "Add Context (Optional Image)",
    topicLabel: "Topic",
    topicPlaceholder: "e.g., The life cycle of a butterfly, using the uploaded image.",
    numQuestionsLabel: "Number of Questions",
    questionTypesLabel: "Question Types",
    bloomsLabel: "Bloom's Taxonomy Levels",
    gradeLevelLabel: "Grade Level",
    languageLabel: "Language",
    submitButton: "Generate Quiz",
    submitButtonLoading: "Generating Quiz...",
    loadingText: "Preparing your quiz questions...",
    questionTypes: {
      multiple_choice: 'Multiple Choice',
      fill_in_the_blanks: 'Fill in the Blanks',
      short_answer: 'Short Answer',
    },
     blooms: {
        'Remember': 'Remember',
        'Understand': 'Understand',
        'Apply': 'Apply',
        'Analyze': 'Analyze',
        'Evaluate': 'Evaluate',
        'Create': 'Create',
    }
  },
  hi: {
    pageTitle: "क्विज़ जेनरेटर",
    pageDescription: "किसी भी विषय पर, विभिन्न प्रकार के प्रश्नों के साथ एक क्विज़ बनाएं।",
    contextLabel: "संदर्भ जोड़ें (वैकल्पिक छवि)",
    topicLabel: "विषय",
    topicPlaceholder: "उदा., अपलोड की गई छवि का उपयोग करते हुए, एक तितली का जीवन चक्र।",
    numQuestionsLabel: "प्रश्नों की संख्या",
    questionTypesLabel: "प्रश्न प्रकार",
    bloomsLabel: "ब्लूम की टैक्सोनॉमी स्तर",
    gradeLevelLabel: "श्रेणी स्तर",
    languageLabel: "भाषा",
    submitButton: "क्विज़ बनाएं",
    submitButtonLoading: "क्विज़ बना रहा है...",
    loadingText: "आपके प्रश्न तैयार किए जा रहे हैं...",
    questionTypes: {
      multiple_choice: 'बहुविकल्पीय',
      fill_in_the_blanks: 'रिक्त स्थान भरें',
      short_answer: 'संक्षिप्त उत्तर',
    },
    blooms: {
        'Remember': 'याद रखें',
        'Understand': 'समझें',
        'Apply': 'लागू करें',
        'Analyze': 'विश्लेषण करें',
        'Evaluate': 'मूल्यांकन करें',
        'Create': 'बनाएं',
    }
  },
  // Add other languages here...
};


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
      questionTypes: ["multiple_choice", "short_answer"],
      bloomsTaxonomyLevels: ['Remember', 'Understand'],
    },
  });

  const selectedLanguage = form.watch("language") || 'en';
  const t = translations[selectedLanguage] || translations.en;

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setQuiz(null);
    try {
      const result = await generateQuiz({ ...values, language: selectedLanguage });
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
          <CardTitle className="font-headline text-3xl">{t.pageTitle}</CardTitle>
          <CardDescription>{t.pageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="imageDataUri"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.contextLabel}</FormLabel>
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
                    <FormLabel className="font-headline">{t.topicLabel}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t.topicPlaceholder}
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

                <FormField
                  control={form.control}
                  name="questionTypes"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-headline">{t.questionTypesLabel}</FormLabel>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        {questionTypesData.map((item) => (
                           <SelectableCard
                                key={item.id}
                                icon={item.icon}
                                label={t.questionTypes[item.id]}
                                isSelected={field.value?.includes(item.id)}
                                onSelect={() => {
                                    const currentValues = field.value || [];
                                    const newValues = currentValues.includes(item.id)
                                    ? currentValues.filter((v) => v !== item.id)
                                    : [...currentValues, item.id];
                                    field.onChange(newValues);
                                }}
                            />
                        ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                control={form.control}
                name="bloomsTaxonomyLevels"
                render={() => (
                  <FormItem>
                    <FormLabel className="font-headline">{t.bloomsLabel}</FormLabel>
                     <div className="flex flex-wrap gap-3 pt-2">
                      {bloomsLevelsData.map((item) => (
                        <FormField
                          key={item.id}
                          control={form.control}
                          name="bloomsTaxonomyLevels"
                          render={({ field }) => {
                            return (
                              <FormItem key={item.id} className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Button 
                                    type="button"
                                    variant={field.value?.includes(item.id) ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "rounded-full h-8 px-4 text-xs font-normal",
                                        field.value?.includes(item.id) && "bg-blue-600 hover:bg-blue-700 text-white"
                                    )}
                                    onClick={() => {
                                       const currentValues = field.value || [];
                                        const newValues = currentValues.includes(item.id)
                                        ? currentValues.filter((v) => v !== item.id)
                                        : [...currentValues, item.id];
                                        field.onChange(newValues);
                                    }}
                                  >
                                    <CheckboxUI
                                        checked={field.value?.includes(item.id)}
                                        className="mr-2 h-3 w-3 border-current"
                                    />
                                    {t.blooms[item.id]}
                                  </Button>
                                </FormControl>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">{t.gradeLevelLabel}</FormLabel>
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
                      <FormLabel className="font-headline">{t.languageLabel}</FormLabel>
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
                      <FormLabel className="font-headline">{t.numQuestionsLabel}</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="20" {...field} className="bg-white/50 backdrop-blur-sm" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <Button type="submit" disabled={isLoading} className="w-full text-lg py-6">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    {t.submitButtonLoading}
                  </>
                ) : (
                  t.submitButton
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
            <p className="text-muted-foreground">{t.loadingText}</p>
          </CardContent>
        </Card>
      )}

      {quiz && <QuizDisplay quiz={quiz} />}
    </div>
  );
}
