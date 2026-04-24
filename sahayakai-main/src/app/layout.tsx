import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from '@/context/language-context';
import { AuthProvider } from '@/context/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { StructuredData } from '@/components/structured-data';
import { AppShell } from './app-shell';


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
            <AppShell>{children}</AppShell>
            <AuthDialog />
          </AuthProvider>
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
