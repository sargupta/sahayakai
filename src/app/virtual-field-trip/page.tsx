
"use client";

import { planVirtualFieldTrip, VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Globe2, Send, MapPin } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { ExamplePrompts } from "@/components/example-prompts";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import Link from "next/link";


const formSchema = z.object({
  topic: z.string().min(10, { message: "Topic must be at least 10 characters." }),
  language: z.string().optional(),
  gradeLevel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function VirtualFieldTripPage() {
  const [trip, setTrip] = useState<VirtualFieldTripOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
      language: "en",
      gradeLevel: "8th Grade",
    },
  });
  
  const selectedLanguage = form.watch("language") || 'en';

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setTrip(null);
    try {
      const result = await planVirtualFieldTrip({
        topic: values.topic,
        language: values.language,
        gradeLevel: values.gradeLevel,
      });
      setTrip(result);
    } catch (error) {
      console.error("Failed to plan trip:", error);
      toast({
        title: "Planning Failed",
        description: "There was an error planning the virtual trip. Please try again.",
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

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
              <Globe2 className="w-12 h-12 text-primary" />
            </div>
          <CardTitle className="font-headline text-3xl">Virtual Field Trip</CardTitle>
          <CardDescription>
            Plan exciting virtual tours for your students using Google Earth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-headline">Trip Topic</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'A tour of the major centers of the Harappan Civilization...'"
                        {...field}
                        className="bg-white/50 backdrop-blur-sm min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <ExamplePrompts onPromptClick={handlePromptClick} selectedLanguage={selectedLanguage} page="virtual-field-trip" />

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
                    Planning Trip...
                  </>
                ) : (
                  "Plan Virtual Trip"
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
              <p className="text-muted-foreground">Planning your virtual adventure...</p>
            </CardContent>
         </Card>
      )}

      {trip && (
        <Card className="mt-8 w-full max-w-2xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <Globe2 />
                {trip.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trip.stops.map((stop, index) => (
                <div key={index} className="flex gap-4 items-start p-4 rounded-lg bg-accent/20">
                    <div className="flex-shrink-0">
                        <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="font-bold text-lg">{stop.name}</h3>
                        <p className="text-sm text-foreground/80 mb-2">{stop.description}</p>
                        <Button asChild size="sm" variant="outline">
                            <Link href={stop.googleEarthUrl} target="_blank" rel="noopener noreferrer">
                                <Send className="mr-2 h-4 w-4" />
                                Visit on Google Earth
                            </Link>
                        </Button>
                    </div>
                </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
