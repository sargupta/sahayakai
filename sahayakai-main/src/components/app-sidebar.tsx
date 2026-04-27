
"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"
import { UsageDisplay } from "@/components/usage-display"
import {
  BarChart,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
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
  Settings,
  ShieldCheck,
  Terminal,
  User,
  Video,
  Zap,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { isNewUser as checkIsNewUser } from "@/lib/profile-utils"
import { FeatureSpotlight, SPOTLIGHT_IDS } from "@/components/onboarding/feature-spotlight"
import { updateProfileAction } from "@/app/actions/profile"
import { useLanguage } from "@/context/language-context"
import type { UserProfile } from "@/types"

/**
 * App sidebar — Phase 3 restructure (2026-04-24).
 *
 * Intent-grouped navigation: Home / Create / Assess / Engage / Ask / My work / Account.
 * Progressive disclosure: new users see minimum set, full tree unlocks after
 * first lesson plan is saved.
 *
 * The command palette (⌘K, see command-palette.tsx) provides a flat keyword
 * search across all routes — sidebar is the "browse" affordance, palette is
 * the "search" affordance.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { t } = useLanguage();
  const [totalUnread, setTotalUnread] = useState(0);
  const [showCommunityNew, setShowCommunityNew] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const [spotlightsSeen, setSpotlightsSeen] = useState<string[]>([]);
  const [sidebarUserId, setSidebarUserId] = useState<string | null>(null);

  const handleNavClick = (href: string) => {
    setOpenMobile(false); // always close — no-op on desktop
    router.push(href);
  };

  const handleSpotlightDismiss = useCallback((id: string) => {
    setSpotlightsSeen(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (sidebarUserId) {
        updateProfileAction(sidebarUserId, { featureSpotlightsSeen: next }).catch(() => {});
      }
      return next;
    });
  }, [sidebarUserId]);

  // Live unread badge — subscribe to conversation unread counts
  useEffect(() => {
    let unsubConv: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubConv?.();
      unsubConv = undefined;

      if (!user) {
        setTotalUnread(0);
        setShowCommunityNew(false);
        setSidebarUserId(null);
        return;
      }

      setSidebarUserId(user.uid);
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        const data = snap.data();
        const state = data?.communityIntroState;
        setShowCommunityNew(state === 'ready');
        setIsNewUser(checkIsNewUser(data as Partial<UserProfile>));
        setSpotlightsSeen(data?.featureSpotlightsSeen ?? []);
      }).catch(() => {});

      const q = query(
        collection(db, "conversations"),
        where("participantIds", "array-contains", user.uid),
      );
      unsubConv = onSnapshot(q, (snap) => {
        let count = 0;
        snap.docs.forEach((d) => { count += d.data().unreadCount?.[user.uid] ?? 0; });
        setTotalUnread(count);
      });
    });

    return () => {
      unsubAuth();
      unsubConv?.();
    };
  }, []);

  // Visibility predicate: for non-essential items, gate behind isNewUser unlock.
  const canShowAdvanced = !isNewUser || showAllTools;

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("Home")} isActive={pathname === '/'} variant="outline">
              <Link href="/" onClick={() => handleNavClick('/')}>
                <Home />
                <span>{t("Home")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* CREATE — authoring tools */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("Create")}</SidebarGroupLabel>
          <SidebarMenu>
            {/* Bug #5 (audit 2026-04-27): FeatureSpotlight was rendering its
                pulse-ring around Lesson Plan for unauthenticated visitors too,
                creating the "two active items" visual conflict. Now gated to
                authenticated NEW users only — established users + signed-out
                visitors get the plain item with only the real isActive style. */}
            {sidebarUserId && isNewUser ? (
              <FeatureSpotlight
                id={SPOTLIGHT_IDS.SIDEBAR_LESSON_PLAN}
                message="Start here! Create your first lesson plan"
                seenSpotlights={spotlightsSeen}
                onDismiss={handleSpotlightDismiss}
                position="right"
                delay={1000}
              >
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/lesson-plan')} tooltip={t("Lesson Plan")}>
                    <Link href="/lesson-plan" onClick={() => handleNavClick('/lesson-plan')}>
                      <CalendarDays />
                      <span>{t("Lesson Plan")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </FeatureSpotlight>
            ) : (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/lesson-plan')} tooltip={t("Lesson Plan")}>
                  <Link href="/lesson-plan" onClick={() => handleNavClick('/lesson-plan')}>
                    <CalendarDays />
                    <span>{t("Lesson Plan")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {canShowAdvanced && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/worksheet-wizard')} tooltip={t("Worksheet Wizard")}>
                    <Link href="/worksheet-wizard" onClick={() => handleNavClick('/worksheet-wizard')}>
                      <PencilRuler />
                      <span>{t("Worksheet Wizard")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/visual-aid-designer')} tooltip={t("Visual Aid Designer")}>
                    <Link href="/visual-aid-designer" onClick={() => handleNavClick('/visual-aid-designer')}>
                      <Images />
                      <span>{t("Visual Aid Designer")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/content-creator')} tooltip={t("Content Creator")}>
                    <Link href="/content-creator" onClick={() => handleNavClick('/content-creator')}>
                      <BookOpen />
                      <span>{t("Content Creator")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* ASSESS — evaluation tools */}
        {canShowAdvanced && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("Assess")}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/quiz-generator')} tooltip={t("Quiz Generator")}>
                  <Link href="/quiz-generator" onClick={() => handleNavClick('/quiz-generator')}>
                    <FileSignature />
                    <span>{t("Quiz Generator")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/rubric-generator')} tooltip={t("Rubric Generator")}>
                  <Link href="/rubric-generator" onClick={() => handleNavClick('/rubric-generator')}>
                    <ClipboardCheck />
                    <span>{t("Rubric Generator")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/exam-paper')} tooltip={t("Exam Paper")}>
                  <Link href="/exam-paper" onClick={() => handleNavClick('/exam-paper')}>
                    <FileText />
                    <span>{t("Exam Paper")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/attendance')} tooltip={t("Attendance")}>
                  <Link href="/attendance" onClick={() => handleNavClick('/attendance')}>
                    <ClipboardList />
                    <span>{t("Attendance")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* ENGAGE — classroom engagement tools */}
        {canShowAdvanced && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("Engage")}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/video-storyteller')} tooltip={t("Video Storyteller")}>
                  <Link href="/video-storyteller" onClick={() => handleNavClick('/video-storyteller')}>
                    <Video />
                    <span>{t("Video Storyteller")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/virtual-field-trip')} tooltip={t("Virtual Field Trip")}>
                  <Link href="/virtual-field-trip" onClick={() => handleNavClick('/virtual-field-trip')}>
                    <Globe2 />
                    <span>{t("Virtual Field Trip")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/teacher-training')} tooltip={t("Teacher Training")}>
                  <Link href="/teacher-training" onClick={() => handleNavClick('/teacher-training')}>
                    <GraduationCap />
                    <span>{t("Teacher Training")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/community')} tooltip={t("Community")}>
                  <Link href="/community" onClick={() => {
                    handleNavClick('/community');
                    if (showCommunityNew) {
                      setShowCommunityNew(false);
                      const u = auth.currentUser;
                      if (u) updateDoc(doc(db, "users", u.uid), { communityIntroState: 'visited' }).catch(() => {});
                    }
                  }} className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      <Library />
                      <span>{t("Community")}</span>
                    </span>
                    {showCommunityNew && (
                      <span className="ml-auto h-[18px] px-1.5 rounded-pill bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">
                        New
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* ASK — Q&A surface */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("Ask")}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/instant-answer')} tooltip={t("Instant Answer")}>
                <Link href="/instant-answer" onClick={() => handleNavClick('/instant-answer')}>
                  <Lightbulb />
                  <span>{t("Instant Answer")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* MY WORK — the teacher's personal workspace */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("My work")}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/my-library')} tooltip={t("My Library")}>
                <Link href="/my-library" onClick={() => handleNavClick('/my-library')}>
                  <Library />
                  <span>{t("My Library")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {canShowAdvanced && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/messages')} tooltip={t("Messages")}>
                    <Link href="/messages" onClick={() => handleNavClick('/messages')} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <MessageCircle />
                        <span>{t("Messages")}</span>
                      </span>
                      {totalUnread > 0 && (
                        <span className="ml-auto h-[18px] min-w-[18px] px-1.5 rounded-pill bg-primary text-white text-[10px] font-black flex items-center justify-center">
                          {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/impact-dashboard')} tooltip={t("Impact")}>
                    <Link href="/impact-dashboard" onClick={() => handleNavClick('/impact-dashboard')}>
                      <BarChart />
                      <span>{t("Impact")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/notifications')} tooltip={t("Notifications")}>
                    <Link href="/notifications" onClick={() => handleNavClick('/notifications')}>
                      <Bell className="text-primary" />
                      <span>{t("Notifications")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* "See all tools" trigger — only for new users hiding advanced groups */}
        {isNewUser && !showAllTools && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setShowAllTools(true)} tooltip={t("See all tools")}>
                  <ChevronDown />
                  <span className="text-muted-foreground">{t("See all tools")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <UsageDisplay />

        {/* ACCOUNT — bottom of main content */}
        <SidebarGroup>
          <SidebarGroupLabel>{t("Account")}</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/my-profile')} tooltip={t("My Profile")}>
                <Link href="/my-profile" onClick={() => handleNavClick('/my-profile')}>
                  <User />
                  <span>{t("My Profile")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/settings')} tooltip={t("Settings")}>
                <Link href="/settings" onClick={() => handleNavClick('/settings')}>
                  <Settings />
                  <span>{t("Settings")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {canShowAdvanced && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/privacy-for-teachers')} tooltip={t("Privacy")}>
                  <Link href="/privacy-for-teachers" onClick={() => handleNavClick('/privacy-for-teachers')}>
                    <ShieldCheck />
                    <span>{t("Privacy")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      {sidebarUserId && (
        <SidebarFooter>
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/cost-dashboard')} tooltip="Mission Control">
                  <Link href="/admin/cost-dashboard" onClick={() => handleNavClick('/admin/cost-dashboard')}>
                    <Zap />
                    <span>Mission Control</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/log-dashboard')} tooltip="Log Dashboard">
                  <Link href="/admin/log-dashboard" onClick={() => handleNavClick('/admin/log-dashboard')}>
                    <Terminal />
                    <span>Log Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
