
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
import { BarChart, BookOpen, CalendarDays, ClipboardCheck, ClipboardList, FileSignature, Globe2, GraduationCap, Images, Library, PencilRuler, ShieldCheck, Sparkles, Upload, Video, Wand2, FolderKanban, User, Zap, Terminal, MessageCircle } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db, auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [totalUnread, setTotalUnread] = useState(0);

  const handleNavClick = (href: string) => {
    setOpenMobile(false); // always close — no-op on desktop
    router.push(href);
  };

  // Live unread badge — subscribe to conversation unread counts
  useEffect(() => {
    // Hold the Firestore snapshot unsub outside the auth callback so we can
    // clean it up when auth state changes or the component unmounts.
    let unsubConv: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Always tear down the previous snapshot before creating a new one
      unsubConv?.();
      unsubConv = undefined;

      if (!user) { setTotalUnread(0); return; }

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
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/lesson-plan')} tooltip="Lesson Plan">
                <Link href="/lesson-plan" onClick={() => handleNavClick('/lesson-plan')}>
                  <CalendarDays />
                  <span>Lesson Plan</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/rubric-generator')} tooltip="Rubric Generator">
                <Link href="/rubric-generator" onClick={() => handleNavClick('/rubric-generator')}>
                  <ClipboardCheck />
                  <span>Rubric Generator</span>
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
              <SidebarMenuButton asChild isActive={pathname.startsWith('/quiz-generator')} tooltip="Quiz Generator">
                <Link href="/quiz-generator" onClick={() => handleNavClick('/quiz-generator')}>
                  <FileSignature />
                  <span>Quiz Generator</span>
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
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/attendance')} tooltip="Attendance">
                <Link href="/attendance" onClick={() => handleNavClick('/attendance')}>
                  <ClipboardList />
                  <span>Attendance</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/my-library')} tooltip="My Library">
                <Link href="/my-library" onClick={() => handleNavClick('/my-library')}>
                  <FolderKanban />
                  <span>My Library</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/community')} tooltip="Community Library">
                <Link href="/community" onClick={() => handleNavClick('/community')}>
                  <Library />
                  <span>Community Library</span>
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
                    <span className="ml-auto h-4 min-w-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
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
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/submit-content')} tooltip="Submit Content">
                <Link href="/submit-content" onClick={() => handleNavClick('/submit-content')}>
                  <Upload />
                  <span>Submit Content</span>
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
              <SidebarMenuButton asChild isActive={pathname.startsWith('/notifications')} tooltip="Notifications">
                <Link href="/notifications" onClick={() => handleNavClick('/notifications')}>
                  <Sparkles className="text-orange-500" />
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
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
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
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/review-panel')} tooltip="Review Panel">
                <Link href="/review-panel" onClick={() => handleNavClick('/review-panel')}>
                  <ShieldCheck />
                  <span>Review Panel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
