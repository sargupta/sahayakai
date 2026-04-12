import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from '@/components/logo';
import { MicrophoneInput } from '@/components/microphone-input';
import { GlobalVoiceInterface } from '@/components/global-voice-interface';
import { OmniOrb } from '@/components/omni-orb';
import { MotherTongueGreeting } from '@/components/mother-tongue-greeting';
import { LanguageProvider } from '@/context/language-context';
import { AuthProvider } from '@/context/auth-context';
import { AuthButton } from '@/components/auth/auth-button';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { GlobalHooks } from '@/components/global-hooks';
import { StructuredData } from '@/components/structured-data';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';

import { AnalyticsProvider } from "@/components/analytics-provider";
import { ErrorBoundary } from "@/components/error-boundary";


export const metadata: Metadata = {
  metadataBase: new URL('https://sahayakai.com'),
  title: {
    default: 'SahayakAI — The Operating System for Teaching in India',
    template: '%s | SahayakAI',
  },
  description:
    'SahayakAI is the AI-powered teaching assistant for Indian teachers. Generate lesson plans, quizzes, worksheets, rubrics, visual aids, and more with voice-first interface in 11 Indian languages. NCERT, CBSE, ICSE, and state board curriculum support. Reduce lesson prep time by 90%. For government, private, and low-fee schools.',
  keywords: [
    'SahayakAI',
    'sahayak ai',
    'AI teaching assistant',
    'lesson planning',
    'quiz generator',
    'worksheet generator',
    'NCERT',
    'CBSE',
    'ICSE',
    'state boards',
    'Indian teachers',
    'educational software',
    'classroom management',
    'attendance tracking',
    'voice-first learning',
    'Hindi education',
    'Indian languages',
    'K-12 education',
    'teacher productivity',
    'lesson preparation',
    'sahayakai',
    'sahayak',
    'sahyak ai',
    'sahaykai',
  ],
  applicationName: 'SahayakAI',
  authors: [
    {
      name: 'SARGVISION',
      url: 'https://sahayakai.com',
    },
  ],
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://sahayakai.com',
    siteName: 'SahayakAI',
    title: 'SahayakAI — The Operating System for Teaching in India',
    description:
      'AI-powered lesson planning, quiz generation, worksheet creation, and attendance tracking for Indian K-12 teachers. Voice-first, 11 languages, NCERT + state boards.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SahayakAI - AI Teaching Assistant for Indian Teachers',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SahayakAI — The Operating System for Teaching in India',
    description:
      'AI teaching assistant for Indian teachers. Lesson plans, quizzes, worksheets, and attendance in 11 languages.',
    images: ['/og-image.png'],
    creator: '@sahayakai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  verification: {
    google: 'INSERT_GOOGLE_SITE_VERIFICATION_CODE_HERE',
  },
  alternates: {
    canonical: 'https://sahayakai.com',
  },
};

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
        <StructuredData />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger />
                    <div className="md:hidden">
                      <Logo />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AuthButton />
                  </div>
                </header>
                <main className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col items-center p-3 sm:p-4 md:p-8">
                  <ErrorBoundary>
                    <AnalyticsProvider>
                      {children}
                    </AnalyticsProvider>
                  </ErrorBoundary>
                </main>
              </SidebarInset>
              <AuthDialog />
            </SidebarProvider>

            {/* OmniOrb needs AuthProvider for useAuth — must live inside it */}
            <GlobalHooks />
            <OmniOrb />
            <MotherTongueGreeting />
          </AuthProvider>
          <Toaster />
          <PWAInstallPrompt />
          {/* <GlobalVoiceInterface /> */}
        </LanguageProvider>
      </body>
    </html>
  );
}
