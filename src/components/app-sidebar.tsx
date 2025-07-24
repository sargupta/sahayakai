"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { Logo } from "@/components/logo"
import { NotebookPen, PencilRuler, Microscope, Images, Video, GraduationCap, Users, BotMessageSquare, Sparkles } from "lucide-react"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" isActive tooltip="Lesson Plan Generator">
              <NotebookPen />
              <span>Lesson Plan Generator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Worksheet Wizard" disabled>
              <PencilRuler />
              <span>Worksheet Wizard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Visual Aid Creator" disabled>
              <Images />
              <span>Visual Aid Creator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Video Clip Generator" disabled>
              <Video />
              <span>Video Clip Generator</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

           <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Intelligent Assessment" disabled>
              <GraduationCap />
              <span>Assessments</span>
            </SidebarMenuButton>
             <SidebarMenuSub>
               <SidebarMenuSubItem>
                <SidebarMenuSubButton href="#" disabled>Rubric Generator</SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton href="#" disabled>Grading Interface</SidebarMenuSubButton>
              </SidebarMenuSubItem>
             </SidebarMenuSub>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Community Hub" disabled>
              <Users />
              <span>Community Hub</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
         <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" tooltip="Teacher Coach" disabled>
                <BotMessageSquare />
                <span>Teacher Coach</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton href="#" tooltip="My Sahayak" disabled>
                <Sparkles />
                <span>My Sahayak</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
