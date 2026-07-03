import type { Metadata, Viewport } from 'next';
import {
  Inter,
  Outfit,
  Noto_Sans_Devanagari,
  Noto_Sans_Bengali,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Oriya,
} from 'next/font/google';
import './globals.css';

// ========================================
// PHASE 0 — SELF-HOSTED FONTS (2026-07-03)
// Design proposals 00/02/10. next/font/google downloads each family at
// BUILD time and serves the woff2 from our own origin — no runtime
// fonts.googleapis.com round-trip, no Google-Fonts CSS injection, no
// Indic-script CLS/tofu flash (the old public/indic-font-preload.js +
// ensureIndicFontLoaded() runtime injection are retired).
//
// Each family is emitted as @font-face + a CSS custom property only;
// browsers fetch a family's woff2 lazily when text actually uses it, so
// bundling all 10 Indic families does not bloat English-only sessions.
// Per-language application: LanguageContext syncs <html lang>, and
// globals.css maps :lang() -> the right --font-noto-* variable.
// ========================================
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});
// 800 kept: landing headlines use font-extrabold with font-headline.
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-devanagari',
  display: 'swap',
});
const notoBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-bengali',
  display: 'swap',
});
const notoTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-tamil',
  display: 'swap',
});
const notoTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-telugu',
  display: 'swap',
});
const notoKannada = Noto_Sans_Kannada({
  subsets: ['kannada'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-kannada',
  display: 'swap',
});
const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-malayalam',
  display: 'swap',
});
const notoGujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-gujarati',
  display: 'swap',
});
const notoGurmukhi = Noto_Sans_Gurmukhi({
  subsets: ['gurmukhi'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-gurmukhi',
  display: 'swap',
});
const notoOriya = Noto_Sans_Oriya({
  subsets: ['oriya'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-oriya',
  display: 'swap',
});

const fontVariables = [
  inter.variable,
  outfit.variable,
  notoDevanagari.variable,
  notoBengali.variable,
  notoTamil.variable,
  notoTelugu.variable,
  notoKannada.variable,
  notoMalayalam.variable,
  notoGujarati.variable,
  notoGurmukhi.variable,
  notoOriya.variable,
].join(' ');
import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from '@/context/language-context';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/context/auth-context';
import { FeatureFlagsProvider } from '@/context/feature-flags-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { StructuredData } from '@/components/structured-data';
import { AppShell } from './app-shell';

// Cloudflare Web Analytics beacon token for sahayakai.com.
// Public token (visible in DOM) — safe to hardcode. Used because the
// origin is on Firebase App Hosting (not Cloudflare-proxied), so CF's
// "Automatic setup" cannot inject the snippet at the edge — it must be
// served from the origin HTML.
const CF_BEACON_TOKEN = '85586945f7b24465ab08ab9d84c1f6f2';


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
    google: 'kBENffwEyadi863f0st5xZXRp9Qb5q_kD0RkkwMPVJ8',
  },
  alternates: {
    canonical: 'https://sahayakai.com',
  },
};

export const viewport: Viewport = {
  // Next's metadata API needs a literal hex; mirrors --primary in globals.css.
  themeColor: '#b35609', // design-token-allow
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
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Fonts are self-hosted via next/font (see top of file) — the old
            fonts.googleapis.com stylesheet links and the
            public/indic-font-preload.js runtime injector are retired. */}
        <StructuredData />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <FeatureFlagsProvider>
                <AppShell>{children}</AppShell>
                <AuthDialog />
              </FeatureFlagsProvider>
            </AuthProvider>
            <Toaster />
          </LanguageProvider>
        </ThemeProvider>
        {/* Cloudflare Web Analytics — manual JS snippet install.
            Plain <script defer> so it SSRs into the HTML (curl-visible);
            `defer` keeps it from blocking parsing. Mirrors the exact
            snippet Cloudflare's docs ship for non-proxied origins. */}
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
        />
      </body>
    </html>
  );
}
