
"use client";

import { generateWorksheet } from "@/ai/flows/worksheet-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PencilRuler, Download, Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import ReactMarkdown from 'react-markdown';
import { ImageUploader } from "@/components/image-uploader";


const formSchema = z.object({
  imageDataUri: z.string({ required_error: "Please upload an image." }).min(1, { message: "Please upload an image." }),
  prompt: z.string().min(10, { message: "Prompt must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function WorksheetWizardPage() {
  const [worksheet, setWorksheet] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      language: "en",
      gradeLevel: "4th Grade",
    },
  });
  
  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setWorksheet(null);
    try {
      const result = await generateWorksheet(values);
      setWorksheet(result.worksheetContent);
    } catch (error) {
      console.error("Failed to generate worksheet:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the worksheet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
    form.trigger("prompt");
  };

  const handleDownload = () => {
    if (!worksheet) return;
    const blob = new Blob([worksheet], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'worksheet.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    toast({
        title: "Saved to Library",
        description: "Your worksheet has been saved to your personal library.",
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <PencilRuler className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="font-headline text-3xl">Worksheet Wizard</CardTitle>
          <CardDescription>
            Upload a textbook page and describe the worksheet you want to create.
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
                      <FormLabel className="font-headline">Textbook Page Image</FormLabel>
                      <FormControl>
                        <ImageUploader
                            onImageUpload={(dataUri) => {
                                field.onChange(dataUri);
                                form.trigger("imageDataUri");
                            }}
                            language={selectedLanguage}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Worksheet Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Create 5 fill-in-the-blank questions for Grade 2..."
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="worksheet" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="gradeLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline">Grade Level</FormLabel>
                      <FormControl>
                        <GradeLevelSelector
                          onValueChange={field.onChange}
                          defaultValue={field.value}
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
                    Generating...
                  </>
                ) : (
                  "Generate Worksheet"
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
              <p className="text-muted-foreground">The wizard is working its magic...</p>
            </CardContent>
         </Card>
      )}

      {worksheet && (
        <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <PencilRuler />
                Your Generated Worksheet
            </CardTitle>
             <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
          </CardHeader>
          <CardContent className="prose prose-lg max-w-none text-foreground p-6 border-t border-primary/20">
            <ReactMarkdown>{worksheet}</ReactMarkdown>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
