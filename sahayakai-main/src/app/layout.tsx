import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from '@/components/logo';
import { MicrophoneInput } from '@/components/microphone-input';
import { GlobalVoiceInterface } from '@/components/global-voice-interface';

export const metadata: Metadata = {
  title: 'SahayakAI: Bharat Interface',
  description: 'AI-powered lesson planning for teachers in Bharat.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#f97316',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
              <SidebarTrigger />
              <div className="md:hidden">
                <Logo />
              </div>
            </header>
            <main className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col items-center p-4 md:p-8">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
        <GlobalVoiceInterface />
      </body>
    </html>
  );
}
