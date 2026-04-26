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
 * Pillar metadata only. Text content (name, description, rotating
 * phrase) lives in the i18n dictionary at `pillar.{id}.name` /
 * `pillar.{id}.desc` / `pillar.{id}.rotating` so that it translates
 * with the user-selected language. Components resolve text via
 * useLanguage().t(...) at render time.
 */
export type Pillar = {
  number: string;
  /** Stable identifier — used to derive translation dictionary keys. */
  id: "prep-desk" | "ai-co-teacher" | "parent-hotline" | "staffroom" | "pro-inbox" | "operating-system";
  Icon: LucideIcon;
};

export const pillars: Pillar[] = [
  { number: "01", id: "prep-desk",        Icon: NotebookPen },
  { number: "02", id: "ai-co-teacher",    Icon: Sparkles },
  { number: "03", id: "parent-hotline",   Icon: PhoneCall },
  { number: "04", id: "staffroom",        Icon: Users },
  { number: "05", id: "pro-inbox",        Icon: Inbox },
  { number: "06", id: "operating-system", Icon: LayoutGrid },
];
