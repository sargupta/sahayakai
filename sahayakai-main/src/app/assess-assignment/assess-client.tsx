"use client";

/**
 * AssessAssignmentClient — orchestrator for the AI Assignment Assessor.
 *
 * State machine:
 *   empty      → no photo yet
 *   ready      → photo captured + rubric chosen, awaiting submit
 *   processing → API call in flight (shows cycling stage messages)
 *   result     → AI grade rendered
 *
 * Wraps in <AuthGate> per project memory convention ("auth guard pattern
 * required on every 'use client' page calling server actions").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AssessmentCamera } from "@/components/assessment/camera-capture";
import { RubricPicker } from "@/components/assessment/rubric-picker";
import { AssessmentResult } from "@/components/assessment/assessment-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/language-selector";
import { GradeLevelSelector } from "@/components/grade-level-selector";
import { SubjectSelector } from "@/components/subject-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  GraduationCap,
  Hash,
  Languages,
  Loader2,
  ScanEye,
  Sparkles,
} from "lucide-react";
import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import type { AssessAssignmentOutput } from "@/ai/flows/assignment-assessor";
import { useLanguage } from "@/context/language-context";
import { LANGUAGE_TO_ISO } from "@/types";

// Local `translations` removed (Wave 6 cleanup). All strings now via global useLanguage().

const PROCESSING_STAGES_RAW = [
  "Reading the handwriting…",
  "Verifying the transcription…",
  "Scoring against the rubric…",
  "Writing feedback…",
  "Wrapping up…",
].join("|");

const PROCESSING_INTERVAL_MS = 4000;

export default function AssessAssignmentClient() {
  const { t } = useLanguage();
  return (
    <AuthGate
      icon={ClipboardCheck}
      title={t("Assess a Student's Work")}
      description={t("Sign in with Google to grade a handwritten assignment in seconds.")}
    >
      <AssessAssignmentContent />
    </AuthGate>
  );
}

function AssessAssignmentContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language: uiLang } = useLanguage();
  const uiLangCode = LANGUAGE_TO_ISO[uiLang] ?? "en";
  const [language, setLanguage] = useState<string>("en");
  const [gradeLevel, setGradeLevel] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [studentId, setStudentId] = useState("");
  const [imageDataUri, setImageDataUri] = useState("");
  const [rubric, setRubric] = useState<RubricGeneratorOutput | null>(null);
  const [result, setResult] = useState<AssessAssignmentOutput | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const inFlight = useRef(false);

  const stages = useMemo(
    () => PROCESSING_STAGES_RAW.split("|").map((s) => t(s)),
    [t],
  );

  // Cycle stage messages while processing — gives the teacher visible progress
  // during the 20-30s gemini-2.5-pro vision call.
  useEffect(() => {
    if (!processing) {
      setStageIndex(0);
      return;
    }
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, stages.length - 1));
    }, PROCESSING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [processing, stages.length]);

  async function handleSubmit() {
    if (inFlight.current || !imageDataUri || !user) return;
    inFlight.current = true;
    setProcessing(true);
    setResult(null);
    setStageIndex(0);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/assess-assignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageDataUri,
          rubricSnapshot: rubric ?? undefined,
          language,
          gradeLevel,
          subject,
          studentId: studentId.trim() || undefined,
          mode: "full",
        }),
      });
      if (!res.ok) {
        let message = t("Something went wrong. Please retake the photo and try again.");
        if (res.status === 401) message = t("Please sign in to grade student work.");
        else if (res.status === 403) message = t("Grading is not available on your current plan.");
        else if (res.status === 429) message = t("You've hit today's grading limit. Try again tomorrow or upgrade your plan.");
        else if (res.status === 503) message = t("AI service is busy. Please try again in a minute.");
        const body = await safeJson(res);
        const detail = body?.message || body?.error;
        toast({
          title: t("Could not grade this work"),
          description: detail && typeof detail === "string" ? detail : message,
          variant: "destructive",
        });
        return;
      }
      const json = (await res.json()) as AssessAssignmentOutput;
      setResult(json);
    } catch (err) {
      console.error("[AssessAssignment] submit failed", err);
      toast({ title: t("Could not grade this work"), description: t("Something went wrong. Please retake the photo and try again."), variant: "destructive" });
    } finally {
      setProcessing(false);
      inFlight.current = false;
    }
  }

  const canSubmit = !!imageDataUri && !processing;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-5xl mx-auto px-4 sm:px-0 pb-12">
      <header className="text-center w-full max-w-3xl">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-surface-lg bg-primary/10 text-primary mb-3">
          <ClipboardCheck className="h-6 w-6" />
        </div>
        <h1 className="font-headline text-2xl sm:text-3xl font-bold">{t("Assess a Student's Work")}</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">{t("Take one photo of a student's handwritten assignment. The AI will transcribe, score against a rubric, and suggest what to work on next.")}</p>
      </header>

      <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Capture pane (≈60% on desktop) */}
        <Card className="lg:col-span-3 shadow-soft border-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-headline text-base flex items-center gap-2">
              <ScanEye className="h-4 w-4 text-primary" />
              {t("Photo")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssessmentCamera
              uiLangCode={uiLangCode}
              onImageReady={(uri) => setImageDataUri(uri)}
            />
          </CardContent>
        </Card>

        {/* Metadata + rubric pane */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-soft border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-headline text-base">{t("About this assignment")}</CardTitle>
              <CardDescription className="text-xs">
                {t("Helps the AI calibrate its feedback to the right class and subject.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-id" className="text-xs font-semibold flex items-center gap-2">
                  <Hash className="h-3 w-3" />
                  {t("Student handle (optional)")}
                </Label>
                <Input
                  id="student-id"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder={t("e.g. roll-23")}
                  maxLength={64}
                />
                <p className="text-xs text-muted-foreground">{t("Use a roll number or alias — never the student's name.")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-2">
                    <GraduationCap className="h-3 w-3" />
                    {t("Class")}
                  </Label>
                  <GradeLevelSelector
                    value={gradeLevel ? [gradeLevel] : []}
                    onValueChange={(values) => setGradeLevel(values?.[0])}
                    language={language}
                    isMulti={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">{t("Subject")}</Label>
                  <SubjectSelector
                    value={subject}
                    onValueChange={(v) => setSubject(v)}
                    language={language}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-2">
                  <Languages className="h-3 w-3" />
                  {t("Feedback language")}
                </Label>
                <LanguageSelector value={language} onValueChange={setLanguage} />
              </div>
            </CardContent>
          </Card>

          <RubricPicker
            language={language}
            gradeLevel={gradeLevel}
            subject={subject}
            onRubricChange={(r) => setRubric(r)}
          />
        </div>
      </div>

      {/* Submit row — sticky on mobile so it stays reachable while scrolling */}
      <div className="w-full sticky bottom-3 z-10 sm:static sm:bottom-auto">
        <Button
          type="button"
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-6 text-base font-headline shadow-elevated"
        >
          {processing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t("Grading…")}
            </>
          ) : !imageDataUri ? (
            t("Add a photo first")
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              {t("Grade this assignment")}
            </>
          )}
        </Button>
      </div>

      {processing && (
        <Card className="w-full shadow-soft border-border animate-fade-in-up">
          <CardContent className="py-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-base font-medium text-muted-foreground text-center">
              {stages[stageIndex]}
            </p>
          </CardContent>
        </Card>
      )}

      {result && !processing && (
        <AssessmentResult
          result={result}
          language={language}
          getAuthToken={async () => (user ? await user.getIdToken() : null)}
          onTranscriptSave={(newTranscript) => {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    editedTranscript: newTranscript,
                  }
                : prev,
            );
          }}
        />
      )}
    </div>
  );
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
