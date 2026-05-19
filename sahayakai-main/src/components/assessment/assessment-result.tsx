"use client";

/**
 * AssessmentResult — renders the structured output of the assignment-assessor
 * flow. Always shows a verification banner because every grade here is AI-
 * generated and must be human-reviewed before being shared with a student or
 * parent. Per-criterion confidence chips let the teacher see at a glance
 * which rows the model itself was unsure about.
 *
 * PR2 ships the visual surface + transcript edit. PR3 wires up TTS playback,
 * PDF export, and save-to-library actions (currently rendered as disabled
 * placeholders so the layout doesn't reflow when the next PR lands).
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResultShell } from "@/components/ui/result-shell";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  CheckCircle,
  ClipboardCheck,
  Download,
  Lightbulb,
  Loader2,
  Pause,
  Save,
  Share2,
  Sparkles,
  TrendingUp,
  Volume2,
} from "lucide-react";
import type { AssessAssignmentOutput } from "@/ai/flows/assignment-assessor";
import { useEffect, useRef, useState } from "react";

type Translations = Record<string, Record<string, string>>;

const translations: Translations = {
  en: {
    title: "Assessment result",
    subtitle: "AI-graded against the rubric below.",
    verifyBanner: "AI-generated grade. Please verify the transcript and feedback before sharing with the student or parent.",
    overall: "Overall",
    pointsLabel: "{{earned}} of {{total}} points",
    criteriaHeading: "Per-criterion scores",
    criteriaColCriterion: "Criterion",
    criteriaColLevel: "Level",
    criteriaColPoints: "Points",
    criteriaColFeedback: "Feedback",
    criteriaColConfidence: "Confidence",
    strengthsHeading: "Strengths",
    improvementsHeading: "Things to improve",
    nextStepsHeading: "Next steps",
    teacherNoteHeading: "Note for the student",
    transcriptHeading: "What the AI read",
    transcriptHelp: "Edit if any line looks wrong, then save to keep your version.",
    saveTranscript: "Save edited transcript",
    saved: "Saved",
    modelConfidence: "Model confidence",
    playAudio: "Play feedback",
    stopAudio: "Stop playback",
    audioLoading: "Loading audio…",
    audioFailed: "Could not play feedback. Please try again.",
    download: "Download PDF",
    downloading: "Preparing PDF…",
    downloadFailed: "PDF download failed.",
    save: "Saved to library",
    share: "Share",
    shareCopied: "Copied feedback to clipboard.",
    shareFailed: "Share failed.",
    comingSoon: "Coming in the next update",
    warning_page_appears_blank: "The page looked blank or unreadable. Score set to 0.",
    warning_low_contrast: "Low-contrast photo — accuracy may be reduced.",
    warning_partial_writing: "Some regions of the page were partial or unclear.",
    warning_blank_transcript_hallucination_repaired: "AI's grade was contradicted by a blank transcript and was reset to 0.",
    warning_language_mismatch: "Feedback language did not match the requested language.",
    warningTitle: "Heads up",
  },
};

export interface AssessmentResultProps {
  result: AssessAssignmentOutput;
  language?: string;
  onTranscriptSave?: (newTranscript: string) => void;
  /** Required for TTS playback. The component POSTs to /api/tts directly. */
  getAuthToken?: () => Promise<string | null>;
}

export function AssessmentResult({
  result,
  language = "en",
  onTranscriptSave,
  getAuthToken,
}: AssessmentResultProps) {
  const t = translations[language] || translations.en;
  const [editedTranscript, setEditedTranscript] = useState(
    result.editedTranscript ?? result.rawTranscript ?? "",
  );
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { toast } = useToast();

  // Stop audio when the result switches to a new assessment.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [result.assessmentId]);

  async function handlePlayAudio() {
    if (audioPlaying) {
      audioRef.current?.pause();
      setAudioPlaying(false);
      return;
    }
    if (!getAuthToken) {
      toast({ title: t.audioFailed, variant: "destructive" });
      return;
    }
    setAudioLoading(true);
    try {
      const token = await getAuthToken();
      const fullText = buildFeedbackSpeech(result, t);
      const targetLang = bcp47FromIso(result.language || language);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: fullText, targetLang }),
      });
      if (!res.ok) throw new Error(`tts-${res.status}`);
      const json = (await res.json()) as { audioContent?: string };
      if (!json.audioContent) throw new Error("empty-audio");
      const audio = new Audio(`data:audio/mp3;base64,${json.audioContent}`);
      audio.onended = () => setAudioPlaying(false);
      audio.onerror = () => {
        setAudioPlaying(false);
        toast({ title: t.audioFailed, variant: "destructive" });
      };
      audioRef.current?.pause();
      audioRef.current = audio;
      await audio.play();
      setAudioPlaying(true);
    } catch (err) {
      console.error("[AssessmentResult] TTS failed", err);
      toast({ title: t.audioFailed, variant: "destructive" });
    } finally {
      setAudioLoading(false);
    }
  }

  async function handleDownloadPdf() {
    setPdfBusy(true);
    try {
      const { exportElementToPdf } = await import("@/lib/export-pdf");
      const filename = `assessment-${result.assessmentId || Date.now()}.pdf`;
      const out = await exportElementToPdf({
        elementId: "assessment-pdf",
        filename,
        hideSelector: ".no-print",
      });
      if (!out.ok) {
        console.error("[AssessmentResult] PDF failed", out.error);
        toast({ title: t.downloadFailed, variant: "destructive" });
      }
    } catch (err) {
      console.error("[AssessmentResult] PDF threw", err);
      toast({ title: t.downloadFailed, variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleShare() {
    const summary = buildFeedbackSummary(result);
    try {
      const nav = typeof navigator !== "undefined" ? (navigator as Navigator & {
        share?: (data: { title: string; text: string }) => Promise<void>;
      }) : null;
      if (nav?.share) {
        await nav.share({ title: "SahayakAI Assessment", text: summary });
        return;
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(summary);
        toast({ title: t.shareCopied });
        return;
      }
      throw new Error("share-and-clipboard-unavailable");
    } catch (err) {
      console.error("[AssessmentResult] share failed", err);
      toast({ title: t.shareFailed, variant: "destructive" });
    }
  }

  return (
    <ResultShell
      id="assessment-pdf"
      title={t.title}
      description={t.subtitle}
      icon={<ClipboardCheck className="h-6 w-6 text-primary" />}
      meta={[
        { value: result.rubricSnapshot.title || "Rubric" },
        { value: result.rubricSnapshot.subject || "—" },
        { value: result.rubricSnapshot.gradeLevel || "—" },
      ]}
      actions={[
        {
          label: audioPlaying ? t.stopAudio : audioLoading ? t.audioLoading : t.playAudio,
          icon: audioLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : audioPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          ),
          onClick: handlePlayAudio,
          disabled: audioLoading,
          variant: "default",
        },
        {
          label: pdfBusy ? t.downloading : t.download,
          icon: pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />,
          onClick: handleDownloadPdf,
          disabled: pdfBusy,
          variant: "outline",
        },
        // Save is always-on: the assessment flow auto-persists to the user's
        // library, so this is a confirmation chip rather than an action.
        { label: t.save, icon: <CheckCircle className="h-4 w-4" />, onClick: () => undefined, disabled: true, variant: "outline" },
        { label: t.share, icon: <Share2 className="h-4 w-4" />, onClick: handleShare, variant: "outline" },
      ]}
    >
      <div className="space-y-6">
        {/* Verification banner — always visible. */}
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
          <p>{t.verifyBanner}</p>
        </div>

        {result.warnings.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-orange-900">
              <AlertTriangle className="h-4 w-4" />
              {t.warningTitle}
            </p>
            <ul className="text-sm text-orange-900 list-disc pl-6">
              {result.warnings.map((w) => (
                <li key={w}>{t[`warning_${w}`] || w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Score gauge */}
        <ScoreGauge
          score={result.overallScore}
          earned={result.pointsEarned}
          total={result.pointsPossible}
          confidence={result.confidenceOverall}
          labelOverall={t.overall}
          labelConfidence={t.modelConfidence}
          labelPoints={t.pointsLabel
            .replace("{{earned}}", String(result.pointsEarned))
            .replace("{{total}}", String(result.pointsPossible))}
        />

        {/* Per-criterion table */}
        <section className="space-y-2">
          <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.criteriaHeading}
          </h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="text-left bg-primary/10">
                  <th className="px-3 py-2 font-semibold rounded-tl-lg">{t.criteriaColCriterion}</th>
                  <th className="px-3 py-2 font-semibold">{t.criteriaColLevel}</th>
                  <th className="px-3 py-2 font-semibold">{t.criteriaColPoints}</th>
                  <th className="px-3 py-2 font-semibold">{t.criteriaColFeedback}</th>
                  <th className="px-3 py-2 font-semibold rounded-tr-lg">{t.criteriaColConfidence}</th>
                </tr>
              </thead>
              <tbody>
                {result.perCriterionScores.map((row, i) => (
                  <tr
                    key={`${row.criterionName}-${i}`}
                    className="border-b border-border/40 last:border-0 align-top"
                  >
                    <td className="px-3 py-3 font-medium">{row.criterionName}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{row.level}</td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                      {row.points} / {row.maxPoints}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{row.feedback}</td>
                    <td className="px-3 py-3">
                      <ConfidenceChip value={row.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Strengths / improvements / next steps */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeedbackList
            heading={t.strengthsHeading}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            items={result.strengths}
            tint="emerald"
          />
          <FeedbackList
            heading={t.improvementsHeading}
            icon={<TrendingUp className="h-4 w-4 text-orange-600" />}
            items={result.improvements}
            tint="orange"
          />
          <FeedbackList
            heading={t.nextStepsHeading}
            icon={<Sparkles className="h-4 w-4 text-violet-600" />}
            items={result.nextSteps}
            tint="violet"
          />
        </section>

        {/* Teacher note */}
        <section className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <h3 className="flex items-center gap-2 font-headline text-sm font-semibold mb-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            {t.teacherNoteHeading}
          </h3>
          <p className="text-sm leading-relaxed">{result.teacherNote}</p>
        </section>

        {/* Transcript (editable) */}
        <section className="space-y-2">
          <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.transcriptHeading}
          </h3>
          <p className="text-xs text-muted-foreground">{t.transcriptHelp}</p>
          <Textarea
            value={editedTranscript}
            onChange={(e) => {
              setEditedTranscript(e.target.value);
              setTranscriptDirty(true);
              setTranscriptSaved(false);
            }}
            className="min-h-[140px] font-mono text-sm bg-muted/30"
          />
          {onTranscriptSave && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!transcriptDirty}
                onClick={() => {
                  onTranscriptSave(editedTranscript);
                  setTranscriptDirty(false);
                  setTranscriptSaved(true);
                }}
              >
                {t.saveTranscript}
              </Button>
              {transcriptSaved && <span className="text-xs text-emerald-700">{t.saved}</span>}
            </div>
          )}
        </section>
      </div>
    </ResultShell>
  );
}

function ScoreGauge({
  score,
  earned,
  total,
  confidence,
  labelOverall,
  labelPoints,
  labelConfidence,
}: {
  score: number;
  earned: number;
  total: number;
  confidence: number;
  labelOverall: string;
  labelPoints: string;
  labelConfidence: string;
}) {
  void earned;
  void total;
  const pct = Math.max(0, Math.min(100, score));
  const ringColor =
    pct >= 75 ? "stroke-emerald-500" : pct >= 50 ? "stroke-amber-500" : "stroke-rose-500";
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 rounded-surface-lg border border-border bg-card px-5 py-4 shadow-soft">
      <div className="relative h-32 w-32 flex-shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={radius} className="fill-none stroke-muted/40" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            className={cn("fill-none transition-all", ringColor)}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">{Math.round(pct)}%</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {labelOverall}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-2 text-center sm:text-left">
        <p className="text-base font-medium">{labelPoints}</p>
        <ConfidenceChip value={confidence} variant="bar" label={labelConfidence} />
      </div>
    </div>
  );
}

function ConfidenceChip({
  value,
  variant = "chip",
  label,
}: {
  value: number;
  variant?: "chip" | "bar";
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone =
    pct >= 75
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : pct >= 50
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-rose-100 text-rose-800 border-rose-300";
  if (variant === "bar") {
    const barTone = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
    return (
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{label || "Confidence"}</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
          <div className={cn("h-full transition-all", barTone)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", tone)}>
      {pct}%
    </Badge>
  );
}

function FeedbackList({
  heading,
  icon,
  items,
  tint,
}: {
  heading: string;
  icon: React.ReactNode;
  items: string[];
  tint: "emerald" | "orange" | "violet";
}) {
  const tints: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50/60",
    orange: "border-orange-200 bg-orange-50/60",
    violet: "border-violet-200 bg-violet-50/60",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 space-y-2", tints[tint])}>
      <h4 className="flex items-center gap-2 font-headline text-sm font-semibold">
        {icon}
        {heading}
      </h4>
      <ul className="text-sm list-disc pl-5 space-y-2 text-foreground/90">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Helpers ----------

const ISO_TO_BCP47: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  mr: "hi-IN", // Marathi voice tier is unstable on GCP; falls into Hindi voice (same Devanagari script)
  or: "or-IN",
  English: "en-IN",
  Hindi: "hi-IN",
  Bengali: "bn-IN",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
  Gujarati: "gu-IN",
  Punjabi: "pa-IN",
  Marathi: "hi-IN",
  Odia: "or-IN",
};

function bcp47FromIso(language: string | undefined | null): string | undefined {
  if (!language) return undefined;
  const direct = ISO_TO_BCP47[language];
  if (direct) return direct;
  // Already in BCP-47?
  if (/^[a-z]{2}-[A-Z]{2}$/.test(language)) return language;
  return undefined;
}

function buildFeedbackSpeech(
  result: AssessAssignmentOutput,
  t: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push(`${t.overall} ${Math.round(result.overallScore)} percent.`);
  if (result.teacherNote) lines.push(result.teacherNote);
  for (const c of result.perCriterionScores) {
    lines.push(`${c.criterionName}: ${c.feedback}`);
  }
  if (result.improvements.length) {
    lines.push(`${t.improvementsHeading}: ${result.improvements.join(". ")}`);
  }
  if (result.nextSteps.length) {
    lines.push(`${t.nextStepsHeading}: ${result.nextSteps.join(". ")}`);
  }
  return lines.join(" \n");
}

function buildFeedbackSummary(result: AssessAssignmentOutput): string {
  return [
    `SahayakAI Assessment`,
    `${result.rubricSnapshot.title || "Assignment"}`,
    `Score: ${Math.round(result.overallScore)}% (${result.pointsEarned}/${result.pointsPossible})`,
    "",
    "Strengths:",
    ...result.strengths.map((s) => `• ${s}`),
    "",
    "To improve:",
    ...result.improvements.map((s) => `• ${s}`),
    "",
    "Next steps:",
    ...result.nextSteps.map((s) => `• ${s}`),
    "",
    result.teacherNote,
  ].join("\n");
}
