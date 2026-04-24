"use client";

import {
  useEffect,
  useState,
  useMemo,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  BarChart,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  FileText,
  Globe2,
  GraduationCap,
  Home,
  Images,
  Library,
  Lightbulb,
  MessageCircle,
  PencilRuler,
  Search,
  Settings,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";

/**
 * Command palette — Phase 3 (2026-04-24).
 *
 * ⌘K / Ctrl+K anywhere opens a keyboard-driven palette indexing every app
 * route with searchable labels + keywords. Mobile: the header search icon
 * opens the same palette.
 *
 * Usage: mount once at the app shell level. The hook manages its own
 * global key binding and open/close state.
 */

type Route = {
  href: string;
  label: string;
  i18nKey: string;
  keywords: string;
  group: string;
  icon: ComponentType<{ className?: string }>;
};

const ROUTES: Route[] = [
  // Home
  { href: "/", label: "Home", i18nKey: "Home", keywords: "home dashboard start", group: "Home", icon: Home },

  // Create
  { href: "/lesson-plan", label: "Lesson Plan", i18nKey: "Lesson Plan", keywords: "lesson plan create teach class ncert", group: "Create", icon: CalendarDays },
  { href: "/worksheet-wizard", label: "Worksheet Wizard", i18nKey: "Worksheet Wizard", keywords: "worksheet practice homework print", group: "Create", icon: PencilRuler },
  { href: "/visual-aid-designer", label: "Visual Aid Designer", i18nKey: "Visual Aid Designer", keywords: "visual aid diagram illustration image drawing", group: "Create", icon: Images },
  { href: "/content-creator", label: "Content Creator", i18nKey: "Content Creator", keywords: "content story creator write", group: "Create", icon: BookOpen },

  // Assess
  { href: "/quiz-generator", label: "Quiz Generator", i18nKey: "Quiz Generator", keywords: "quiz test assessment mcq", group: "Assess", icon: FileSignature },
  { href: "/rubric-generator", label: "Rubric Generator", i18nKey: "Rubric Generator", keywords: "rubric grade score marking", group: "Assess", icon: ClipboardCheck },
  { href: "/exam-paper", label: "Exam Paper", i18nKey: "Exam Paper", keywords: "exam paper board question", group: "Assess", icon: FileText },
  { href: "/attendance", label: "Attendance", i18nKey: "Attendance", keywords: "attendance roll call marks", group: "Assess", icon: ClipboardList },

  // Engage
  { href: "/video-storyteller", label: "Video Storyteller", i18nKey: "Video Storyteller", keywords: "video storyteller youtube recommend", group: "Engage", icon: Video },
  { href: "/virtual-field-trip", label: "Virtual Field Trip", i18nKey: "Virtual Field Trip", keywords: "virtual field trip explore visit", group: "Engage", icon: Globe2 },
  { href: "/teacher-training", label: "Teacher Training", i18nKey: "Teacher Training", keywords: "teacher training professional development cpd", group: "Engage", icon: GraduationCap },
  { href: "/community", label: "Community", i18nKey: "Community", keywords: "community teachers chat discover", group: "Engage", icon: Library },

  // Ask
  { href: "/instant-answer", label: "Instant Answer", i18nKey: "Instant Answer", keywords: "instant answer question search knowledge", group: "Ask", icon: Lightbulb },

  // My work
  { href: "/my-library", label: "My Library", i18nKey: "My Library", keywords: "library saved my work folder", group: "My work", icon: Library },
  { href: "/messages", label: "Messages", i18nKey: "Messages", keywords: "messages chat dm", group: "My work", icon: MessageCircle },
  { href: "/impact-dashboard", label: "Impact", i18nKey: "Impact", keywords: "impact dashboard stats usage", group: "My work", icon: BarChart },
  { href: "/notifications", label: "Notifications", i18nKey: "Notifications", keywords: "notifications alerts", group: "My work", icon: Bell },

  // Account
  { href: "/my-profile", label: "My Profile", i18nKey: "My Profile", keywords: "profile account bio", group: "Account", icon: User },
  { href: "/settings", label: "Settings", i18nKey: "Settings", keywords: "settings preferences language", group: "Account", icon: Settings },
  { href: "/privacy-for-teachers", label: "Privacy", i18nKey: "Privacy", keywords: "privacy policy terms", group: "Account", icon: ShieldCheck },
  { href: "/pricing", label: "Pricing & Billing", i18nKey: "Pricing", keywords: "pricing billing subscription upgrade plan", group: "Account", icon: Settings },
];

export function CommandPalette() {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  // Global ⌘K / Ctrl+K keybinding + `/` shortcut
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, Route[]>();
    for (const r of ROUTES) {
      const list = groups.get(r.group) ?? [];
      list.push(r);
      groups.set(r.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-2xl gap-0 overflow-hidden rounded-surface-md shadow-floating">
        <Command
          className="flex flex-col"
          label={t("Command palette")}
          shouldFilter={true}
          filter={(value, search, keywords) => {
            const haystack = `${value} ${keywords?.join(" ") ?? ""}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              autoFocus
              placeholder={t("Search tools, pages, actions…")}
              className="flex h-12 w-full bg-transparent px-3 type-body text-foreground placeholder:text-muted-foreground outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground pointer-events-none select-none">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center type-body text-muted-foreground">
              {t("No matches. Try a different word.")}
            </Command.Empty>
            {grouped.map(([groupName, items]) => (
              <Command.Group
                key={groupName}
                heading={t(groupName)}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:type-caption [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {items.map((r) => {
                  const Icon = r.icon;
                  return (
                    <Command.Item
                      key={r.href}
                      value={`${r.label} ${r.group}`}
                      keywords={[r.keywords, r.group, r.label]}
                      onSelect={() => handleSelect(r.href)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-surface-sm cursor-pointer type-body text-foreground aria-selected:bg-primary/10 aria-selected:text-foreground transition-colors duration-micro ease-out-quart"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{t(r.i18nKey)}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
          <div className="border-t border-border px-4 py-2 flex items-center gap-3 type-caption text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-surface-sm bg-muted">↑↓</kbd>
              <span className="lowercase">{t("navigate")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-surface-sm bg-muted">↵</kbd>
              <span className="lowercase">{t("open")}</span>
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-surface-sm bg-muted">⌘</kbd>
              <kbd className="px-1.5 py-0.5 rounded-surface-sm bg-muted">K</kbd>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Exported helper — opens the palette from any click handler (e.g. mobile
 * search icon in the header). The palette state is internal to <CommandPalette>,
 * so this dispatches a keyboard event to trigger the same global listener.
 */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}
