"use client";

import { useMemo } from "react";
import { MessageCircle, PenLine, Sparkles, UserSearch, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import {
  COMMUNITY_PROMPT_KIND_LABEL,
  invitingPromptForDay,
  localDayNumber,
  type CommunityPrompt,
} from "@/data/community-prompts";

interface CommunityHeroProps {
  onStartDiscussion: () => void;
  onAnswerPrompt: (prompt: CommunityPrompt) => void;
  onOpenStaffRoom: () => void;
  onOpenTeacherDirectory: () => void;
  /** Hide the compose actions when nobody is signed in (the composer can't post). */
  canPost: boolean;
}

/**
 * Community page header: a short welcome, the page's main actions and the
 * day's SahayakAI prompt (curated editorial content, labelled as such — never
 * shown as a teacher's post).
 */
export function CommunityHero({
  onStartDiscussion,
  onAnswerPrompt,
  onOpenStaffRoom,
  onOpenTeacherDirectory,
  canPost,
}: CommunityHeroProps) {
  const { t } = useLanguage();
  const prompt = useMemo(() => invitingPromptForDay(localDayNumber(new Date())), []);

  return (
    <section
      aria-labelledby="community-title"
      className="relative overflow-hidden rounded-surface-lg border border-border bg-card shadow-soft"
    >
      {/* One quiet warm wash behind the prompt — the only decoration. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-pill bg-tint-accent blur-3xl"
      />

      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="type-caption flex items-center gap-1.5 text-primary">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {t("SahayakAI Community")}
          </p>
          <h1 id="community-title" className="mt-2 font-headline text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            {t("Community")}
          </h1>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground indic-text">
            {t("Connect with educators, exchange ideas and grow together.")}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {canPost && (
              <Button onClick={onStartDiscussion} className="gap-1.5 rounded-pill px-5">
                <PenLine className="h-4 w-4" aria-hidden="true" />
                {t("Start a discussion")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onOpenStaffRoom}
              className="gap-1.5 rounded-pill bg-card hover:bg-muted hover:text-foreground"
              aria-label={t("Open Staff Room — chat with every teacher")}
            >
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("Staff Room")}
            </Button>
            <Button
              variant="outline"
              onClick={onOpenTeacherDirectory}
              className="gap-1.5 rounded-pill bg-card hover:bg-muted hover:text-foreground"
              aria-label={t("Find Teachers — search by subject or school")}
            >
              <UserSearch className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("Find Teachers")}
            </Button>
          </div>
        </div>

        {/* Today's prompt */}
        <figure className="relative min-w-0 rounded-surface-md border border-primary/15 bg-background/80 p-4 backdrop-blur-sm sm:p-6">
          <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Today's prompt")}
            </span>
            <span aria-hidden="true">&middot;</span>
            <span>{t(COMMUNITY_PROMPT_KIND_LABEL[prompt.kind])}</span>
          </figcaption>
          <blockquote className="mt-2 font-headline text-lg font-semibold leading-snug text-foreground indic-text sm:text-xl">
            {t(prompt.text)}
          </blockquote>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t("A SahayakAI community prompt")}</span>
            {canPost && (
              <button
                type="button"
                onClick={() => onAnswerPrompt(prompt)}
                className="focus-ring rounded-pill text-sm font-semibold text-primary hover:underline"
              >
                {t("Join the conversation")} →
              </button>
            )}
          </div>
        </figure>
      </div>
    </section>
  );
}
