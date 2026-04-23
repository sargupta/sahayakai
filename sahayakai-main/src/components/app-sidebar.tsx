
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
import { BarChart, Bell, BookOpen, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, FileSignature, FileText, Globe2, GraduationCap, Images, Library, PencilRuler, Settings, ShieldCheck, Sparkles, Video, Wand2, FolderKanban, User, Zap, Terminal, MessageCircle, Gauge } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { isNewUser as checkIsNewUser } from "@/lib/profile-utils"
import { FeatureSpotlight, SPOTLIGHT_IDS } from "@/components/onboarding/feature-spotlight"
import { updateProfileAction } from "@/app/actions/profile"
import type { UserProfile } from "@/types"

/**
 * Public/marketing surfaces where the teacher-tool sidebar must not render.
 * A cold principal evaluating pricing or privacy should never see the internal
 * AI-tools nav. Expand this list when adding new marketing routes.
 */
const MARKETING_PATHS = ['/for-schools', '/pricing', '/privacy-for-teachers'];

function isMarketingPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return MARKETING_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  // Hide on public/marketing surfaces. SidebarProvider still wraps so context
  // stays available to SidebarTrigger in the header; the trigger button renders
  // but toggles nothing visible, which is an acceptable degradation on marketing
  // pages. When landing-page-restore merges, we can move these routes into the
  // (marketing) route group with its own layout that omits the trigger entirely.
  if (isMarketingPath(pathname)) return null;
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
    // Hold the Firestore snapshot unsub outside the auth callback so we can
    // clean it up when auth state changes or the component unmounts.
    let unsubConv: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Always tear down the previous snapshot before creating a new one
      unsubConv?.();
      unsubConv = undefined;

      if (!user) { setTotalUnread(0); setShowCommunityNew(false); setSidebarUserId(null); return; }

      setSidebarUserId(user.uid);
      // Check communityIntroState for "New" badge and onboarding phase for progressive disclosure
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

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="AI Companion" isActive={pathname === '/'} variant="outline">
              <Link href="/" onClick={() => handleNavClick('/')}>
                <Sparkles />
                <span>AI Companion</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>AI Tools</SidebarGroupLabel>
          <SidebarMenu>
            <FeatureSpotlight
              id={SPOTLIGHT_IDS.SIDEBAR_LESSON_PLAN}
              message="Start here! Create your first lesson plan"
              seenSpotlights={spotlightsSeen}
              onDismiss={handleSpotlightDismiss}
              position="right"
              delay={1000}
            >
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/lesson-plan')} tooltip="Lesson Plan">
                  <Link href="/lesson-plan" onClick={() => handleNavClick('/lesson-plan')}>
                    <CalendarDays />
                    <span>Lesson Plan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </FeatureSpotlight>
            {/* Core tools — always visible */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/quiz-generator')} tooltip="Quiz Generator">
                <Link href="/quiz-generator" onClick={() => handleNavClick('/quiz-generator')}>
                  <FileSignature />
                  <span>Quiz Generator</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/worksheet-wizard')} tooltip="Worksheet Wizard">
                <Link href="/worksheet-wizard" onClick={() => handleNavClick('/worksheet-wizard')}>
                  <PencilRuler />
                  <span>Worksheet Wizard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/visual-aid-designer')} tooltip="Visual Aid Designer">
                <Link href="/visual-aid-designer" onClick={() => handleNavClick('/visual-aid-designer')}>
                  <Images />
                  <span>Visual Aid Designer</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/instant-answer')} tooltip="Instant Answer">
                <Link href="/instant-answer" onClick={() => handleNavClick('/instant-answer')}>
                  <Wand2 />
                  <span>Instant Answer</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Advanced tools — hidden for new users behind "See all" */}
            {(!isNewUser || showAllTools) && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/rubric-generator')} tooltip="Rubric Generator">
                    <Link href="/rubric-generator" onClick={() => handleNavClick('/rubric-generator')}>
                      <ClipboardCheck />
                      <span>Rubric Generator</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/exam-paper')} tooltip="Exam Paper Generator">
                    <Link href="/exam-paper" onClick={() => handleNavClick('/exam-paper')}>
                      <FileText />
                      <span>Exam Paper</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/content-creator')} tooltip="Content Creator">
                    <Link href="/content-creator" onClick={() => handleNavClick('/content-creator')}>
                      <BookOpen />
                      <span>Content Creator</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/video-storyteller')} tooltip="Video Storyteller">
                    <Link href="/video-storyteller" onClick={() => handleNavClick('/video-storyteller')}>
                      <Video />
                      <span>Video Storyteller</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/teacher-training')} tooltip="Teacher Training">
                    <Link href="/teacher-training" onClick={() => handleNavClick('/teacher-training')}>
                      <GraduationCap />
                      <span>Teacher Training</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/virtual-field-trip')} tooltip="Virtual Field Trip">
                    <Link href="/virtual-field-trip" onClick={() => handleNavClick('/virtual-field-trip')}>
                      <Globe2 />
                      <span>Virtual Field Trip</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
            {isNewUser && !showAllTools && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setShowAllTools(true)} tooltip="See all tools">
                  <ChevronDown />
                  <span className="text-muted-foreground">See all tools</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {/* Core platform items — always visible */}
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/my-library')} tooltip="My Library">
                <Link href="/my-library" onClick={() => handleNavClick('/my-library')}>
                  <FolderKanban />
                  <span>My Library</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/my-profile')} tooltip="My Profile">
                <Link href="/my-profile" onClick={() => handleNavClick('/my-profile')}>
                  <User />
                  <span>My Profile</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/settings')} tooltip="Settings">
                <Link href="/settings" onClick={() => handleNavClick('/settings')}>
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Advanced platform items — hidden for new users */}
            {!isNewUser && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/attendance')} tooltip="Attendance">
                    <Link href="/attendance" onClick={() => handleNavClick('/attendance')}>
                      <ClipboardList />
                      <span>Attendance</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/community')} tooltip="Community Library">
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
                        <span>Community Library</span>
                      </span>
                      {showCommunityNew && (
                        <span className="ml-auto h-[18px] px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">
                          New
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/messages')} tooltip="Messages">
                    <Link href="/messages" onClick={() => handleNavClick('/messages')} className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <MessageCircle />
                        <span>Messages</span>
                      </span>
                      {totalUnread > 0 && (
                        <span className="ml-auto h-[18px] min-w-[18px] px-1.5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center">
                          {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/impact-dashboard')} tooltip="Impact Dashboard">
                    <Link href="/impact-dashboard" onClick={() => handleNavClick('/impact-dashboard')}>
                      <BarChart />
                      <span>Impact Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
            <UsageDisplay />
            {!isNewUser && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/notifications')} tooltip="Notifications">
                    <Link href="/notifications" onClick={() => handleNavClick('/notifications')}>
                      <Bell className="text-primary" />
                      <span>Notifications</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/privacy-for-teachers')} tooltip="Privacy">
                    <Link href="/privacy-for-teachers" onClick={() => handleNavClick('/privacy-for-teachers')}>
                      <ShieldCheck />
                      <span>Privacy</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
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
              {/* Review Panel — hidden until feature is built */}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
