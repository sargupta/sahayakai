"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowUpRight,
  AudioLines,
  Bell,
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileText,
  FlaskConical,
  Gauge,
  GraduationCap,
  HeartPulse,
  Home,
  Library,
  Lightbulb,
  ListChecks,
  MessageCircle,
  PencilRuler,
  PenLine,
  ShieldCheck,
  Terminal,
  User,
  Users,
  Zap,
} from "lucide-react"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { db, auth } from "@/lib/firebase"
import { useLanguage } from "@/context/language-context"
import { ProductSideNav, type NavBadge, type NavSection } from "@/components/shell/side-nav"
import { SahayakWordmark, SamparkMark } from "@/components/shell/brand"
import { useNavAccess } from "@/components/shell/use-nav-access"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { samparkEntryUrl, isExternalUrl } from "@/lib/products"
import { pressVidyaEntry } from "@/lib/vidya-entry"

/**
 * SahayakAI sidebar — design-system navigation (decided 26 Oct 2026):
 *
 *   Talk to VIDYA
 *   Home · Library · Community · Profile      the four destinations
 *   Make      lesson plan, worksheet, quiz, exam paper, rubric, instant answer
 *   Class     attendance at /attendance, for every teacher (the class
 *             registers; parent calls start from a class register)
 *   Messages · Notifications                  with unread counts
 *   Explore   folded: shared resources, usage, privacy; Labs and the
 *             internal dashboards only for staff / labsNav beta testers
 *   footer    the one SamparkAI entry, only while SamparkAI is switched on
 *             for this deployment (nav-access `sampark`, the server's
 *             SAMPARK_ENABLED; hidden while off or unknown, since the
 *             SamparkAI APIs answer 404 then). It opens the SamparkAI
 *             workspace's school picker, and the SamparkAI APIs admit school
 *             admins only. The account (profile, classes, settings, sign out)
 *             lives in the header avatar menu only.
 *
 * Layout and states live in ProductSideNav (rail 768–1023px, sidebar from
 * 1024px, foldable). The phone uses the TabBar and this same sidebar inside
 * the menu sheet (`forceFull`). The command palette (⌘K) stays the flat
 * search across every route.
 */

function countBadge(count: number, label: string, tone: NavBadge["tone"], testId?: string): NavBadge | null {
  if (count <= 0) return null
  return { text: count > 9 ? "9+" : String(count), label, tone, testId }
}

interface AppSidebarProps {
  collapsed?: boolean
  onToggleCollapsed?: () => void
  /** Render the full sidebar regardless of width (phone menu sheet). */
  forceFull?: boolean
  onNavigate?: () => void
}

export function AppSidebar({ collapsed = false, onToggleCollapsed, forceFull = false, onNavigate }: AppSidebarProps) {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const { t } = useLanguage()
  const [totalUnread, setTotalUnread] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [sidebarUserId, setSidebarUserId] = useState<string | null>(null)
  const access = useNavAccess(sidebarUserId)

  // Live unread badges — conversation + notification unread counts.
  // Connection requests show as Notifications (NOT Messages), so the
  // notifications subscription powers the Bell badge.
  useEffect(() => {
    let unsubConv: (() => void) | undefined
    let unsubNotif: (() => void) | undefined
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubConv?.()
      unsubNotif?.()
      unsubConv = undefined
      unsubNotif = undefined

      if (!user) {
        setTotalUnread(0)
        setUnreadNotifications(0)
        setSidebarUserId(null)
        return
      }

      setSidebarUserId(user.uid)
      const convQ = query(
        collection(db, "conversations"),
        where("participantIds", "array-contains", user.uid),
      )
      unsubConv = onSnapshot(convQ, (snap) => {
        let count = 0
        snap.docs.forEach((d) => { count += d.data().unreadCount?.[user.uid] ?? 0 })
        setTotalUnread(count)
      })

      const notifQ = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        where("isRead", "==", false),
      )
      unsubNotif = onSnapshot(
        notifQ,
        (snap) => { setUnreadNotifications(snap.size) },
        (err) => {
          // A missing composite index must not break the sidebar; the badge just won't show.
          console.warn('[AppSidebar] notifications subscription error', err)
          setUnreadNotifications(0)
        },
      )
    })

    return () => {
      unsubAuth()
      unsubConv?.()
      unsubNotif?.()
    }
  }, [])

  const starts = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/")

  // No feature highlights in the sidebar (no "Start here!" spotlight, no "New" badges):
  // every destination is shown the same way. Only real unread counts are badged.

  const sections: NavSection[] = [
    {
      key: "destinations",
      tier: "primary",
      items: [
        { key: "home", label: t("Home"), icon: Home, href: "/", active: pathname === "/" },
        { key: "library", label: t("Library"), icon: Library, href: "/my-library", active: starts("/my-library") },
        {
          key: "community",
          label: t("Community"),
          icon: Users,
          href: "/community",
          active: starts("/community"),
        },
        {
          key: "profile",
          label: t("Profile"),
          icon: User,
          href: "/my-profile",
          active: starts("/my-profile") || starts("/settings") || starts("/usage"),
        },
      ],
    },
    {
      key: "make",
      label: t("Make"),
      tier: "secondary",
      fold: { icon: PenLine, railLabel: t("Make"), defaultOpen: true },
      items: [
        { key: "lesson-plan", label: t("Lesson Plan"), icon: CalendarDays, href: "/lesson-plan", active: starts("/lesson-plan") },
        { key: "worksheet", label: t("Worksheet"), icon: PencilRuler, href: "/worksheet-wizard", active: starts("/worksheet-wizard") },
        { key: "quiz", label: t("Quiz"), icon: ListChecks, href: "/quiz-generator", active: starts("/quiz-generator") },
        { key: "exam-paper", label: t("Exam Paper"), icon: FileText, href: "/exam-paper", active: starts("/exam-paper") },
        { key: "rubric", label: t("Rubric"), icon: ClipboardCheck, href: "/rubric-generator", active: starts("/rubric-generator") },
        { key: "instant-answer", label: t("Instant Answer"), icon: Lightbulb, href: "/instant-answer", active: starts("/instant-answer") },
      ],
    },
    {
      key: "class",
      label: t("Class"),
      tier: "secondary",
      items: [
        // The teacher's class registers and parent-call modal. Never a SamparkAI URL: SamparkAI is off in
        // production and admits school admins only (src/__tests__/components/nav-surfaces-sampark-gate.test.tsx).
        { key: "attendance", label: t("Attendance"), shortLabel: t("Class"), icon: ClipboardList, href: "/attendance", active: starts("/attendance") },
      ],
    },
    {
      // Back in the main nav (it was parked in Labs by the July IA refocus); always visible, never folded.
      key: "training",
      tier: "secondary",
      items: [
        { key: "teacher-training", label: t("AI Coach"), shortLabel: t("AI Coach"), icon: GraduationCap, href: "/teacher-training", active: starts("/teacher-training") },
      ],
    },
  ]

  if (sidebarUserId) {
    sections.push({
      key: "inbox",
      tier: "secondary",
      items: [
        {
          key: "messages",
          label: t("Messages"),
          icon: MessageCircle,
          href: "/messages",
          active: starts("/messages"),
          badge: countBadge(totalUnread, `${totalUnread} ${t("unread messages")}`, "accent"),
        },
        {
          key: "notifications",
          label: t("Notifications"),
          shortLabel: t("Alerts"),
          icon: Bell,
          href: "/notifications",
          active: starts("/notifications"),
          badge: countBadge(unreadNotifications, `${unreadNotifications} unread notifications`, "danger", "notifications-badge"),
        },
      ],
    })
  }

  const exploreItems: NavSection["items"] = [
    { key: "resources", label: t("Shared resources"), icon: BookMarked, href: "/community-library", active: starts("/community-library") },
    { key: "usage", label: t("Usage"), icon: Gauge, href: "/usage", active: false },
    { key: "privacy", label: t("Privacy"), icon: ShieldCheck, href: "/privacy-for-teachers", active: starts("/privacy-for-teachers") },
  ]
  if (access.labs) {
    exploreItems.push({ key: "labs", label: t("Labs"), icon: FlaskConical, href: "/labs", active: starts("/labs") })
  }
  if (access.staff) {
    exploreItems.push(
      { key: "mission-control", label: t("Mission Control"), icon: Zap, href: "/admin/cost-dashboard", active: starts("/admin/cost-dashboard") },
      { key: "logs", label: t("Log Dashboard"), icon: Terminal, href: "/admin/log-dashboard", active: starts("/admin/log-dashboard") },
      { key: "ai-health", label: t("AI Health"), icon: HeartPulse, href: "/admin/system-health", active: starts("/admin/system-health") },
    )
  }
  sections.push({
    key: "explore",
    label: t("Explore"),
    tier: "secondary",
    fold: { icon: Compass, railLabel: t("Explore"), defaultOpen: false },
    items: exploreItems,
  })

  const talkToVidya = () => {
    onNavigate?.()
    if (!pressVidyaEntry()) router.push("/")
  }

  const lead = (mode: "full" | "rail") =>
    mode === "full" ? (
      <button
        type="button"
        onClick={talkToVidya}
        className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-pill border border-tint-accent-border bg-tint-accent px-4 text-left font-display text-value font-semibold text-saffron-700 transition-colors duration-small ease-standard hover:bg-tint-accent-strong"
      >
        <AudioLines aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1">{t("Talk to VIDYA")}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={talkToVidya}
        aria-label={t("Talk to VIDYA")}
        className="focus-ring group/rail flex min-h-11 w-full flex-col items-center gap-1 rounded-tile py-1.5"
      >
        <span className="flex h-9 w-12 items-center justify-center rounded-pill border border-tint-accent-border bg-tint-accent text-saffron-700 transition-colors duration-small ease-standard group-hover/rail:bg-tint-accent-strong">
          <AudioLines aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px]" />
        </span>
        <span className="text-xs font-semibold leading-tight text-saffron-700">VIDYA</span>
      </button>
    )

  // The one SamparkAI entry in SahayakAI's navigation. samparkUrl() picks the
  // configured SamparkAI origin (NEXT_PUBLIC_SAMPARK_URL, e.g.
  // https://sampark.sahayakai.com) or, unset, /sampark on this origin;
  // samparkEntryPath() opens the demo school on a demo deployment.
  const samparkHref = samparkEntryUrl()
  // Returns the element itself (not a component) so TooltipTrigger asChild can
  // attach its ref and handlers to the <a>.
  const samparkLink = ({ className, children, label }: { className: string; children: React.ReactNode; label?: string }) =>
    isExternalUrl(samparkHref) ? (
      <a href={samparkHref} className={className} aria-label={label} data-testid="sampark-entry">{children}</a>
    ) : (
      <Link href={samparkHref} className={className} aria-label={label} onClick={onNavigate} data-testid="sampark-entry">{children}</Link>
    )

  // The SamparkAI entry shows only once the server says SamparkAI is on
  // (access.sampark); signed out, that is unknown, so it stays hidden. The
  // teacher's account (profile, classes, settings, sign out) is not repeated
  // here: its one entry is the header avatar menu (AuthButton), plus the
  // Profile destination above.
  const footer = (mode: "full" | "rail") => {
    if (mode === "rail") {
      return (
        <div className="flex flex-col items-center gap-2">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                {samparkLink({
                  label: t("Open SamparkAI"),
                  className: "focus-ring flex min-h-11 w-full flex-col items-center gap-1 rounded-tile py-1",
                  children: (
                    <>
                      <SamparkMark className="h-8 w-8" />
                      <span className="text-xs font-medium leading-tight text-ink-600">Sampark</span>
                    </>
                  ),
                })}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {t("SamparkAI · Calls and notices to parents")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        {samparkLink({
          className: "focus-ring group/sp flex min-h-12 items-center gap-3 rounded-field border border-line-glass bg-surface-glass-soft px-3 py-2 transition-colors duration-small ease-standard hover:bg-surface-glass-strong",
          children: (
            <>
              <SamparkMark />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-value font-semibold leading-tight text-ink-900">SamparkAI</span>
                <span className="block text-xs leading-snug text-ink-500">{t("Calls and notices to parents")}</span>
              </span>
              <ArrowUpRight aria-hidden="true" strokeWidth={1.7} className="h-4 w-4 shrink-0 text-ink-500 group-hover/sp:text-ink-900" />
            </>
          ),
        })}
      </div>
    )
  }

  return (
    <ProductSideNav
      label="SahayakAI"
      brand={<SahayakWordmark />}
      brandCompact={<SahayakWordmark compact />}
      brandHref="/"
      lead={lead}
      sections={sections}
      footer={access.sampark ? footer : undefined}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      forceFull={forceFull}
      onNavigate={onNavigate}
      collapseLabel={t("Fold sidebar")}
      expandLabel={t("Unfold sidebar")}
    />
  )
}
