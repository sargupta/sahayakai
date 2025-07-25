
"use client";

import { generateVisualAid } from "@/ai/flows/visual-aid-designer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Download, Images, Save } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";


const formSchema = z.object({
  prompt: z.string().min(10, { message: "Description must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function VisualAidDesignerPage() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      language: "en",
      gradeLevel: "6th Grade",
    },
  });
  
  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setImageData(null);
    try {
      const result = await generateVisualAid({
        prompt: values.prompt,
        language: values.language,
        gradeLevel: values.gradeLevel,
      });
      setImageData(result.imageDataUri);
    } catch (error) {
      console.error("Failed to generate visual aid:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the visual aid. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!imageData) return;
    const link = document.createElement('a');
    link.href = imageData;
    link.download = 'visual-aid.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handlePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
    form.trigger("prompt");
  };

  const handleSave = () => {
    toast({
        title: "Saved to Library",
        description: "Your visual aid has been saved to your personal library.",
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Images className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="font-headline text-3xl">Visual Aid Designer</CardTitle>
          <CardDescription>
            Create simple black-and-white line drawings for your lessons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., A simple diagram of the water cycle..."
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="visual-aid" />

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
                  "Generate Visual Aid"
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
              <p className="text-muted-foreground">Generating your visual aid... this may take a moment.</p>
            </CardContent>
         </Card>
      )}

      {imageData && (
        <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center justify-between">
              <span>Generated Image</span>
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
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center p-4">
            <Image
              src={imageData}
              alt="Generated visual aid"
              width={512}
              height={512}
              className="rounded-lg border border-black/10"
              data-ai-hint="illustration drawing"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
