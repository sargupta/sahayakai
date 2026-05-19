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
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Lightbulb,
  Save,
  Share2,
  Sparkles,
  TrendingUp,
  Volume2,
} from "lucide-react";
import type { AssessAssignmentOutput } from "@/ai/flows/assignment-assessor";
import { useState } from "react";

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
    download: "Download PDF",
    save: "Save to library",
    share: "Share",
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
}

export function AssessmentResult({ result, language = "en", onTranscriptSave }: AssessmentResultProps) {
  const t = translations[language] || translations.en;
  const [editedTranscript, setEditedTranscript] = useState(
    result.editedTranscript ?? result.rawTranscript ?? "",
  );
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [transcriptSaved, setTranscriptSaved] = useState(false);

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
        // PR3 will wire these up. We render them disabled today so teachers
        // see what's coming without the layout shifting later.
        { label: t.playAudio, icon: <Volume2 className="h-4 w-4" />, onClick: () => undefined, disabled: true, variant: "default" },
        { label: t.download, icon: <Download className="h-4 w-4" />, onClick: () => undefined, disabled: true, variant: "outline" },
        { label: t.save, icon: <Save className="h-4 w-4" />, onClick: () => undefined, disabled: true, variant: "outline" },
        { label: t.share, icon: <Share2 className="h-4 w-4" />, onClick: () => undefined, disabled: true, variant: "outline" },
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
