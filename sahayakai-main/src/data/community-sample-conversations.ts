/**
 * Static sample conversations for the Community feed's empty state.
 *
 * Shown only when the teacher's feed has nothing yet, under an "Examples"
 * label, so a new teacher sees what a good post looks like instead of a blank
 * box. These are written by the SahayakAI team — not real teachers' posts —
 * and carry no likes, counts or timestamps. Strings are English keys passed
 * through t(); missing translations fall back to English.
 */

import type { PostType } from "@/types/community";

export interface SampleConversation {
  id: string;
  postType: PostType;
  /** A role, not a person: these are illustrative, not real authors. */
  persona: string;
  topic: string;
  text: string;
  /** One short example reply, so the card reads as a conversation. */
  reply?: { persona: string; text: string };
}

export const SAMPLE_CONVERSATIONS: SampleConversation[] = [
  {
    id: "sample-shadow-clock",
    postType: "share",
    persona: "Class 6 Science teacher",
    topic: "Science",
    text: "Took my class out at 9, 12 and 3 to trace one stick's shadow in chalk. By the last mark they had worked out on their own why the shadow shrinks and grows. Cost nothing, and they still talk about it.",
    reply: {
      persona: "Class 7 Geography teacher",
      text: "Doing this next week to start directions and the sun's path. Thank you!",
    },
  },
  {
    id: "sample-exit-ticket",
    postType: "share",
    persona: "Class 8 Maths teacher",
    topic: "Assessment",
    text: "Two-minute exit ticket: every student writes one thing they understood and one thing they did not, on a scrap of paper. I read them on the bus home and start the next lesson with the most common doubt.",
  },
  {
    id: "sample-multigrade",
    postType: "ask_help",
    persona: "Primary teacher, two-grade classroom",
    topic: "Multigrade teaching",
    text: "I teach Class 3 and Class 4 together in one room. How do you keep one group working on its own while you teach the other?",
    reply: {
      persona: "Head teacher, rural school",
      text: "Give the older group a 10-minute task with a clear finished product, like 5 sums or a labelled drawing, and pair a strong reader with each table.",
    },
  },
  {
    id: "sample-reading-corner",
    postType: "celebrate",
    persona: "Class 4 English teacher",
    topic: "Reading",
    text: "Our reading corner is made from donated newspapers and old storybooks. This month every child in my class read at least one full story aloud. A shy student read three!",
  },
  {
    id: "sample-fractions-roti",
    postType: "resource",
    persona: "Class 5 Maths teacher",
    topic: "Fractions",
    text: "Paper-roti fractions worksheet: students fold and cut circles into halves, quarters and eighths, then compare. Made it with the SahayakAI Worksheet tool and adapted it for my class.",
  },
  {
    id: "sample-parent-meeting",
    postType: "ask_help",
    persona: "Class 9 class teacher",
    topic: "Parents",
    text: "Parent meeting next Saturday. What is one thing you always say to parents of a student who is struggling, so the conversation stays hopeful?",
  },
];
