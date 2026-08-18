import {
  type LucideIcon,
  NotebookPen,
  Sparkles,
  PhoneCall,
  Users,
  Inbox,
  LayoutGrid,
} from "lucide-react";

/**
 * Pillar metadata + English source copy.
 *
 * Translated text lives in the per-locale dictionaries at
 * `pillar.{id}.name` / `pillar.{id}.desc` / `pillar.{id}.rotating`
 * (src/locales/<language>.json). English, however, carries NO
 * dictionary — the i18n convention is "the key IS the English string",
 * so `t()` falls back to the key on a miss. These pillar keys are
 * abstract ids, not English sentences, so that fallback would render
 * the raw key (e.g. "pillar.prep-desk.name"). We therefore keep the
 * English copy here and resolve via `pillarText()`, which uses the
 * translation when present and this English source otherwise (English,
 * or any locale missing a key).
 */
export type PillarTextKind = "name" | "desc" | "rotating";

export type Pillar = {
  number: string;
  /** Stable identifier — used to derive translation dictionary keys. */
  id: "prep-desk" | "ai-co-teacher" | "parent-hotline" | "staffroom" | "pro-inbox" | "operating-system";
  Icon: LucideIcon;
  /** English source copy — fallback when the locale has no entry. */
  en: Record<PillarTextKind, string>;
};

export const pillars: Pillar[] = [
  {
    number: "01",
    id: "prep-desk",
    Icon: NotebookPen,
    en: {
      name: "Prep desk",
      desc: "Voice-first lesson prep · 7 AI tools · 11 languages",
      rotating: "a prep desk.",
    },
  },
  {
    number: "02",
    id: "ai-co-teacher",
    Icon: Sparkles,
    en: {
      name: "AI co-teacher",
      desc: "VIDYA · persistent pedagogy coach on every page",
      rotating: "an AI co-teacher.",
    },
  },
  {
    number: "03",
    id: "parent-hotline",
    Icon: PhoneCall,
    en: {
      name: "Parent hotline",
      desc: "AI voice calls to parents in their own language",
      rotating: "a parent hotline.",
    },
  },
  {
    number: "04",
    id: "staffroom",
    Icon: Users,
    en: {
      name: "Staffroom",
      desc: "India's first structured professional teacher network",
      rotating: "a staffroom.",
    },
  },
  {
    number: "05",
    id: "pro-inbox",
    Icon: Inbox,
    en: {
      name: "Pro inbox",
      desc: "Purpose-built professional messaging, structured + searchable",
      rotating: "a professional inbox.",
    },
  },
  {
    number: "06",
    id: "operating-system",
    Icon: LayoutGrid,
    en: {
      name: "Operating system",
      desc: "PWA · 28 state boards · works on the cheapest Android phones",
      rotating: "an operating system.",
    },
  },
];

/**
 * Resolve pillar text for the active locale. `t()` returns the raw key
 * on a miss (which is what English does for these abstract keys), so we
 * fall back to the built-in English copy whenever that happens.
 */
export function pillarText(
  t: (key: string) => string,
  pillar: Pillar,
  kind: PillarTextKind,
): string {
  const key = `pillar.${pillar.id}.${kind}`;
  const translated = t(key);
  return translated === key ? pillar.en[kind] : translated;
}
