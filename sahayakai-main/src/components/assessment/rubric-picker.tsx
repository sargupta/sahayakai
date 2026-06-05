"use client";

/**
 * RubricPicker — choose how the assignment-assessor flow should ground its
 * grading. Three modes:
 *
 *  - "infer": don't pass a rubric. The flow uses its built-in DEFAULT_RUBRIC.
 *    Cheapest, no extra teacher input, fine for one-off quick checks.
 *  - "generate": teacher types a short assignment description; we POST to
 *    /api/ai/rubric (existing flow) and feed the result into the assessor as
 *    `rubricSnapshot`. Most flexible.
 *  - "saved": teacher picks a rubric they've already saved (My Library). We
 *    fetch via GET /api/content/list?type=rubric and let them pick one. Falls
 *    back to "generate" if the library is empty.
 *
 * Output: emits the chosen rubric snapshot (or null when "infer") via
 * `onRubricChange`. The page hosts the submit button — this component is
 * presentation + intent only.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, BookOpen, Wand2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import type { RubricGeneratorOutput } from "@/ai/flows/rubric-generator";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

type Mode = "infer" | "generate" | "saved";

// Local `translations` removed (Wave 6 cleanup). All strings now via global useLanguage().

interface SavedRubricSummary {
  id: string;
  title: string;
  topic?: string;
  gradeLevel?: string;
  subject?: string;
}

export interface RubricPickerProps {
  language?: string;
  gradeLevel?: string;
  subject?: string;
  onRubricChange: (rubric: RubricGeneratorOutput | null, mode: Mode) => void;
  className?: string;
}

export function RubricPicker({
  language = "en",
  gradeLevel,
  subject,
  onRubricChange,
  className,
}: RubricPickerProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("infer");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savedList, setSavedList] = useState<SavedRubricSummary[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [readyRubric, setReadyRubric] = useState<RubricGeneratorOutput | null>(null);

  // Reset emitted rubric whenever mode changes so the parent never grades
  // against a stale value.
  useEffect(() => {
    onRubricChange(null, mode);
    setReadyRubric(null);
    setSelectedSavedId("");
    if (mode === "saved" && savedList === null && user) {
      void loadSaved();
    }
  }, [mode]);

  const loadSaved = useCallback(async () => {
    if (!user) return;
    setSavedLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/content/list?type=rubric&limit=20", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`list-failed-${res.status}`);
      const json = await res.json();
      const items: SavedRubricSummary[] = (json.items || []).map((it: any) => ({
        id: it.id,
        title: it.title,
        topic: it.topic,
        gradeLevel: it.gradeLevel,
        subject: it.subject,
      }));
      setSavedList(items);
    } catch (err) {
      console.error("[RubricPicker] load saved failed", err);
      setSavedList([]);
      toast({ title: t("Could not load your saved rubrics."), variant: "destructive" });
    } finally {
      setSavedLoading(false);
    }
  }, [user, t, toast]);

  async function handleGenerate() {
    if (!user || !assignmentDescription.trim() || generating) return;
    setGenerating(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ai/rubric", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignmentDescription,
          gradeLevel,
          subject,
          language,
        }),
      });
      if (!res.ok) throw new Error(`rubric-failed-${res.status}`);
      const rubric = (await res.json()) as RubricGeneratorOutput;
      setReadyRubric(rubric);
      onRubricChange(rubric, "generate");
    } catch (err) {
      console.error("[RubricPicker] generate failed", err);
      toast({ title: t("Could not generate the rubric. Please try again."), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSavedPick(id: string) {
    setSelectedSavedId(id);
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/content/get?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`get-failed-${res.status}`);
      const content = await res.json();
      const rubric = content?.data as RubricGeneratorOutput | undefined;
      if (rubric) {
        setReadyRubric(rubric);
        onRubricChange(rubric, "saved");
      }
    } catch (err) {
      console.error("[RubricPicker] load saved item failed", err);
      toast({ title: t("Could not load your saved rubrics."), variant: "destructive" });
    }
  }

  return (
    <div className={cn("space-y-4 rounded-surface-lg border border-border bg-card p-4 sm:p-6 shadow-soft", className)}>
      <header>
        <h3 className="font-headline text-base font-semibold">{t("Grading rubric")}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t("How should the AI grade this work?")}</p>
      </header>

      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ModeChip
          checked={mode === "infer"}
          onSelect={() => setMode("infer")}
          icon={<Sparkles className="h-4 w-4" />}
          label={t("Let AI choose a rubric")}
          help={t("Quickest. Uses a balanced 4-criterion rubric.")}
        />
        <ModeChip
          checked={mode === "generate"}
          onSelect={() => setMode("generate")}
          icon={<Wand2 className="h-4 w-4" />}
          label={t("Generate a new rubric")}
          help={t("Tell us what the assignment was; AI builds a fresh rubric.")}
        />
        <ModeChip
          checked={mode === "saved"}
          onSelect={() => setMode("saved")}
          icon={<BookOpen className="h-4 w-4" />}
          label={t("Pick from My Library")}
          help={t("Reuse a rubric you've already generated.")}
        />
      </fieldset>

      {mode === "generate" && (
        <div className="space-y-2">
          <Label htmlFor="assignment-desc" className="text-xs font-semibold">
            {t("What was the assignment?")}
          </Label>
          <Input
            id="assignment-desc"
            placeholder={t("e.g. Class 5 science worksheet on the water cycle, 10 short-answer questions")}
            value={assignmentDescription}
            onChange={(e) => setAssignmentDescription(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={generating || assignmentDescription.trim().length < 10}
            className="w-full sm:w-auto"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("Generating…")}
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                {t("Generate rubric")}
              </>
            )}
          </Button>
        </div>
      )}

      {mode === "saved" && (
        <div className="space-y-2">
          {savedLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("Loading your saved rubrics…")}
            </p>
          )}
          {!savedLoading && savedList?.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("You haven't saved any rubrics yet. Switch to 'Generate' to make one.")}</p>
          )}
          {!savedLoading && savedList && savedList.length > 0 && (
            <>
              <Label htmlFor="saved-rubric" className="text-xs font-semibold">
                {t("Choose a saved rubric")}
              </Label>
              <select
                id="saved-rubric"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={selectedSavedId}
                onChange={(e) => void handleSavedPick(e.target.value)}
              >
                <option value="">—</option>
                {savedList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                    {r.gradeLevel ? ` · ${t(r.gradeLevel)}` : ""}
                    {r.subject ? ` · ${t(r.subject)}` : ""}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {readyRubric && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {t("Rubric ready: {{title}}").replace("{{title}}", readyRubric.title)}
        </p>
      )}
    </div>
  );
}

function ModeChip({
  checked,
  onSelect,
  icon,
  label,
  help,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-xl border px-3 py-2.5 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary/40",
        checked
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-border bg-background hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="block text-xs text-muted-foreground mt-1">{help}</span>
    </button>
  );
}
