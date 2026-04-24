import {
  type LucideIcon,
  NotebookPen,
  Sparkles,
  PhoneCall,
  Users,
  Inbox,
  LayoutGrid,
} from "lucide-react";

export type Pillar = {
  number: string;
  name: string;
  description: string;
  rotatingPhrase: string;
  Icon: LucideIcon;
};

export const pillars: Pillar[] = [
  {
    number: "01",
    name: "Prep desk",
    description: "Voice-first lesson prep · 7 AI tools · 11 languages",
    rotatingPhrase: "a prep desk.",
    Icon: NotebookPen,
  },
  {
    number: "02",
    name: "AI co-teacher",
    description: "VIDYA · persistent pedagogy coach on every page",
    rotatingPhrase: "an AI co-teacher.",
    Icon: Sparkles,
  },
  {
    number: "03",
    name: "Parent hotline",
    description: "AI voice calls to parents in their own language",
    rotatingPhrase: "a parent hotline.",
    Icon: PhoneCall,
  },
  {
    number: "04",
    name: "Staffroom",
    description: "India's first structured professional teacher network",
    rotatingPhrase: "a staffroom.",
    Icon: Users,
  },
  {
    number: "05",
    name: "Pro inbox",
    description: "Purpose-built professional messaging, structured + searchable",
    rotatingPhrase: "a professional inbox.",
    Icon: Inbox,
  },
  {
    number: "06",
    name: "Operating system",
    description: "PWA · 28 state boards · works on the cheapest Android phones",
    rotatingPhrase: "an operating system.",
    Icon: LayoutGrid,
  },
];
