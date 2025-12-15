"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, BrainCircuit, PenTool, GraduationCap, Sparkles, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MicrophoneInput } from "@/components/microphone-input";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [greeting, setGreeting] = useState("Namaste");
  const router = useRouter();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    // Navigate using client-side routing to preserve state and app-feel
    router.push(`/lesson-plan?topic=${encodeURIComponent(values.topic)}`);
  };

  const handleTranscript = (transcript: string) => {
    form.setValue("topic", transcript);
    form.handleSubmit(onSubmit)();
  };

  const QuickActionCard = ({ title, icon: Icon, href, color, description }: { title: string, icon: any, href: string, color: string, description: string }) => (
    <Link href={href} className="group">
      <Card className="h-full border-slate-200 bg-white/50 backdrop-blur-sm hover:bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <CardContent className="p-4 md:p-6 flex flex-col items-center text-center gap-3 md:gap-4">
          <div className={cn("p-3 md:p-4 rounded-full bg-slate-50 group-hover:scale-110 transition-transform duration-300", color)}>
            <Icon className="h-6 w-6 md:h-8 md:w-8" />
          </div>
          <div className="space-y-1 md:space-y-2">
            <h3 className="font-headline text-base md:text-lg font-semibold text-slate-800 leading-tight">{title}</h3>
            <p className="text-xs md:text-sm text-slate-500 leading-relaxed md:line-clamp-none line-clamp-2">{description}</p>
          </div>
          <div className="mt-auto pt-2 md:pt-4 text-primary font-medium text-xs md:text-sm flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            Start <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-6xl mx-auto px-4 py-8 md:py-12 gap-8 md:gap-12">

      {/* Hero Section */}
      <div className="text-center space-y-4 md:space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs md:text-sm font-medium border border-orange-100 mb-2 md:mb-4">
          <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
          <span>AI-Powered Teaching Assistant for Bharat</span>
        </div>
        <h1 className="font-headline text-4xl md:text-7xl font-bold text-slate-900 tracking-tight">
          {greeting}, <span className="text-primary">Teacher.</span>
        </h1>
        <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-4">
          I am Sahayak, your personal AI companion. I can help you create lesson plans, quizzes, and engaging content in seconds.
        </p>
      </div>

      {/* Main Input Section */}
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10">
        <Card className="border-none shadow-2xl bg-white/95 ring-1 ring-slate-200/50">
          <CardContent className="p-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="relative flex items-center">
                <div className="relative flex-1">
                  <AutoCompleteInput
                    placeholder="Topic (e.g., 'Photosynthesis')"
                    {...form.register("topic")}
                    value={form.watch("topic")}
                    selectedLanguage="en"
                    onSuggestionClick={(value) => {
                      form.setValue("topic", value);
                      form.handleSubmit(onSubmit)();
                    }}
                    className="border-none shadow-none focus-visible:ring-0 text-base md:text-lg py-4 md:py-6 pl-4 md:pl-6 pr-12 md:pr-14 bg-transparent"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <MicrophoneInput onTranscriptChange={handleTranscript} variant="ghost" size="sm" />
                  </div>
                </div>
                <Button type="submit" size="lg" className="rounded-xl px-4 md:px-8 h-10 md:h-12 mr-1 shadow-md hover:shadow-lg transition-all text-sm md:text-base">
                  Generate
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-center text-xs md:text-sm text-slate-500 font-medium px-4 line-clamp-1">
            Try asking: "Create a quiz on Fractions" or "Lesson plan for Solar System"
          </p>
          <p className="text-[10px] text-slate-400">
            Sahayak can make mistakes. Please review generated content.
          </p>
        </div>
      </div>

      {/* Quick Actions Grid - UPDATED GRID COLS */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
        <QuickActionCard
          title="Lesson Plan"
          icon={BookOpen}
          href="/lesson-plan"
          color="text-orange-600 bg-orange-50"
          description="NCERT-aligned plans."
        />
        <QuickActionCard
          title="Quiz Generator"
          icon={BrainCircuit}
          href="/quiz-generator"
          color="text-blue-600 bg-blue-50"
          description="Instant quizzes & worksheets."
        />
        <QuickActionCard
          title="Content Creator"
          icon={PenTool}
          href="/content-creator"
          color="text-green-600 bg-green-50"
          description="Stories & visual aids."
        />
        <QuickActionCard
          title="Teacher Training"
          icon={GraduationCap}
          href="/teacher-training"
          color="text-purple-600 bg-purple-50"
          description="Professional development."
        />
      </div>
    </div>
  );
}