/**
 * Curated community prompts — SahayakAI's own editorial content.
 *
 * These supplement real community posts on the homepage Community corner and
 * the Community page header. They are NOT user-generated: they never carry an
 * author, avatar, school, timestamp or engagement count, and every surface
 * that shows one labels it as a SahayakAI prompt.
 *
 * `text` and the kind labels are English i18n keys (translated via t() from
 * src/locales/*.json). `postType` marks prompts that invite a reply: the
 * "Join the conversation" action opens the Community composer with that
 * post type pre-selected and the prompt shown above the text box.
 */

import type { PostType } from "@/types/community";

export type CommunityPromptKind =
  | "tip"
  | "idea"
  | "discussion"
  | "encouragement"
  | "share"
  | "resource"
  | "season";

export interface CommunityPrompt {
  id: string;
  kind: CommunityPromptKind;
  text: string;
  /** Present when the prompt invites a post; the composer opens with this type. */
  postType?: PostType;
}

export const COMMUNITY_PROMPT_KIND_LABEL: Record<CommunityPromptKind, string> = {
  tip: "Teaching tip",
  idea: "Classroom idea",
  discussion: "Discussion starter",
  encouragement: "For teachers",
  share: "Share your practice",
  resource: "Resource exchange",
  season: "Through the school year",
};

/** Ordered so neighbours differ in kind — consecutive days never repeat a kind. */
export const COMMUNITY_PROMPTS: readonly CommunityPrompt[] = [
  { id: "discuss-difficult-concept", kind: "discussion", postType: "ask_help", text: "What's one activity that helped your students understand a difficult concept?" },
  { id: "tip-wait-time", kind: "tip", text: "Pause for five seconds after asking a question. Quieter students often need that moment before they raise a hand." },
  { id: "share-technique", kind: "share", postType: "share", text: "Share a teaching technique that has worked particularly well in your classroom." },
  { id: "idea-small-experiments", kind: "idea", text: "Small classroom experiments can create some of the biggest learning moments." },
  { id: "resource-share", kind: "resource", postType: "resource", text: "Found a useful classroom resource? Share it with fellow educators." },
  { id: "encourage-questions", kind: "encouragement", text: "Every question a student asks is an opportunity to make learning more meaningful." },
  { id: "discuss-mixed-levels", kind: "discussion", postType: "ask_help", text: "How do you keep a class engaged when students are at very different levels?" },
  { id: "idea-local-examples", kind: "idea", text: "Explain a concept with the market, the fields or the kitchen at home. Familiar examples help abstract ideas stick." },
  { id: "share-small-win", kind: "share", postType: "celebrate", text: "Did a shy student speak up, or did a whole class finally get it? Share the moment with fellow teachers." },
  { id: "tip-exit-ticket", kind: "tip", text: "End a lesson by asking for one thing students learned and one thing they are unsure about. It shows you where to begin tomorrow." },
  { id: "season-exam-calm", kind: "season", text: "Around exams, a few minutes of calm revision games can ease the pressure on students." },
  { id: "discuss-home-language", kind: "discussion", postType: "ask_help", text: "When do you switch to your students' home language during a lesson, and how does it help?" },
  { id: "idea-peer-teaching", kind: "idea", text: "Ask a student who has just understood a concept to explain it to a classmate. Both of them learn it better." },
  { id: "resource-ask", kind: "resource", postType: "ask_help", text: "Planning next week's chapter? Ask your group for a worksheet or activity. Someone may already have one." },
  { id: "encourage-patience", kind: "encouragement", text: "Progress is not always visible in a single day. The patience you show this week shapes how students learn all year." },
];

export function getCommunityPrompt(id: string | null | undefined): CommunityPrompt | undefined {
  if (!id) return undefined;
  return COMMUNITY_PROMPTS.find((p) => p.id === id);
}

/** Whole days since the Unix epoch in the viewer's local time zone. */
export function localDayNumber(date: Date): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
}

/**
 * `count` prompts starting at a day-based offset: the same all day (stable
 * across renders and reloads), moving forward by one each day.
 */
export function promptsForDay(day: number, count: number): CommunityPrompt[] {
  const n = COMMUNITY_PROMPTS.length;
  const start = ((day % n) + n) % n;
  return Array.from({ length: Math.min(count, n) }, (_, i) => COMMUNITY_PROMPTS[(start + i) % n]);
}

/** The day's prompt among those that invite a post (for the Community page header). */
export function invitingPromptForDay(day: number): CommunityPrompt {
  const inviting = COMMUNITY_PROMPTS.filter((p) => p.postType);
  return inviting[((day % inviting.length) + inviting.length) % inviting.length];
}

/** Community page URL that opens the composer, optionally answering a prompt. */
export function communityComposeHref(promptId?: string): string {
  return promptId ? `/community?compose=1&prompt=${encodeURIComponent(promptId)}` : "/community?compose=1";
}
