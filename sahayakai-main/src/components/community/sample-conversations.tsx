"use client";

/**
 * The Community feed's empty state: a few static example conversations
 * (src/data/community-sample-conversations.ts) instead of a blank box.
 * Clearly labelled as examples; no like/connect actions, since nothing here
 * is a real post.
 */

import Link from "next/link";
import { CornerDownRight, PenLine, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { POST_TYPE_CONFIG } from "./feed-post";
import { SAMPLE_CONVERSATIONS } from "@/data/community-sample-conversations";
import { communityComposeHref } from "@/data/community-prompts";

export function SampleConversations() {
  const { t } = useLanguage();
  return (
    <section aria-label={t("Example conversations")} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-surface-md border border-primary/20 bg-tint-accent-soft px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("Examples from the SahayakAI team, to show what teachers share here.")}
        </p>
        <Link
          href={communityComposeHref()}
          className="focus-ring inline-flex items-center gap-1.5 rounded-pill text-sm font-semibold text-primary hover:underline"
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
          {t("Share your own")}
        </Link>
      </div>

      <ul className="space-y-4">
        {SAMPLE_CONVERSATIONS.map((c) => {
          const type = POST_TYPE_CONFIG[c.postType] ?? POST_TYPE_CONFIG.share;
          return (
            <li key={c.id} className="rounded-surface-md border border-border bg-card p-4 shadow-soft sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={cn("inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium", type.bg, type.text)}>
                  <type.icon className="h-3 w-3" aria-hidden="true" />
                  {t(type.label)}
                </span>
                <span className="text-muted-foreground">{t(c.topic)}</span>
                <span className="ml-auto rounded-pill border border-border px-2 py-0.5 text-muted-foreground">{t("Example")}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{t(c.persona)}</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground indic-text">{t(c.text)}</p>
              {c.reply && (
                <div className="mt-3 flex gap-2 rounded-surface-sm bg-muted/50 p-3">
                  <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{t(c.reply.persona)}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground indic-text">{t(c.reply.text)}</p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
