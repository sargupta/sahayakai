import type { Metadata } from "next";
import { HomeGate } from "./home-gate";

/*
 * "/" serves two audiences: signed-out visitors get the marketing homepage
 * (founder-approved v1, 2026-11-27) and signed-in teachers get their
 * dashboard. The choice is made on the client in HomeGate; this server file
 * exists so the homepage can carry its own title and description.
 * No figure appears in this copy: numbers live on the page, read from
 * src/lib/school-pricing.ts.
 */
const TITLE = "SahayakAI: quality education for every classroom in India";
const DESCRIPTION =
  "India's voice-first AI assistant for teachers, parents and school leaders. Calls to parents in their own language, CBSE and ICSE exam papers, and an AI Mentor for every teacher, aligned with NEP 2020.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://sahayakai.com",
    siteName: "SahayakAI",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SahayakAI",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@sahayakai",
  },
};

export default function Page() {
  return <HomeGate />;
}
