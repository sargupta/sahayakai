import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from '@/components/logo';

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
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-8">
              <SidebarHeader className="w-full flex items-center justify-between md:hidden mb-4">
                <Logo />
              </SidebarHeader>
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
