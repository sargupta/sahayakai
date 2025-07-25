
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
  SidebarGroupLabel
} from "@/components/ui/sidebar"
import { BarChart, BookOpen, CalendarDays, ClipboardCheck, FileSignature, Globe2, GraduationCap, Images, Library, PencilRuler, ShieldCheck, Sparkles, Upload, Video, Wand2, FolderKanban, User, LogIn, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { Skeleton } from "./ui/skeleton"

export function AppSidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <Sidebar>
        <SidebarHeader>
          <Skeleton className="h-10 w-full" />
        </SidebarHeader>
        <SidebarContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarContent>
        <SidebarFooter>
          <Skeleton className="h-10 w-full" />
        </SidebarFooter>
      </Sidebar>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
             <SidebarMenuButton asChild tooltip="AI Companion" isActive={pathname === '/'} variant="outline">
                <Link href="/">
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
                <Link href="/lesson-plan">
                  <CalendarDays />
                  <span>Lesson Plan</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/rubric-generator')} tooltip="Rubric Generator">
                <Link href="/rubric-generator">
                  <ClipboardCheck />
                  <span>Rubric Generator</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/worksheet-wizard')} tooltip="Worksheet Wizard">
                <Link href="/worksheet-wizard">
                  <PencilRuler />
                  <span>Worksheet Wizard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/quiz-generator')} tooltip="Quiz Generator">
                <Link href="/quiz-generator">
                  <FileSignature />
                  <span>Quiz Generator</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/visual-aid-designer')} tooltip="Visual Aid Designer">
                <Link href="/visual-aid-designer">
                  <Images />
                  <span>Visual Aid Designer</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/instant-answer')} tooltip="Instant Answer">
                <Link href="/instant-answer">
                  <Wand2 />
                  <span>Instant Answer</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/content-creator')} tooltip="Content Creator">
                <Link href="/content-creator">
                  <BookOpen />
                  <span>Content Creator</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/video-storyteller')} tooltip="Video Storyteller">
                <Link href="/video-storyteller">
                  <Video />
                  <span>Video Storyteller</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/teacher-training')} tooltip="Teacher Training">
                <Link href="/teacher-training">
                  <GraduationCap />
                  <span>Teacher Training</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/virtual-field-trip')} tooltip="Virtual Field Trip">
                <Link href="/virtual-field-trip">
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
                <SidebarMenuButton asChild isActive={pathname.startsWith('/my-library')} tooltip="My Library">
                  <Link href="/my-library">
                    <FolderKanban />
                    <span>My Library</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/community')} tooltip="Community Library">
                  <Link href="/community">
                    <Library />
                    <span>Community Library</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/impact-dashboard')} tooltip="Impact Dashboard">
                  <Link href="/impact-dashboard">
                    <BarChart />
                    <span>Impact Dashboard</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/submit-content')} tooltip="Submit Content">
                  <Link href="/submit-content">
                    <Upload />
                    <span>Submit Content</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/my-profile')} tooltip="My Profile">
                  <Link href="/my-library">
                    <User />
                    <span>My Profile</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname.startsWith('/login')} tooltip="Login">
                <Link href="/login">
                  <LogIn />
                  <span>Login</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
         <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/review-panel')} tooltip="Review Panel">
                  <Link href="/review-panel">
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
