"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MicrophoneInput } from "@/components/microphone-input";
import { AutoCompleteInput } from "@/components/auto-complete-input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { BookOpen, BrainCircuit, PenTool, GraduationCap, Sparkles, ArrowRight, Loader2, X, Mic, Search, Lightbulb } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
  topic: z.string().min(3, { message: "Topic must be at least 3 characters." }),
});

type FormValues = z.infer<typeof formSchema>;





export default function Home() {
  const { requireAuth, openAuthModal } = useAuth();
  const [greeting, setGreeting] = useState("Namaste");
  const [isThinking, setIsThinking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const router = useRouter();

  const { toast } = useToast();
  useEffect(() => {
    // Client-side only logic
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 18) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    // Handle voice transcript from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const voiceTranscript = params.get("voice_transcript");

      if (voiceTranscript) {
        form.setValue("topic", voiceTranscript);
        form.handleSubmit(onSubmit)();
      }
    }
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!requireAuth()) return;
    // Determine intent using the Smart Router
    setIsThinking(true);
    setAnswer(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/ai/intent", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ prompt: values.topic })
      });

      if (!res.ok) {
        if (res.status === 401) {
          openAuthModal();
          throw new Error("Please sign in to use the AI assistant");
        }
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process request");
      }

      const response = await res.json();
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
      <Card className="h-full border border-border border-l-[3px] border-l-primary shadow-soft hover:border-primary/50 hover:border-l-primary transition-colors duration-150 overflow-hidden">
        <CardContent className="p-4 md:p-6 flex flex-col items-center text-center gap-3 md:gap-4">
          <div className={cn("p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-all duration-200")}>
            <Icon className="h-6 w-6 md:h-8 md:w-8" />
          </div>
          <div className="space-y-1 md:space-y-2">
            <h2 className="font-headline text-base font-semibold text-foreground leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
          </div>
          <div className="mt-auto pt-2 md:pt-4 text-primary font-medium text-xs md:text-sm flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            Start <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="flex flex-col items-center justify-start min-h-[80vh] w-full max-w-6xl mx-auto px-4 py-8 md:py-12 gap-8 md:gap-12 relative">
      {/* Clean Top Bar for Consistency */}
      <div className="absolute top-0 left-0 h-1.5 w-full bg-primary rounded-t-xl" />

      {/* Hero Section */}
      <div className="text-center space-y-4 md:space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-xs md:text-sm font-medium border border-orange-100 mb-2 md:mb-4">
          <Sparkles className="h-3 w-3 md:h-4 md:w-4" />
          <span>AI-Powered Teaching Assistant for Bharat</span>
        </div>
        <h1 className="font-headline text-4xl md:text-7xl font-bold text-slate-900 tracking-tight">
          {greeting}, <span className="text-primary">Teacher.</span>
        </h1>
        <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-4">
          I am SahayakAI, your personal AI companion. I can help you create lesson plans, quizzes, and engaging content in seconds.
        </p>
      </div>

      {/* Main Voice-First Input Section */}
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 z-10 flex flex-col items-center gap-8">

        {/* BIG MIC BUTTON */}
        <div className="flex flex-col items-center gap-4">
          <MicrophoneInput
            onTranscriptChange={handleTranscript}
            iconSize="xl"
            label="Speak your topic"
            className=""
          />
          <p className="text-muted-foreground text-sm md:text-sm">
            Tap the microphone and tell Sahayak what you want to teach today
          </p>
        </div>

        {/* OR TEXT INPUT (SECONDARY) */}
        <div className="w-full">
          <Card className="border-none shadow-xl bg-card/95 backdrop-blur-sm ring-1 ring-border/80 transition-all focus-within:ring-primary/40 focus-within:ring-2">
            <CardContent className="p-2">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
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
                      className="border-none shadow-none focus-visible:ring-0 text-sm md:text-base py-2 pl-4 bg-transparent"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-95"
                    aria-label="Generate Lesson Plan"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-xs text-muted-foreground px-4">
            try: "Quiz about photosynthesis" or "Lesson plan for solar system"
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sahayak can make mistakes. Please review generated content.
          </p>

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 text-primary font-medium mt-2">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                <span className="ml-2">Thinking</span>
              </span>
            </div>
          )}

          {/* Instant Answer Card */}
          {answer && (
            <Card className="w-full max-w-2xl mt-4 border-primary/20 bg-card shadow-lg animate-in fade-in slide-in-from-bottom-2 border-l-4 border-primary">
              <CardContent className="p-4 md:p-6 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setAnswer(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="prose prose-sm max-w-none text-foreground">
                  <h3 className="text-primary font-bold mb-2 text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5" />Answer</h3>
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
          color=""
          description="NCERT-aligned plans."
        />
        <QuickActionCard
          title="Quiz Generator"
          icon={BrainCircuit}
          href="/quiz-generator"
          color=""
          description="Instant quizzes & worksheets."
        />
        <QuickActionCard
          title="Content Creator"
          icon={PenTool}
          href="/content-creator"
          color=""
          description="Stories & visual aids."
        />
        <QuickActionCard
          title="Teacher Training"
          icon={GraduationCap}
          href="/teacher-training"
          color=""
          description="Professional development."
        />
      </div>
    </div>
  );
}