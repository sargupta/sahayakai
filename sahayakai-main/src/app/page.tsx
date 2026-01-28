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
import { processAgentRequest } from "@/ai/flows/agent-router";
import { Loader2, X } from "lucide-react";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [greeting, setGreeting] = useState("Namaste");
  const [isThinking, setIsThinking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const router = useRouter();

  const { toast } = useToast();
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const voiceTranscript = searchParams?.get("voice_transcript");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    if (voiceTranscript) {
      form.setValue("topic", voiceTranscript);
      form.handleSubmit(onSubmit)();
    }
  }, [voiceTranscript]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    // Determine intent using the Smart Router
    setIsThinking(true);
    setAnswer(null);

    try {
      const response = await processAgentRequest({ prompt: values.topic });
      const { result } = response;

      if (result?.action === 'NAVIGATE' && result.url) {
        router.push(result.url);
      } else if (result?.action === 'ANSWER') {
        setAnswer(result.content);
        setIsThinking(false);
      } else {
        // Fallback or error
        toast({
          title: "Not sure how to help",
          description: result?.error || "Please try asking to create a lesson plan, quiz, or visual aid.",
          variant: "destructive"
        });
        setIsThinking(false);
      }
    } catch (error) {
      console.error("Router Error:", error);
      toast({
        title: "Connection Error",
        description: "Could not reach Sahayak. Please try again.",
        variant: "destructive"
      });
      setIsThinking(false);
    }
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

      {/* Main Voice-First Input Section */}
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10 flex flex-col items-center gap-8">

        {/* BIG MIC BUTTON */}
        <div className="flex flex-col items-center gap-4">
          <MicrophoneInput
            onTranscriptChange={handleTranscript}
            iconSize="xl"
            label="ಪಠ್ಯದ ಬಗ್ಗೆ ಹೇಳಿ / ಕಲ್ಪನೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಿ (Speak your topic)"
            className="hover:scale-105 transition-transform"
          />
          <p className="text-slate-500 font-medium text-sm md:text-base animate-pulse">
            Tap the microphone and tell Sahayak what you want to teach today
          </p>
        </div>

        {/* OR TEXT INPUT (SECONDARY) */}
        <div className="w-full">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm ring-1 ring-slate-200/50">
            <CardContent className="p-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="relative flex items-center">
                  <div className="relative flex-1">
                    <AutoCompleteInput
                      placeholder="Or type here (e.g. 'Photosynthesis')"
                      {...form.register("topic")}
                      value={form.watch("topic")}
                      selectedLanguage="en"
                      onSuggestionClick={(value) => {
                        form.setValue("topic", value);
                        form.handleSubmit(onSubmit)();
                      }}
                      className="border-none shadow-none focus-visible:ring-0 text-sm md:text-base py-3 pl-4 bg-transparent"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="ghost" className="mr-1 h-8" aria-label="Generate Lesson Plan">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-xs md:text-sm text-slate-500 font-medium px-4 line-clamp-1">
            try: "Quiz about photosynthesis" or "Lesson plan for solar system"
          </p>
          <p className="text-[10px] text-slate-400">
            Sahayak can make mistakes. Please review generated content.
          </p>

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 text-primary font-medium mt-2 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          {/* Instant Answer Card */}
          {answer && (
            <Card className="w-full max-w-2xl mt-4 border-primary/20 bg-white shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <CardContent className="p-4 md:p-6 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6 text-slate-400 hover:text-slate-600"
                  onClick={() => setAnswer(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="prose prose-sm max-w-none text-slate-700">
                  <h3 className="text-primary font-bold mb-2 text-lg">Answer</h3>
                  <div className="whitespace-pre-wrap">{answer}</div>
                </div>
              </CardContent>
            </Card>
          )}
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