"use client"

import { useCallback, useEffect, useState } from "react"
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
  HeartPulse,
  Home,
  Library,
  Lightbulb,
  ListChecks,
  MessageCircle,
  PencilRuler,
  PenLine,
  Settings,
  ShieldCheck,
  Terminal,
  User,
  Users,
  Zap,
} from "lucide-react"
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { db, auth } from "@/lib/firebase"
import { isNewUser as checkIsNewUser } from "@/lib/profile-utils"
import { FeatureSpotlight, SPOTLIGHT_IDS } from "@/components/onboarding/feature-spotlight"
import { updateProfileAction } from "@/lib/api/profile"
import { useLanguage } from "@/context/language-context"
import { ProductSideNav, type NavBadge, type NavSection } from "@/components/shell/side-nav"
import { SahayakWordmark, SamparkMark } from "@/components/shell/brand"
import { useNavAccess } from "@/components/shell/use-nav-access"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { samparkUrl, isExternalUrl } from "@/lib/products"
import { pressVidyaEntry } from "@/lib/vidya-entry"
import { cn } from "@/lib/utils"
import type { UserProfile } from "@/types"

/**
 * SahayakAI sidebar — design-system navigation (decided 26 Oct 2026):
 *
 *   Talk to VIDYA
 *   Home · Library · Community · Profile      the four destinations
 *   Make      lesson plan, worksheet, quiz, exam paper, rubric, instant answer
 *   Class     attendance (parent calls start from a class register)
 *   Messages · Notifications                  with unread counts
 *   Explore   folded: shared resources, usage, privacy; Labs and the
 *             internal dashboards only for staff / labsNav beta testers
 *   footer    the one SamparkAI entry (every signed-in user; it opens the
 *             SamparkAI workspace's school picker, and the SamparkAI APIs
 *             admit school admins only), then the teacher's account
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

function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase()
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
  const [showCommunityNew, setShowCommunityNew] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [spotlightsSeen, setSpotlightsSeen] = useState<string[]>([])
  const [sidebarUserId, setSidebarUserId] = useState<string | null>(null)
  const [account, setAccount] = useState<{ name: string | null; photoURL: string | null }>({ name: null, photoURL: null })
  const access = useNavAccess(sidebarUserId)

  const handleSpotlightDismiss = useCallback((id: string) => {
    setSpotlightsSeen(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      if (sidebarUserId) {
        updateProfileAction(sidebarUserId, { featureSpotlightsSeen: next }).catch(() => {})
      }
      return next
    })
  }, [sidebarUserId])

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
        setShowCommunityNew(false)
        setSidebarUserId(null)
        setAccount({ name: null, photoURL: null })
        return
      }

      setSidebarUserId(user.uid)
      setAccount({ name: user.displayName ?? null, photoURL: user.photoURL ?? null })
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        const data = snap.data()
        setShowCommunityNew(data?.communityIntroState === 'ready')
        setIsNewUser(checkIsNewUser(data as Partial<UserProfile>))
        setSpotlightsSeen(data?.featureSpotlightsSeen ?? [])
        if (typeof data?.displayName === "string" && data.displayName) {
          setAccount((a) => ({ ...a, name: data.displayName }))
        }
      }).catch(() => {})

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

  const dismissCommunityNew = () => {
    if (!showCommunityNew) return
    setShowCommunityNew(false)
    const u = auth.currentUser
    if (u) updateDoc(doc(db, "users", u.uid), { communityIntroState: 'visited' }).catch(() => {})
  }

  const lessonSpotlight = sidebarUserId && isNewUser
    ? (node: React.ReactNode) => (
        <FeatureSpotlight
          id={SPOTLIGHT_IDS.SIDEBAR_LESSON_PLAN}
          message="Start here! Create your first lesson plan"
          seenSpotlights={spotlightsSeen}
          onDismiss={handleSpotlightDismiss}
          position="right"
          delay={1000}
        >
          {node}
        </FeatureSpotlight>
      )
    : undefined

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
          onSelect: dismissCommunityNew,
          badge: showCommunityNew ? { text: t("New"), label: t("New in Community") } : null,
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
        { key: "lesson-plan", label: t("Lesson Plan"), icon: CalendarDays, href: "/lesson-plan", active: starts("/lesson-plan"), wrap: lessonSpotlight },
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
        { key: "attendance", label: t("Attendance"), shortLabel: t("Class"), icon: ClipboardList, href: "/attendance", active: starts("/attendance") },
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
  // https://sampark.sahayakai.com) or, unset, /sampark on this origin.
  const samparkHref = samparkUrl("/workspace")
  // Returns the element itself (not a component) so TooltipTrigger asChild can
  // attach its ref and handlers to the <a>.
  const samparkLink = ({ className, children, label }: { className: string; children: React.ReactNode; label?: string }) =>
    isExternalUrl(samparkHref) ? (
      <a href={samparkHref} className={className} aria-label={label} data-testid="sampark-entry">{children}</a>
    ) : (
      <Link href={samparkHref} className={className} aria-label={label} onClick={onNavigate} data-testid="sampark-entry">{children}</Link>
    )

  const initials = initialsOf(account.name)
  const avatar = (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-milk-400 font-display text-tile font-semibold text-ink-900">
      {account.photoURL ? (
        <img src={account.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : initials ? initials : (
        <User strokeWidth={1.7} className="h-4 w-4 text-ink-500" />
      )}
    </span>
  )

  // The SamparkAI entry shows signed in or out (SamparkAI's workspace has its
  // own sign-in gate); the account row only for a signed-in teacher.
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
          {sidebarUserId && (
            <Link href="/my-profile" onClick={onNavigate} aria-label={t("Profile")} className="focus-ring flex h-11 w-11 items-center justify-center rounded-pill">
              {avatar}
            </Link>
          )}
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
        {sidebarUserId && (
          <div className="flex items-center gap-1">
            <Link
              href="/my-profile"
              onClick={onNavigate}
              className={cn(
                "focus-ring flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-pill px-1.5 py-1 transition-colors duration-small ease-standard hover:bg-tint-subtle",
              )}
            >
              {avatar}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-tile font-semibold leading-tight text-ink-900">{account.name ?? t("Your account")}</span>
                <span className="block text-xs leading-tight text-ink-500">{t("Profile and classes")}</span>
              </span>
            </Link>
            <Link
              href="/settings"
              onClick={onNavigate}
              aria-label={t("Settings")}
              title={t("Settings")}
              aria-current={starts("/settings") ? "page" : undefined}
              className={cn(
                "focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill transition-colors duration-small ease-standard",
                starts("/settings") ? "bg-milk-400 text-saffron-600" : "text-ink-500 hover:bg-tint-subtle hover:text-ink-900",
              )}
            >
              <Settings aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px]" />
            </Link>
          </div>
        )}
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
      footer={footer}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      forceFull={forceFull}
      onNavigate={onNavigate}
      collapseLabel={t("Fold sidebar")}
      expandLabel={t("Unfold sidebar")}
    />
  )
}
